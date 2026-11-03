import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Project, Tag, Team, Workspace, WorkspaceMember } from "../types";

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => (await api.get<Workspace[]>("/workspaces")).data,
  });
}

export function useWorkspace(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: async () => (await api.get<Workspace>(`/workspaces/${workspaceId}`)).data,
    enabled: !!workspaceId,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => (await api.post<Workspace>("/workspaces", { name })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: async () =>
      (await api.get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`)).data,
    enabled: !!workspaceId,
  });
}

export function useAddWorkspaceMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) =>
      (await api.post(`/workspaces/${workspaceId}/members`, { email })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      qc.invalidateQueries({ queryKey: ["invites", "workspace", workspaceId] });
    },
  });
}

export function useRemoveWorkspaceMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      api.delete(`/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-members", workspaceId] }),
  });
}

export function useWorkspaceTeams(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["teams", workspaceId],
    queryFn: async () => (await api.get<Team[]>(`/workspaces/${workspaceId}/teams`)).data,
    enabled: !!workspaceId,
  });
}

export function useCreateTeam(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) =>
      (await api.post<Team>(`/workspaces/${workspaceId}/teams`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
    },
  });
}

export function useWorkspaceProjects(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: async () => (await api.get<Project[]>(`/workspaces/${workspaceId}/projects`)).data,
    enabled: !!workspaceId,
  });
}

export function useCreateProject(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; color?: string; teamId?: string }) =>
      (await api.post<Project>(`/workspaces/${workspaceId}/projects`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      qc.invalidateQueries({ queryKey: ["teams", workspaceId] });
    },
  });
}

export function useWorkspaceTags(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["tags", workspaceId],
    queryFn: async () => (await api.get<Tag[]>(`/workspaces/${workspaceId}/tags`)).data,
    enabled: !!workspaceId,
  });
}

export function useCreateTag(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string }) =>
      (await api.post<Tag>(`/workspaces/${workspaceId}/tags`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags", workspaceId] }),
  });
}
