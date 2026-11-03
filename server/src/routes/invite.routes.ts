import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { createNotification } from "../services/notification.service";

const router = Router();

router.get("/me", async (req, res) => {
  const invites = await prisma.workspaceInvite.findMany({
    where: { invitedUserId: req.userId, status: "PENDING" },
    include: {
      workspace: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { id: true, name: true, avatarColor: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(invites);
});

router.post("/:inviteId/accept", async (req, res) => {
  const invite = await prisma.workspaceInvite.findUnique({
    where: { id: req.params.inviteId },
    include: { workspace: true },
  });
  if (!invite || invite.invitedUserId !== req.userId) throw new ApiError(404, "Invite not found");
  if (invite.status !== "PENDING") throw new ApiError(409, "This invite has already been responded to");

  await prisma.$transaction([
    prisma.workspaceMember.create({
      data: { workspaceId: invite.workspaceId, userId: invite.invitedUserId, role: "MEMBER" },
    }),
    prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    }),
  ]);

  const acceptingUser = await prisma.user.findUnique({ where: { id: req.userId } });
  await createNotification({
    recipientId: invite.invitedById,
    actorId: req.userId,
    type: "WORKSPACE_INVITE_ACCEPTED",
    message: `${acceptingUser?.name ?? "Someone"} accepted your invite to "${invite.workspace.name}"`,
    workspaceId: invite.workspaceId,
  });

  res.json({ workspaceId: invite.workspaceId });
});

router.post("/:inviteId/decline", async (req, res) => {
  const invite = await prisma.workspaceInvite.findUnique({ where: { id: req.params.inviteId } });
  if (!invite || invite.invitedUserId !== req.userId) throw new ApiError(404, "Invite not found");
  if (invite.status !== "PENDING") throw new ApiError(409, "This invite has already been responded to");

  await prisma.workspaceInvite.update({
    where: { id: invite.id },
    data: { status: "DECLINED", respondedAt: new Date() },
  });

  res.status(204).send();
});

// ── Project invites ──────────────────────────────────────────

router.post("/projects/:inviteId/accept", async (req, res) => {
  const invite = await prisma.projectInvite.findUnique({
    where: { id: req.params.inviteId },
    include: { project: true },
  });
  if (!invite || invite.invitedUserId !== req.userId) throw new ApiError(404, "Invite not found");
  if (invite.status !== "PENDING") throw new ApiError(409, "This invite has already been responded to");

  await prisma.$transaction([
    prisma.projectMember.create({
      data: { projectId: invite.projectId, userId: invite.invitedUserId, role: "EDITOR" },
    }),
    prisma.projectInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    }),
  ]);

  const acceptingUser = await prisma.user.findUnique({ where: { id: req.userId } });
  await createNotification({
    recipientId: invite.invitedById,
    actorId: req.userId,
    type: "PROJECT_INVITE_ACCEPTED",
    message: `${acceptingUser?.name ?? "Someone"} accepted your invite to the project "${invite.project.name}"`,
    projectId: invite.projectId,
  });

  res.json({ projectId: invite.projectId, workspaceId: invite.project.workspaceId });
});

router.post("/projects/:inviteId/decline", async (req, res) => {
  const invite = await prisma.projectInvite.findUnique({ where: { id: req.params.inviteId } });
  if (!invite || invite.invitedUserId !== req.userId) throw new ApiError(404, "Invite not found");
  if (invite.status !== "PENDING") throw new ApiError(409, "This invite has already been responded to");

  await prisma.projectInvite.update({
    where: { id: invite.id },
    data: { status: "DECLINED", respondedAt: new Date() },
  });

  res.status(204).send();
});

// ── Team invites ─────────────────────────────────────────────

router.post("/teams/:inviteId/accept", async (req, res) => {
  const invite = await prisma.teamInvite.findUnique({
    where: { id: req.params.inviteId },
    include: { team: true },
  });
  if (!invite || invite.invitedUserId !== req.userId) throw new ApiError(404, "Invite not found");
  if (invite.status !== "PENDING") throw new ApiError(409, "This invite has already been responded to");

  await prisma.$transaction([
    prisma.teamMember.create({
      data: { teamId: invite.teamId, userId: invite.invitedUserId },
    }),
    prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    }),
  ]);

  const acceptingUser = await prisma.user.findUnique({ where: { id: req.userId } });
  await createNotification({
    recipientId: invite.invitedById,
    actorId: req.userId,
    type: "TEAM_INVITE_ACCEPTED",
    message: `${acceptingUser?.name ?? "Someone"} accepted your invite to the team "${invite.team.name}"`,
  });

  res.json({ teamId: invite.teamId, workspaceId: invite.team.workspaceId });
});

router.post("/teams/:inviteId/decline", async (req, res) => {
  const invite = await prisma.teamInvite.findUnique({ where: { id: req.params.inviteId } });
  if (!invite || invite.invitedUserId !== req.userId) throw new ApiError(404, "Invite not found");
  if (invite.status !== "PENDING") throw new ApiError(409, "This invite has already been responded to");

  await prisma.teamInvite.update({
    where: { id: invite.id },
    data: { status: "DECLINED", respondedAt: new Date() },
  });

  res.status(204).send();
});

export default router;
