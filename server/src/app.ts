import "express-async-errors";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { requireAuth } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

import authRoutes from "./routes/auth.routes";
import workspaceRoutes from "./routes/workspace.routes";
import teamRoutes from "./routes/team.routes";
import projectRoutes from "./routes/project.routes";
import taskRoutes from "./routes/task.routes";
import notificationRoutes from "./routes/notification.routes";
import userRoutes from "./routes/user.routes";
import inviteRoutes from "./routes/invite.routes";

export function createApp() {
  const app = express();

  // Behind a reverse proxy (nginx, Railway, Render, …) Express must trust
  // X-Forwarded-* headers, or `secure` cookies are never sent back.
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(
    cors({
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());
  if (process.env.NODE_ENV !== "test") {
    app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  }

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRoutes);

  // Everything below requires a valid access token.
  app.use("/api/workspaces", requireAuth, workspaceRoutes);
  app.use("/api/teams", requireAuth, teamRoutes);
  app.use("/api/projects", requireAuth, projectRoutes);
  app.use("/api/tasks", requireAuth, taskRoutes);
  app.use("/api/notifications", requireAuth, notificationRoutes);
  app.use("/api/users", requireAuth, userRoutes);
  app.use("/api/invites", requireAuth, inviteRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
