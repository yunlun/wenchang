import { create } from 'zustand';
import { authApi } from '@/lib/api';

interface AuthUser {
  _id: string;
  email: string;
  name: string;
  studioName?: string;
  plan: string;
  usageCount: number;
  usageLimit: number;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('wc_token') : null,
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.login({ email, password });
      const { token, user } = data.data;
      localStorage.setItem('wc_token', token);
      set({ token, user, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  logout: () => {
    localStorage.removeItem('wc_token');
    set({ user: null, token: null });
  },

  fetchMe: async () => {
    try {
      const { data } = await authApi.me();
      set({ user: data.data });
    } catch {
      set({ user: null, token: null });
    }
  },
}));

