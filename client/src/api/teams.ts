import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Team } from "../types";

export function useTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: ["team", teamId],
    queryFn: async () => (await api.get<Team>(`/teams/${teamId}`)).data,
    enabled: !!teamId,
  });
}

export function useAddTeamMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => (await api.post(`/teams/${teamId}/members`, { email })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", teamId] }),
  });
}

export function useRemoveTeamMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => api.delete(`/teams/${teamId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", teamId] }),
  });
}

export function useUpdateTeam(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name?: string; description?: string | null }) =>
      (await api.patch<Team>(`/teams/${teamId}`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team", teamId] });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useDeleteTeam(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => api.delete(`/teams/${teamId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      // Team projects become standalone on delete, so refresh project lists too.
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
