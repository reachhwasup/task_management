import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireWorkspaceMember, requireWorkspaceAdmin } from "../middleware/access";
import { ApiError } from "../middleware/errorHandler";
import { slugify, withRandomSuffix } from "../utils/slugify";
import { createNotification } from "../services/notification.service";

const router = Router();

const memberSummary = {
  select: {
    id: true,
    role: true,
    createdAt: true,
    user: { select: { id: true, name: true, email: true, avatarColor: true, avatarUrl: true } },
  },
} as const;

// TeamMember has no `role` field (only WorkspaceMember does), so it needs its own shape.
const teamMemberSummary = {
  select: {
    id: true,
    createdAt: true,
    user: { select: { id: true, name: true, email: true, avatarColor: true, avatarUrl: true } },
  },
} as const;

router.get("/", async (req, res) => {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: req.userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(memberships.map((m) => ({ ...m.workspace, role: m.role })));
});

router.post("/", async (req, res) => {
  const schema = z.object({ name: z.string().min(1).max(80) });
  const { name } = schema.parse(req.body);

  let slug = slugify(name);
  if (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = withRandomSuffix(slug);
  }

  const workspace = await prisma.workspace.create({
    data: { name, slug, members: { create: { userId: req.userId!, role: "OWNER" } } },
  });
  res.status(201).json(workspace);
});

router.get("/:workspaceId", requireWorkspaceMember, async (req, res) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: req.params.workspaceId },
    include: {
      teams: { include: { members: teamMemberSummary } },
      projects: { where: { archived: false }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!workspace) throw new ApiError(404, "Workspace not found");
  res.json({ ...workspace, role: req.workspaceRole });
});

router.patch("/:workspaceId", requireWorkspaceMember, requireWorkspaceAdmin, async (req, res) => {
  const schema = z.object({ name: z.string().min(1).max(80) });
  const data = schema.parse(req.body);
  const workspace = await prisma.workspace.update({
    where: { id: req.params.workspaceId },
    data,
  });
  res.json(workspace);
});

router.get("/:workspaceId/members", requireWorkspaceMember, async (req, res) => {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: req.params.workspaceId },
    ...memberSummary,
    orderBy: { createdAt: "asc" },
  });
  res.json(members);
});

// Invites are pending until the recipient accepts — this never creates a
// WorkspaceMember directly, so nobody is added to a workspace without
// confirming first (see /api/invites for the accept/decline endpoints).
router.post("/:workspaceId/members", requireWorkspaceMember, requireWorkspaceAdmin, async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const { email } = schema.parse(req.body);

  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });
  if (!workspace) throw new ApiError(404, "Workspace not found");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new ApiError(404, "No account with that email exists yet. Ask them to sign up first.");
  }

  const existingMember = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: req.params.workspaceId, userId: user.id } },
  });
  if (existingMember) throw new ApiError(409, "That user is already a member of this workspace");

  const existingInvite = await prisma.workspaceInvite.findUnique({
    where: { workspaceId_invitedUserId: { workspaceId: req.params.workspaceId, invitedUserId: user.id } },
  });
  if (existingInvite?.status === "PENDING") {
    throw new ApiError(409, "An invite is already pending for that user");
  }

  const invite = await prisma.workspaceInvite.upsert({
    where: { workspaceId_invitedUserId: { workspaceId: req.params.workspaceId, invitedUserId: user.id } },
    create: { workspaceId: req.params.workspaceId, invitedUserId: user.id, invitedById: req.userId! },
    update: { status: "PENDING", invitedById: req.userId!, createdAt: new Date(), respondedAt: null },
  });

  await createNotification({
    recipientId: user.id,
    actorId: req.userId,
    type: "WORKSPACE_INVITE",
    message: `You were invited to join the workspace "${workspace.name}"`,
    workspaceId: workspace.id,
    inviteId: invite.id,
  });

  res.status(201).json({
    id: invite.id,
    status: invite.status,
    user: { id: user.id, name: user.name, email: user.email, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl },
  });
});

