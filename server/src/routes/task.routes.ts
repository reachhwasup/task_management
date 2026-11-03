import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { assertProjectVisible, requireTaskAccess } from "../middleware/access";
import { ApiError } from "../middleware/errorHandler";
import { logActivity } from "../services/activity.service";
import { notifyMany } from "../services/notification.service";
import { emitToProject } from "../sockets";

const router = Router();

const personSelect = { select: { id: true, name: true, avatarColor: true, avatarUrl: true, email: true } } as const;

const assigneesInclude = { select: { user: personSelect } } as const;

const taskDetailInclude = {
  assignees: assigneesInclude,
  createdBy: personSelect,
  tags: { include: { tag: true } },
  followers: { include: { user: personSelect } },
  subtasks: {
    include: { assignees: assigneesInclude, _count: { select: { subtasks: true, comments: true } } },
    orderBy: { order: "asc" as const },
  },
  comments: {
    include: { user: personSelect, mentions: { include: { user: personSelect } } },
    orderBy: { createdAt: "asc" as const },
  },
  activities: {
    include: { user: personSelect },
    orderBy: { createdAt: "desc" as const },
    take: 50,
  },
  _count: { select: { subtasks: true, comments: true } },
};

router.get("/:taskId", requireTaskAccess, async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.taskId },
    include: taskDetailInclude,
  });
  res.json(task);
});

router.patch("/:taskId", requireTaskAccess, async (req, res) => {
  const schema = z.object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(5000).nullable().optional(),
    sectionId: z.string().nullable().optional(),
    assigneeIds: z.array(z.string()).max(20).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    dueDate: z.string().datetime().nullable().optional(),
    startDate: z.string().datetime().nullable().optional(),
    completed: z.boolean().optional(),
    order: z.number().optional(),
  });
  const { assigneeIds, ...data } = schema.parse(req.body);
  const before = req.task!;
  const projectId = before.projectId;

  // Snapshot current assignees so we can tell who was newly added.
  let beforeAssigneeIds: string[] = [];
  if (assigneeIds !== undefined) {
    const current = await prisma.taskAssignee.findMany({
      where: { taskId: before.id },
      select: { userId: true },
    });
    beforeAssigneeIds = current.map((a) => a.userId);
  }

  const updated = await prisma.task.update({
    where: { id: before.id },
    data: {
      ...data,
      dueDate: data.dueDate === undefined ? undefined : data.dueDate ? new Date(data.dueDate) : null,
      startDate:
        data.startDate === undefined ? undefined : data.startDate ? new Date(data.startDate) : null,
      completedAt: data.completed === undefined ? undefined : data.completed ? new Date() : null,
      assignees:
        assigneeIds === undefined
          ? undefined
          : { deleteMany: {}, create: assigneeIds.map((userId) => ({ userId })) },
    },
    include: taskDetailInclude,
  });

  const activities: Promise<unknown>[] = [];
  if (data.title !== undefined && data.title !== before.title) {
    activities.push(
      logActivity({ taskId: before.id, projectId, userId: req.userId!, type: "TITLE_CHANGED" })
    );
  }
  if (data.description !== undefined && data.description !== before.description) {
    activities.push(
      logActivity({ taskId: before.id, projectId, userId: req.userId!, type: "DESCRIPTION_CHANGED" })
    );
  }
  if (data.priority !== undefined && data.priority !== before.priority) {
    activities.push(
      logActivity({
        taskId: before.id,
        projectId,
        userId: req.userId!,
        type: "PRIORITY_CHANGED",
        metadata: { from: before.priority, to: data.priority },
      })
    );
  }
  if (data.dueDate !== undefined) {
    activities.push(
      logActivity({ taskId: before.id, projectId, userId: req.userId!, type: "DUE_DATE_CHANGED" })
    );
  }
  if (data.sectionId !== undefined && data.sectionId !== before.sectionId) {
    activities.push(
      logActivity({ taskId: before.id, projectId, userId: req.userId!, type: "SECTION_CHANGED" })
    );
  }
  if (data.completed !== undefined && data.completed !== before.completed) {
    activities.push(
      logActivity({
        taskId: before.id,
        projectId,
        userId: req.userId!,
        type: data.completed ? "TASK_COMPLETED" : "TASK_REOPENED",
      })
    );
    if (data.completed) {
      const recipients = new Set(updated.followers.map((f) => f.user.id));
      for (const a of updated.assignees) recipients.add(a.user.id);
      recipients.delete(req.userId!);
      await notifyMany(
        [...recipients].map((recipientId) => ({
          recipientId,
          actorId: req.userId,
          type: "TASK_COMPLETED" as const,
          message: `"${updated.title}" was marked complete`,
          taskId: updated.id,
          projectId,
        }))
      );
    }
  }
  if (assigneeIds !== undefined) {
    const beforeSet = new Set(beforeAssigneeIds);
    const afterSet = new Set(assigneeIds);
    const added = assigneeIds.filter((id) => !beforeSet.has(id));
    const removed = beforeAssigneeIds.filter((id) => !afterSet.has(id));

    if (added.length || removed.length) {
      activities.push(
        logActivity({
          taskId: before.id,
          projectId,
          userId: req.userId!,
          type: added.length ? "TASK_ASSIGNED" : "TASK_UNASSIGNED",
          metadata: { added, removed },
        })
      );
    }
    await notifyMany(
      added
        .filter((id) => id !== req.userId)
        .map((recipientId) => ({
          recipientId,
          actorId: req.userId,
          type: "TASK_ASSIGNED" as const,
          message: `You were assigned to "${updated.title}"`,
          taskId: updated.id,
          projectId,
        }))
    );
  }
  await Promise.all(activities);

  emitToProject(projectId, "task:updated", updated);
  res.json(updated);
});

