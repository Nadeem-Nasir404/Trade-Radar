import { create } from "zustand";
import type { User } from "../api/types";

interface AuthState {
  status: "loading" | "authenticated" | "unauthenticated";
  user: User | null;
  setAuthenticated: (user: User) => void;
  setUnauthenticated: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  user: null,
  setAuthenticated: (user) => set({ status: "authenticated", user }),
  setUnauthenticated: () => set({ status: "unauthenticated", user: null }),
}));
