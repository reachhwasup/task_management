import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { verifyAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { canAccessProject } from "../middleware/access";

/** Same visibility rule as the HTTP middleware: workspace member + team/project membership. */
async function canJoinProject(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return false;
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
  });
  if (!membership) return false;
  return canAccessProject(project, userId, membership.role);
}

let io: SocketIOServer | undefined;

export function initSockets(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("Not authenticated"));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(userRoom(userId));

    socket.on("project:join", async (projectId: string) => {
      if (await canJoinProject(projectId, userId)) {
        socket.join(projectRoom(projectId));
      }
    });

    socket.on("project:leave", (projectId: string) => {
      socket.leave(projectRoom(projectId));
    });
  });

  return io;
}

export function getIO(): SocketIOServer | undefined {
  return io;
}

export const userRoom = (userId: string) => `user:${userId}`;
export const projectRoom = (projectId: string) => `project:${projectId}`;

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(userRoom(userId)).emit(event, payload);
}

export function emitToProject(projectId: string, event: string, payload: unknown) {
  io?.to(projectRoom(projectId)).emit(event, payload);
}