router.delete("/:taskId", requireTaskAccess, async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.taskId } });
  emitToProject(req.task!.projectId, "task:deleted", { id: req.params.taskId });
  res.status(204).send();
});

// ── Reordering (drag-and-drop) ──────────────────────────────

router.post("/reorder", async (req, res) => {
  const schema = z.object({
    projectId: z.string(),
    items: z.array(z.object({ id: z.string(), sectionId: z.string().nullable(), order: z.number() })),
  });
  const { projectId, items } = schema.parse(req.body);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new ApiError(404, "Project not found");
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: req.userId! } },
  });
  if (!membership) throw new ApiError(403, "You do not have access to this project");
  await assertProjectVisible(project, req.userId!, membership.role);

  await prisma.$transaction(
    items.map((item) =>
      prisma.task.update({
        where: { id: item.id },
        data: { sectionId: item.sectionId, order: item.order },
      })
    )
  );

  emitToProject(projectId, "task:reordered", { items });
  res.status(204).send();
});

// ── Subtasks ─────────────────────────────────────────────────

router.post("/:taskId/subtasks", requireTaskAccess, async (req, res) => {
  const schema = z.object({ title: z.string().min(1).max(300) });
  const { title } = schema.parse(req.body);
  const parent = req.task!;

  const last = await prisma.task.findFirst({
    where: { parentTaskId: parent.id },
    orderBy: { order: "desc" },
  });

  const subtask = await prisma.task.create({
    data: {
      title,
      projectId: parent.projectId,
      parentTaskId: parent.id,
      sectionId: parent.sectionId,
      createdById: req.userId!,
      order: (last?.order ?? -1) + 1,
      followers: { create: { userId: req.userId! } },
    },
    include: { assignees: assigneesInclude },
  });

  await logActivity({
    taskId: parent.id,
    projectId: parent.projectId,
    userId: req.userId!,
    type: "SUBTASK_ADDED",
    metadata: { subtaskId: subtask.id, title: subtask.title },
  });

  emitToProject(parent.projectId, "task:subtask-added", { parentId: parent.id, subtask });
  res.status(201).json(subtask);
});

// ── Comments ─────────────────────────────────────────────────

const commentInclude = {
  user: personSelect,
  mentions: { include: { user: personSelect } },
} as const;

router.get("/:taskId/comments", requireTaskAccess, async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { taskId: req.params.taskId },
    include: commentInclude,
    orderBy: { createdAt: "asc" },
  });
  res.json(comments);
});

