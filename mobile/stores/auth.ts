import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import api, { setAccessToken, setOnUnauthenticated } from '../services/api';

interface UserInfo {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'user';
}

interface AuthState {
  user: UserInfo | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

async function saveToken(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getToken(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function removeToken(key: string) {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    const { accessToken, refreshToken, user } = res.data;

    setAccessToken(accessToken);
    await saveToken('accessToken', accessToken);
    await saveToken('refreshToken', refreshToken);
    await saveToken('user', JSON.stringify(user));

    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    setAccessToken(null);
    await removeToken('accessToken');
    await removeToken('refreshToken');
    await removeToken('user');
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  restoreSession: async () => {
    try {
      const token = await getToken('accessToken');
      const userStr = await getToken('user');
      if (token && userStr) {
        setAccessToken(token);
        const user = JSON.parse(userStr);
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));

setOnUnauthenticated(() => {
  useAuthStore.getState().logout();
});
