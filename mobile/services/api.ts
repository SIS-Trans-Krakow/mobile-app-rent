import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// On Android emulator, localhost resolves to the emulator itself — 10.0.2.2 points to the host machine.
const rawUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const BASE_URL =
  Platform.OS === 'android' ? rawUrl.replace('localhost', '10.0.2.2') : rawUrl;

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

let accessToken: string | null = null;
let onUnauthenticated: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setOnUnauthenticated(fn: () => void) {
  onUnauthenticated = fn;
}

async function getStoredToken(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function saveStoredToken(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = await getStoredToken('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken });
          const newAccessToken: string = res.data.accessToken;

          setAccessToken(newAccessToken);
          await saveStoredToken('accessToken', newAccessToken);

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch {
          // refresh failed — fall through to logout
        }
      }

      onUnauthenticated?.();
    }

    return Promise.reject(error);
  }
);

export function getUploadsUrl(filename: string): string {
  return `${BASE_URL}/uploads/${filename}`;
}

export default api;
