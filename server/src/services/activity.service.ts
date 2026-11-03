import { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { emitToProject } from "../sockets";

interface LogActivityInput {
  taskId: string;
  projectId: string;
  userId: string;
  type: ActivityType;
  metadata?: Prisma.InputJsonValue;
}

export async function logActivity(input: LogActivityInput) {
  const activity = await prisma.activity.create({
    data: {
      taskId: input.taskId,
      userId: input.userId,
      type: input.type,
      metadata: input.metadata,
    },
    include: {
      user: { select: { id: true, name: true, avatarColor: true, avatarUrl: true } },
    },
  });

  emitToProject(input.projectId, "activity:new", activity);
  return activity;
}
