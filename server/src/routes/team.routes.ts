import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { createNotification } from "../services/notification.service";

const router = Router();

const memberSummary = {
  select: {
    id: true,
    createdAt: true,
    user: { select: { id: true, name: true, email: true, avatarColor: true, avatarUrl: true } },
  },
} as const;

async function requireTeamAccess(req: import("express").Request) {
  const team = await prisma.team.findUnique({ where: { id: req.params.teamId } });
  if (!team) throw new ApiError(404, "Team not found");
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: team.workspaceId, userId: req.userId! } },
  });
  if (!membership) throw new ApiError(403, "You do not have access to this team");

  // Teams are only visible to their members; workspace OWNER/ADMIN keep oversight.
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    const teamMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: team.id, userId: req.userId! } },
    });
    if (!teamMember) throw new ApiError(403, "You are not a member of this team");
  }
  return team;
}

router.get("/:teamId", async (req, res) => {
  const team = await requireTeamAccess(req);
  const full = await prisma.team.findUnique({
    where: { id: team.id },
    include: {
      members: memberSummary,
      projects: { where: { archived: false } },
      invites: {
        where: { status: "PENDING" },
        select: {
          id: true,
          invitedUser: { select: { id: true, name: true, email: true, avatarColor: true, avatarUrl: true } },
        },
      },
    },
  });
  res.json(full);
});

router.patch("/:teamId", async (req, res) => {
  await requireTeamAccess(req);
  const schema = z.object({
    name: z.string().min(1).max(80).optional(),
    description: z.string().max(500).nullable().optional(),
  });
  const data = schema.parse(req.body);
  const team = await prisma.team.update({ where: { id: req.params.teamId }, data });
  res.json(team);
});

router.delete("/:teamId", async (req, res) => {
  await requireTeamAccess(req);
  await prisma.team.delete({ where: { id: req.params.teamId } });
  res.status(204).send();
});

// Invite by email — membership is only created when the recipient accepts,
// mirroring workspace and project invites.
router.post("/:teamId/members", async (req, res) => {
  const team = await requireTeamAccess(req);
  const schema = z.object({ email: z.string().email() });
  const { email } = schema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    throw new ApiError(404, "No account with that email exists yet. Ask them to sign up first.");
  }

  const inWorkspace = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: team.workspaceId, userId: user.id } },
  });
  if (!inWorkspace) throw new ApiError(400, "That user must be a workspace member first");

  const existingMember = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId: user.id } },
  });
  if (existingMember) throw new ApiError(409, "That user is already a member of this team");

  const existingInvite = await prisma.teamInvite.findUnique({
    where: { teamId_invitedUserId: { teamId: team.id, invitedUserId: user.id } },
  });
  if (existingInvite?.status === "PENDING") {
    throw new ApiError(409, "An invite is already pending for that user");
  }

  const invite = await prisma.teamInvite.upsert({
    where: { teamId_invitedUserId: { teamId: team.id, invitedUserId: user.id } },
    create: { teamId: team.id, invitedUserId: user.id, invitedById: req.userId! },
    update: { status: "PENDING", invitedById: req.userId!, createdAt: new Date(), respondedAt: null },
  });

  await createNotification({
    recipientId: user.id,
    actorId: req.userId,
    type: "TEAM_INVITE",
    message: `You were invited to join the team "${team.name}"`,
    teamInviteId: invite.id,
  });

  res.status(201).json({
    id: invite.id,
    status: invite.status,
    invitedUser: { id: user.id, name: user.name, email: user.email, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl },
  });
});

router.delete("/:teamId/members/:userId", async (req, res) => {
  await requireTeamAccess(req);
  await prisma.teamMember.delete({
    where: { teamId_userId: { teamId: req.params.teamId, userId: req.params.userId } },
  });
  res.status(204).send();
});

export default router;