router.post("/:taskId/comments", requireTaskAccess, async (req, res) => {
  const schema = z.object({
    content: z.string().min(1).max(3000),
    parentCommentId: z.string().optional(),
    mentionedUserIds: z.array(z.string()).max(20).optional(),
  });
  const { content, parentCommentId, mentionedUserIds } = schema.parse(req.body);
  const task = req.task!;

  let parentComment = null;
  if (parentCommentId) {
    parentComment = await prisma.comment.findUnique({ where: { id: parentCommentId } });
    if (!parentComment || parentComment.taskId !== task.id) {
      throw new ApiError(400, "Invalid parent comment");
    }
  }

  // Only trust mentions of people who are actually workspace members — never
  // fan out notifications based on arbitrary client-supplied user IDs.
  let validMentionIds: string[] = [];
  if (mentionedUserIds?.length) {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: task.projectId } });
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: project.workspaceId, userId: { in: mentionedUserIds } },
      select: { userId: true },
    });
    validMentionIds = members.map((m) => m.userId);
  }

  const comment = await prisma.comment.create({
    data: {
      taskId: task.id,
      userId: req.userId!,
      content,
      parentCommentId: parentComment?.id,
      mentions: { create: validMentionIds.map((userId) => ({ userId })) },
    },
    include: commentInclude,
  });

  await logActivity({
    taskId: task.id,
    projectId: task.projectId,
    userId: req.userId!,
    type: "COMMENT_ADDED",
  });

  // One notification per recipient — priority: replied-to author > mentioned > general follower/assignee.
  type CommentNotification = {
    recipientId: string;
    actorId?: string;
    type: "COMMENT_ADDED" | "MENTIONED" | "COMMENT_REPLY";
    message: string;
    taskId: string;
    projectId: string;
  };
  const notificationByRecipient = new Map<string, CommentNotification>();

  const followers = await prisma.taskFollower.findMany({ where: { taskId: task.id } });
  const assignees = await prisma.taskAssignee.findMany({ where: { taskId: task.id } });
  const followerIds = new Set(followers.map((f) => f.userId));
  for (const a of assignees) followerIds.add(a.userId);
  for (const recipientId of followerIds) {
    notificationByRecipient.set(recipientId, {
      recipientId,
      actorId: req.userId,
      type: "COMMENT_ADDED",
      message: `New comment on "${task.title}"`,
      taskId: task.id,
      projectId: task.projectId,
    });
  }

  for (const recipientId of validMentionIds) {
    notificationByRecipient.set(recipientId, {
      recipientId,
      actorId: req.userId,
      type: "MENTIONED",
      message: `You were mentioned in a comment on "${task.title}"`,
      taskId: task.id,
      projectId: task.projectId,
    });
  }

  if (parentComment) {
    notificationByRecipient.set(parentComment.userId, {
      recipientId: parentComment.userId,
      actorId: req.userId,
      type: "COMMENT_REPLY",
      message: `${comment.user.name} replied to your comment on "${task.title}"`,
      taskId: task.id,
      projectId: task.projectId,
    });
  }

  notificationByRecipient.delete(req.userId!);
  await notifyMany([...notificationByRecipient.values()]);

  emitToProject(task.projectId, "comment:new", comment);
  res.status(201).json(comment);
});

// ── Followers ────────────────────────────────────────────────

router.post("/:taskId/followers", requireTaskAccess, async (req, res) => {
  const schema = z.object({ userId: z.string().optional() });
  const { userId } = schema.parse(req.body);
  const follower = await prisma.taskFollower.create({
    data: { taskId: req.params.taskId, userId: userId ?? req.userId! },
  });
  res.status(201).json(follower);
});

router.delete("/:taskId/followers/:userId", requireTaskAccess, async (req, res) => {
  await prisma.taskFollower.delete({
    where: { taskId_userId: { taskId: req.params.taskId, userId: req.params.userId } },
  });
  res.status(204).send();
});

// ── Tags ─────────────────────────────────────────────────────

router.post("/:taskId/tags/:tagId", requireTaskAccess, async (req, res) => {
  await prisma.taskTag.create({ data: { taskId: req.params.taskId, tagId: req.params.tagId } });
  await logActivity({
    taskId: req.params.taskId,
    projectId: req.task!.projectId,
    userId: req.userId!,
    type: "TAG_ADDED",
    metadata: { tagId: req.params.tagId },
  });
  res.status(201).send();
});

router.delete("/:taskId/tags/:tagId", requireTaskAccess, async (req, res) => {
  await prisma.taskTag.delete({
    where: { taskId_tagId: { taskId: req.params.taskId, tagId: req.params.tagId } },
  });
  await logActivity({
    taskId: req.params.taskId,
    projectId: req.task!.projectId,
    userId: req.userId!,
    type: "TAG_REMOVED",
    metadata: { tagId: req.params.tagId },
  });
  res.status(204).send();
});

export default router;
