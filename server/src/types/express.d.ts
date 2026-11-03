import "express";
import { Project, Task, WorkspaceRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      workspaceRole?: WorkspaceRole;
      project?: Project;
      task?: Task;
    }
  }
}

export {};
