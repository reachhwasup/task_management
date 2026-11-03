import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { recipientId: req.userId },
    include: { actor: { select: { id: true, name: true, avatarColor: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(notifications);
});

router.get("/unread-count", async (req, res) => {
  const count = await prisma.notification.count({
    where: { recipientId: req.userId, read: false },
  });
  res.json({ count });
});

router.patch("/:notificationId/read", async (req, res) => {
  const notification = await prisma.notification.updateMany({
    where: { id: req.params.notificationId, recipientId: req.userId },
    data: { read: true },
  });
  res.json({ updated: notification.count });
});

router.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({
    where: { recipientId: req.userId, read: false },
    data: { read: true },
  });
  res.status(204).send();
});

export default router;
