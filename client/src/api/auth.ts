import { useMutation } from "@tanstack/react-query";
import { api } from "./client";
import { useAuthStore } from "../store/auth.store";
import type { User } from "../types";

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput extends LoginInput {
  name: string;
  workspaceName?: string;
}

interface AuthResponse {
  user: User;
  accessToken: string;
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const { data } = await api.post<AuthResponse>("/auth/login", input);
      return data;
    },
    onSuccess: (data) => setAuth(data.user, data.accessToken),
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      const { data } = await api.post<AuthResponse>("/auth/register", input);
      return data;
    },
    onSuccess: (data) => setAuth(data.user, data.accessToken),
  });
}

export function useGoogleAuth() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (credential: string) => {
      const { data } = await api.post<AuthResponse>("/auth/google", { credential });
      return data;
    },
    onSuccess: (data) => setAuth(data.user, data.accessToken),
  });
}

export interface UpdateProfileInput {
  name?: string;
  avatarColor?: string;
}

export function useUpdateProfile() {
  const updateUser = useAuthStore((s) => s.updateUser);
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const { data } = await api.patch<{ user: User }>("/auth/me", input);
      return data.user;
    },
    onSuccess: (user) => updateUser(user),
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  return useMutation({
    mutationFn: async () => {
      await api.post("/auth/logout");
    },
    onSettled: () => clear(),
  });
}
