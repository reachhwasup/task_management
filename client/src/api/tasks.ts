import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Comment, Task } from "../types";

export function useTask(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => (await api.get<Task>(`/tasks/${taskId}`)).data,
    enabled: !!taskId,
  });
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  sectionId?: string | null;
  assigneeIds?: string[];
  priority?: Task["priority"];
  dueDate?: string | null;
  startDate?: string | null;
  completed?: boolean;
  order?: number;
}

export function useUpdateTask(taskId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTaskInput) => (await api.patch<Task>(`/tasks/${taskId}`, input)).data,
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["task", updated.parentTaskId ?? undefined] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
    },
  });
}

export function useDeleteTask(taskId: string, projectId: string, parentTaskId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => api.delete(`/tasks/${taskId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      if (parentTaskId) qc.invalidateQueries({ queryKey: ["task", parentTaskId] });
    },
  });
}

export function useCreateSubtask(taskId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) => (await api.post<Task>(`/tasks/${taskId}/subtasks`, { title })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });
}

export interface AddCommentInput {
  content: string;
  parentCommentId?: string;
  mentionedUserIds?: string[];
}

export function useAddComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddCommentInput) =>
      (await api.post<Comment>(`/tasks/${taskId}/comments`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task", taskId] }),
  });
}

export function useAddTaskTag(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => api.post(`/tasks/${taskId}/tags/${tagId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task", taskId] }),
  });
}

export function useRemoveTaskTag(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => api.delete(`/tasks/${taskId}/tags/${tagId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task", taskId] }),
  });
}

export function useToggleFollow(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ follow, userId }: { follow: boolean; userId: string }) =>
      follow
        ? api.post(`/tasks/${taskId}/followers`, { userId })
        : api.delete(`/tasks/${taskId}/followers/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task", taskId] }),
  });
}

interface ReorderItem {
  id: string;
  sectionId: string | null;
  order: number;
}

export function useReorderTasks(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: ReorderItem[]) => api.post(`/tasks/reorder`, { projectId, items }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
}

export function useMyTasks(completed = false) {
  return useQuery({
    queryKey: ["my-tasks", completed],
    queryFn: async () => (await api.get<Task[]>(`/users/me/tasks`, { params: { completed } })).data,
  });
}
