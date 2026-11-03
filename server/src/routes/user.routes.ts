import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

const taskCardInclude = {
  assignees: {
    select: { user: { select: { id: true, name: true, avatarColor: true, avatarUrl: true } } },
  },
  project: { select: { id: true, name: true, color: true, workspaceId: true } },
  tags: { include: { tag: true } },
} as const;

// "My Tasks": every task assigned to me across every workspace I belong to,
// mirroring Asana's cross-project My Tasks list.
router.get("/me/tasks", async (req, res) => {
  const completed = req.query.completed === "true";
  const tasks = await prisma.task.findMany({
    where: { assignees: { some: { userId: req.userId } }, completed },
    include: taskCardInclude,
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });
  res.json(tasks);
});

// Tasks due within the next 7 days (or overdue), for a "coming up" widget.
router.get("/me/upcoming", async (req, res) => {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const tasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId: req.userId } },
      completed: false,
      dueDate: { lte: in7Days },
    },
    include: taskCardInclude,
    orderBy: { dueDate: "asc" },
  });
  res.json(tasks);
});

export default router;
