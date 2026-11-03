import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { PendingWorkspaceInvite, WorkspaceInvite } from "../types";

export function useMyInvites() {
  return useQuery({
    queryKey: ["invites", "me"],
    queryFn: async () => (await api.get<WorkspaceInvite[]>("/invites/me")).data,
  });
}

export function useWorkspaceInvites(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["invites", "workspace", workspaceId],
    queryFn: async () =>
      (await api.get<PendingWorkspaceInvite[]>(`/workspaces/${workspaceId}/invites`)).data,
    enabled: !!workspaceId,
  });
}

function invalidateAfterResponse(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["invites"] });
  qc.invalidateQueries({ queryKey: ["notifications"] });
  qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  qc.invalidateQueries({ queryKey: ["workspaces"] });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) =>
      (await api.post<{ workspaceId: string }>(`/invites/${inviteId}/accept`)).data,
    onSuccess: () => invalidateAfterResponse(qc),
  });
}

export function useDeclineInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => api.post(`/invites/${inviteId}/decline`),
    onSuccess: () => invalidateAfterResponse(qc),
  });
}

// ── Project invites ──────────────────────────────────────────

export function useAcceptProjectInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) =>
      (await api.post<{ projectId: string; workspaceId: string }>(`/invites/projects/${inviteId}/accept`)).data,
    onSuccess: () => {
      invalidateAfterResponse(qc);
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useDeclineProjectInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => api.post(`/invites/projects/${inviteId}/decline`),
    onSuccess: () => invalidateAfterResponse(qc),
  });
}

// ── Team invites ─────────────────────────────────────────────

export function useAcceptTeamInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) =>
      (await api.post<{ teamId: string; workspaceId: string }>(`/invites/teams/${inviteId}/accept`)).data,
    onSuccess: () => {
      invalidateAfterResponse(qc);
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useDeclineTeamInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => api.post(`/invites/teams/${inviteId}/decline`),
    onSuccess: () => invalidateAfterResponse(qc),
  });
}
