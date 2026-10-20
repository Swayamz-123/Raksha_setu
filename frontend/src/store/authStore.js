import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (payload) => {
        if (payload && payload.user) {
          set({
            user: payload.user,
            accessToken: payload.accessToken || null,
            refreshToken: payload.refreshToken || null
          });
          return;
        }
        set({ user: payload || null });
      },
      logout: () => set({ user: null, accessToken: null, refreshToken: null })
    }),
    { name: 'RakshaSetu-auth' }
  )
);
