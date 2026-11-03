import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireProjectAccess } from "../middleware/access";
import { ApiError } from "../middleware/errorHandler";
import { createNotification, notifyMany } from "../services/notification.service";
import { logActivity } from "../services/activity.service";
import { emitToProject } from "../sockets";

const router = Router();

const taskListInclude = {
  assignees: {
    select: { user: { select: { id: true, name: true, avatarColor: true, avatarUrl: true } } },
  },
  tags: { include: { tag: true } },
  _count: { select: { subtasks: true, comments: true } },
} as const;

const memberSummary = {
  select: {
    id: true,
    role: true,
    createdAt: true,
    user: { select: { id: true, name: true, email: true, avatarColor: true, avatarUrl: true } },
  },
} as const;

router.get("/:projectId", requireProjectAccess, async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.projectId },
    include: {
      sections: { orderBy: { order: "asc" } },
      members: memberSummary,
      invites: {
        where: { status: "PENDING" },
        select: {
          id: true,
          invitedUser: { select: { id: true, name: true, email: true, avatarColor: true, avatarUrl: true } },
        },
      },
      team: true,
    },
  });
  res.json({ ...project, role: req.workspaceRole });
});

router.patch("/:projectId", requireProjectAccess, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(1000).nullable().optional(),
    color: z.string().optional(),
    icon: z.string().nullable().optional(),
    archived: z.boolean().optional(),
    teamId: z.string().nullable().optional(),
  });
  const data = schema.parse(req.body);
  const project = await prisma.project.update({ where: { id: req.params.projectId }, data });
  res.json(project);
});

router.delete("/:projectId", requireProjectAccess, async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.projectId } });
  res.status(204).send();
});

// ── Sections ─────────────────────────────────────────────────

router.post("/:projectId/sections", requireProjectAccess, async (req, res) => {
  const schema = z.object({ name: z.string().min(1).max(80) });
  const { name } = schema.parse(req.body);

  const last = await prisma.section.findFirst({
    where: { projectId: req.params.projectId },
    orderBy: { order: "desc" },
  });

  const section = await prisma.section.create({
    data: { name, projectId: req.params.projectId, order: (last?.order ?? -1) + 1 },
  });
  res.status(201).json(section);
});

router.patch("/sections/:sectionId", async (req, res) => {
  const section = await prisma.section.findUnique({ where: { id: req.params.sectionId } });
  if (!section) throw new ApiError(404, "Section not found");

  const schema = z.object({ name: z.string().min(1).max(80).optional(), order: z.number().optional() });
  const data = schema.parse(req.body);
  const updated = await prisma.section.update({ where: { id: section.id }, data });
  res.json(updated);
});

router.delete("/sections/:sectionId", async (req, res) => {
  await prisma.section.delete({ where: { id: req.params.sectionId } });
  res.status(204).send();
});

// ── Tasks ────────────────────────────────────────────────────

router.get("/:projectId/tasks", requireProjectAccess, async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { projectId: req.params.projectId, parentTaskId: null },
    include: taskListInclude,
    orderBy: [{ sectionId: "asc" }, { order: "asc" }],
  });
  res.json(tasks);
});

router.post("/:projectId/tasks", requireProjectAccess, async (req, res) => {
  const schema = z.object({
    title: z.string().min(1).max(300),
    description: z.string().max(5000).optional(),
    sectionId: z.string().optional(),
    assigneeIds: z.array(z.string()).max(20).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    dueDate: z.string().datetime().optional(),
    startDate: z.string().datetime().optional(),
  });
  const data = schema.parse(req.body);

  const last = await prisma.task.findFirst({
    where: { projectId: req.params.projectId, sectionId: data.sectionId ?? null },
    orderBy: { order: "desc" },
  });

  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description,
      sectionId: data.sectionId,
      assignees: data.assigneeIds?.length
        ? { create: data.assigneeIds.map((userId) => ({ userId })) }
        : undefined,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      projectId: req.params.projectId,
      createdById: req.userId!,
      order: (last?.order ?? -1) + 1,
      followers: { create: { userId: req.userId! } },
    },
    include: taskListInclude,
  });

  await logActivity({
    taskId: task.id,
    projectId: req.params.projectId,
    userId: req.userId!,
    type: "TASK_CREATED",
  });

  const assignedOthers = (data.assigneeIds ?? []).filter((id) => id !== req.userId);
  await notifyMany(
    assignedOthers.map((recipientId) => ({
      recipientId,
      actorId: req.userId,
      type: "TASK_ASSIGNED" as const,
      message: `You were assigned to "${task.title}"`,
      taskId: task.id,
      projectId: req.params.projectId,
    }))
  );

  emitToProject(req.params.projectId, "task:created", task);
  res.status(201).json(task);
});

// ── Members ──────────────────────────────────────────────────

// Invite by email — membership is only created when the recipient accepts,
// mirroring how workspace invites work.
router.post("/:projectId/members", requireProjectAccess, async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const { email } = schema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    throw new ApiError(404, "No account with that email exists yet. Ask them to sign up first.");
  }

  const inWorkspace = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: req.project!.workspaceId, userId: user.id } },
  });
  if (!inWorkspace) throw new ApiError(400, "That user must be a workspace member first");

  const existingMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: req.params.projectId, userId: user.id } },
  });
  if (existingMember) throw new ApiError(409, "That user is already a member of this project");

  const existingInvite = await prisma.projectInvite.findUnique({
    where: { projectId_invitedUserId: { projectId: req.params.projectId, invitedUserId: user.id } },
  });
  if (existingInvite?.status === "PENDING") {
    throw new ApiError(409, "An invite is already pending for that user");
  }

  const invite = await prisma.projectInvite.upsert({
    where: { projectId_invitedUserId: { projectId: req.params.projectId, invitedUserId: user.id } },
    create: { projectId: req.params.projectId, invitedUserId: user.id, invitedById: req.userId! },
    update: { status: "PENDING", invitedById: req.userId!, createdAt: new Date(), respondedAt: null },
  });

  await createNotification({
    recipientId: user.id,
    actorId: req.userId,
    type: "PROJECT_INVITE",
    message: `You were invited to join the project "${req.project!.name}"`,
    projectId: req.project!.id,
    projectInviteId: invite.id,
  });

  res.status(201).json({
    id: invite.id,
    status: invite.status,
    invitedUser: { id: user.id, name: user.name, email: user.email, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl },
  });
});

router.delete("/:projectId/members/:userId", requireProjectAccess, async (req, res) => {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: req.params.projectId, userId: req.params.userId } },
  });
  if (!member) throw new ApiError(404, "Member not found");
  if (member.role === "OWNER") {
    throw new ApiError(400, "The project owner cannot be removed");
  }
  await prisma.projectMember.delete({ where: { id: member.id } });
  res.status(204).send();
});

export default router;
