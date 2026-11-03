import { create } from "zustand";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isBootstrapping: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string | null) => void;
  updateUser: (user: User) => void;
  setBootstrapped: () => void;
  clear: () => void;
}

// The access token lives only in memory (never localStorage) — refresh is
// handled via the httpOnly refresh cookie the server sets, so a page reload
// re-derives a fresh access token instead of trusting anything client-stored.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isBootstrapping: true,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  setAccessToken: (accessToken) => set({ accessToken }),
  updateUser: (user) => set({ user }),
  setBootstrapped: () => set({ isBootstrapping: false }),
  clear: () => set({ user: null, accessToken: null }),
}));
