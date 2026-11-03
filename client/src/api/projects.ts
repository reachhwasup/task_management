import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Project, Section, Task } from "../types";

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await api.get<Project>(`/projects/${projectId}`)).data,
    enabled: !!projectId,
  });
}

export function useUpdateProject(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<Pick<Project, "name" | "description" | "color" | "icon" | "archived" | "teamId">>
    ) => (await api.patch<Project>(`/projects/${projectId}`, input)).data,
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects", updated.workspaceId] });
      qc.invalidateQueries({ queryKey: ["teams", updated.workspaceId] });
    },
  });
}

export function useDeleteProject(projectId: string, workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => api.delete(`/projects/${projectId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", workspaceId] });
      qc.invalidateQueries({ queryKey: ["teams", workspaceId] });
    },
  });
}

export function useCreateSection(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      (await api.post<Section>(`/projects/${projectId}/sections`, { name })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });
}

export function useUpdateSection(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sectionId, ...input }: { sectionId: string; name?: string; order?: number }) =>
      (await api.patch<Section>(`/projects/sections/${sectionId}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });
}

export function useDeleteSection(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sectionId: string) => api.delete(`/projects/sections/${sectionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });
}

export function useAddProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => (await api.post(`/projects/${projectId}/members`, { email })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });
}

export function useRemoveProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => api.delete(`/projects/${projectId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });
}

export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () => (await api.get<Task[]>(`/projects/${projectId}/tasks`)).data,
    enabled: !!projectId,
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      sectionId?: string;
      assigneeIds?: string[];
      priority?: Task["priority"];
      dueDate?: string;
      startDate?: string;
    }) => (await api.post<Task>(`/projects/${projectId}/tasks`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
}
