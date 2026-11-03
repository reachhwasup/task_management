import { Request, Response, NextFunction } from "express";
import { Project, WorkspaceRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "./errorHandler";

/**
 * Visibility follows where the project lives:
 *  - team project → visible to that team's members, explicitly added project
 *    members, and workspace OWNER/ADMIN (management oversight)
 *  - personal project (no team) → strictly its project members, with NO admin
 *    bypass: personal means personal
 */
export async function canAccessProject(
  project: Project,
  userId: string,
  role: WorkspaceRole
): Promise<boolean> {
  const projectMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId } },
  });
  if (projectMember) return true;
  if (!project.teamId) return false;

  if (role === "OWNER" || role === "ADMIN") return true;
  const teamMember = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: project.teamId, userId } },
  });
  return !!teamMember;
}

export async function assertProjectVisible(project: Project, userId: string, role: WorkspaceRole) {
  if (!(await canAccessProject(project, userId, role))) {
    throw new ApiError(403, "You do not have access to this project");
  }
}

/**
 * Loads the workspace membership for req.params.workspaceId and attaches it
 * as req.workspaceRole. Every route that reads/writes workspace-scoped data
 * (teams, projects, tags) sits behind this so access is always workspace-first,
 * matching how Asana scopes almost everything to an organization/workspace.
 */
export async function requireWorkspaceMember(req: Request, res: Response, next: NextFunction) {
  const workspaceId = req.params.workspaceId;
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: req.userId! } },
  });
  if (!membership) throw new ApiError(403, "You are not a member of this workspace");
  req.workspaceRole = membership.role;
  next();
}

export function requireWorkspaceAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.workspaceRole !== "OWNER" && req.workspaceRole !== "ADMIN") {
    throw new ApiError(403, "Admin permission required");
  }
  next();
}

/**
 * Loads the project by req.params.projectId, verifies the requester belongs
 * to the project's workspace, and attaches both to the request.
 */
export async function requireProjectAccess(req: Request, res: Response, next: NextFunction) {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) throw new ApiError(404, "Project not found");

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: req.userId! } },
  });
  if (!membership) throw new ApiError(403, "You do not have access to this project");
  await assertProjectVisible(project, req.userId!, membership.role);

  req.project = project;
  req.workspaceRole = membership.role;
  next();
}

/**
 * Loads the task by req.params.taskId, then verifies workspace access through
 * its parent project, attaching both to the request.
 */
export async function requireTaskAccess(req: Request, res: Response, next: NextFunction) {
  const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
  if (!task) throw new ApiError(404, "Task not found");

  const project = await prisma.project.findUnique({ where: { id: task.projectId } });
  if (!project) throw new ApiError(404, "Project not found");

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: req.userId! } },
  });
  if (!membership) throw new ApiError(403, "You do not have access to this task");
  await assertProjectVisible(project, req.userId!, membership.role);

  req.task = task;
  req.project = project;
  req.workspaceRole = membership.role;
  next();
}
