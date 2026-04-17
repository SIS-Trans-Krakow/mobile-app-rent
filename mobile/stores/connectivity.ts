import { create } from 'zustand';

interface ConnectivityState {
  isOffline: boolean;
  isChecking: boolean;
  lastCheckedAt: number | null;
  retryToken: number;

  setOffline: (offline: boolean) => void;
  setChecking: (checking: boolean) => void;
  triggerRetry: () => void;
}

/**
 * Tracks reachability of the backend API.
 *
 * `isOffline` flips to `true` when an axios request fails with a network-level
 * error (no response from the server, timeout, DNS failure, etc.). Successful
 * responses (or any HTTP error from the server itself) flip it back to `false`,
 * because they prove the backend is reachable.
 *
 * Screens that load data should re-fetch when `retryToken` changes so the
 * "Try again" button on the offline banner can refresh stale screens.
 */
export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  isOffline: false,
  isChecking: false,
  lastCheckedAt: null,
  retryToken: 0,

  setOffline: (offline: boolean) => {
    const wasOffline = get().isOffline;
    set({ lastCheckedAt: Date.now(), isOffline: offline });
    // When we recover, bump retryToken so subscribers re-fetch automatically.
    if (wasOffline && !offline) {
      set((s) => ({ retryToken: s.retryToken + 1 }));
    }
  },

  setChecking: (checking: boolean) => set({ isChecking: checking }),

  triggerRetry: () => set((s) => ({ retryToken: s.retryToken + 1 })),
}));
