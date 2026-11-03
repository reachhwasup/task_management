import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../store/auth.store";
import { queryClient } from "../api/queryClient";
import { API_URL } from "../api/client";
import type { Notification, Task } from "../types";

let socket: Socket | null = null;

const WORKSPACE_LIFECYCLE_TYPES = new Set([
  "ADDED_TO_WORKSPACE",
  "WORKSPACE_INVITE",
  "WORKSPACE_INVITE_ACCEPTED",
]);

function connectSocket(token: string) {
  socket?.disconnect();
  socket = io(API_URL, { auth: { token }, withCredentials: true });

  socket.on("notification:new", (notification: Notification) => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    // Someone was invited/added/accepted — refresh the sidebar's workspace list
    // and any pending-invite views live, without waiting for a manual reload.
    if (WORKSPACE_LIFECYCLE_TYPES.has(notification.type)) {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    }
  });

  socket.on("task:created", (task: Task) => {
    queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
  });
  socket.on("task:updated", (task: Task) => {
    queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
    queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
  });
  socket.on("task:deleted", () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  });
  socket.on("task:reordered", (payload: { items: { id: string }[] }) => {
    payload.items.forEach((item) => queryClient.invalidateQueries({ queryKey: ["task", item.id] }));
  });
  socket.on("task:subtask-added", ({ parentId }: { parentId: string }) => {
    queryClient.invalidateQueries({ queryKey: ["task", parentId] });
  });
  socket.on("comment:new", () => {
    queryClient.invalidateQueries({ queryKey: ["task"] });
  });
  socket.on("activity:new", () => {
    queryClient.invalidateQueries({ queryKey: ["task"] });
  });

  return socket;
}

/** Connects the realtime socket once we have an access token; disconnects on logout. */
export function useRealtimeConnection() {
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) {
      socket?.disconnect();
      socket = null;
      return;
    }
    connectSocket(accessToken);
    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [accessToken]);
}

/** Joins/leaves a project's realtime room for the lifetime of a component (e.g. the project page). */
export function useProjectRoom(projectId: string | undefined) {
  const joinedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId || !socket) return;
    socket.emit("project:join", projectId);
    joinedRef.current = projectId;
    return () => {
      if (joinedRef.current) socket?.emit("project:leave", joinedRef.current);
    };
  }, [projectId]);
}