router.get("/:workspaceId/invites", requireWorkspaceMember, requireWorkspaceAdmin, async (req, res) => {
  const invites = await prisma.workspaceInvite.findMany({
    where: { workspaceId: req.params.workspaceId, status: "PENDING" },
    include: { invitedUser: { select: { id: true, name: true, email: true, avatarColor: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(invites);
});

router.delete(
  "/:workspaceId/members/:userId",
  requireWorkspaceMember,
  requireWorkspaceAdmin,
  async (req, res) => {
    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: { workspaceId: req.params.workspaceId, userId: req.params.userId },
      },
    });
    res.status(204).send();
  }
);

router.get("/:workspaceId/teams", requireWorkspaceMember, async (req, res) => {
  const isAdmin = req.workspaceRole === "OWNER" || req.workspaceRole === "ADMIN";
  const teams = await prisma.team.findMany({
    where: {
      workspaceId: req.params.workspaceId,
      // Regular members only see teams they belong to.
      ...(isAdmin ? {} : { members: { some: { userId: req.userId! } } }),
    },
    include: {
      members: teamMemberSummary,
      projects: {
        where: { archived: false, ...visibleProjectsFilter(req.userId!, req.workspaceRole!) },
        select: { id: true, name: true, color: true, teamId: true },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { projects: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(teams);
});

router.post("/:workspaceId/teams", requireWorkspaceMember, async (req, res) => {
  const schema = z.object({ name: z.string().min(1).max(80), description: z.string().max(500).optional() });
  const data = schema.parse(req.body);
  const team = await prisma.team.create({
    data: {
      name: data.name,
      description: data.description,
      workspaceId: req.params.workspaceId,
      members: { create: { userId: req.userId! } },
    },
    include: { members: teamMemberSummary },
  });
  res.status(201).json(team);
});

// Mirrors canAccessProject in middleware/access.ts: team projects are visible
// to team members (and OWNER/ADMIN); personal projects strictly to their
// members — no admin bypass.
function visibleProjectsFilter(userId: string, role: string) {
  const isAdmin = role === "OWNER" || role === "ADMIN";
  return {
    OR: [
      { members: { some: { userId } } },
      isAdmin ? { teamId: { not: null } } : { team: { members: { some: { userId } } } },
    ],
  };
}

router.get("/:workspaceId/projects", requireWorkspaceMember, async (req, res) => {
  const includeArchived = req.query.archived === "true";
  const projects = await prisma.project.findMany({
    where: {
      workspaceId: req.params.workspaceId,
      ...(includeArchived ? {} : { archived: false }),
      ...visibleProjectsFilter(req.userId!, req.workspaceRole!),
    },
    include: { _count: { select: { tasks: { where: { completed: false } } } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(projects);
});

router.post("/:workspaceId/projects", requireWorkspaceMember, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000).optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    teamId: z.string().optional(),
  });
  const data = schema.parse(req.body);

  const project = await prisma.project.create({
    data: {
      ...data,
      workspaceId: req.params.workspaceId,
      members: { create: { userId: req.userId!, role: "OWNER" } },
      sections: {
        create: [
          { name: "To do", order: 0 },
          { name: "In progress", order: 1 },
          { name: "Done", order: 2 },
        ],
      },
    },
    include: { sections: { orderBy: { order: "asc" } } },
  });
  res.status(201).json(project);
});

router.get("/:workspaceId/tags", requireWorkspaceMember, async (req, res) => {
  const tags = await prisma.tag.findMany({ where: { workspaceId: req.params.workspaceId } });
  res.json(tags);
});

router.post("/:workspaceId/tags", requireWorkspaceMember, async (req, res) => {
  const schema = z.object({ name: z.string().min(1).max(40), color: z.string().optional() });
  const data = schema.parse(req.body);
  const tag = await prisma.tag.create({
    data: { name: data.name, color: data.color, workspaceId: req.params.workspaceId },
  });
  res.status(201).json(tag);
});

export default router;
