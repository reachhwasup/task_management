import { NotificationType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { emitToUser } from "../sockets";

interface CreateNotificationInput {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  message: string;
  taskId?: string | null;
  projectId?: string | null;
  workspaceId?: string | null;
  inviteId?: string | null;
  projectInviteId?: string | null;
  teamInviteId?: string | null;
}

export async function createNotification(input: CreateNotificationInput) {
  // Don't notify users about their own actions.
  if (input.actorId && input.actorId === input.recipientId) return null;

  const notification = await prisma.notification.create({
    data: {
      recipientId: input.recipientId,
      actorId: input.actorId ?? null,
      type: input.type,
      message: input.message,
      taskId: input.taskId ?? null,
      projectId: input.projectId ?? null,
      workspaceId: input.workspaceId ?? null,
      inviteId: input.inviteId ?? null,
      projectInviteId: input.projectInviteId ?? null,
      teamInviteId: input.teamInviteId ?? null,
    },
    include: {
      actor: { select: { id: true, name: true, avatarColor: true, avatarUrl: true } },
    },
  });

  emitToUser(input.recipientId, "notification:new", notification);
  return notification;
}

export async function notifyMany(inputs: CreateNotificationInput[]) {
  return Promise.all(inputs.map(createNotification));
}
