import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useConnectivityStore } from '../stores/connectivity';

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

function isNetworkError(error: any): boolean {
  // Axios sets `error.response` only when the server actually answered.
  // Missing response + a network-level code/message means we couldn't reach
  // the backend at all (server down, no internet, DNS failure, timeout, ...).
  if (error?.response) return false;
  const code = error?.code;
  const message: string = error?.message || '';
  return (
    code === 'ECONNABORTED'
    || code === 'ERR_NETWORK'
    || code === 'ENOTFOUND'
    || code === 'ECONNREFUSED'
    || code === 'ETIMEDOUT'
    || message === 'Network Error'
    || message.toLowerCase().includes('network request failed')
  );
}

api.interceptors.response.use(
  (response) => {
    useConnectivityStore.getState().setOffline(false);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (isNetworkError(error)) {
      useConnectivityStore.getState().setOffline(true);
      return Promise.reject(error);
    }

    // We did get a response from the server (even an error one), so the
    // backend is reachable.
    useConnectivityStore.getState().setOffline(false);

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
        } catch (refreshErr) {
          if (isNetworkError(refreshErr)) {
            useConnectivityStore.getState().setOffline(true);
            return Promise.reject(refreshErr);
          }
          // refresh failed — fall through to logout
        }
      }

      onUnauthenticated?.();
    }

    return Promise.reject(error);
  }
);

/**
 * Lightweight backend reachability probe used by the offline banner's
 * "Try again" button and the periodic watchdog. Returns `true` when the
 * server responds (even with an error status), `false` only on network
 * failure / timeout. Updates the connectivity store as a side-effect.
 */
export async function pingHealth(timeoutMs: number = 5000): Promise<boolean> {
  const store = useConnectivityStore.getState();
  store.setChecking(true);
  try {
    await axios.get(`${BASE_URL}/api/health`, { timeout: timeoutMs });
    store.setOffline(false);
    return true;
  } catch (err) {
    if (isNetworkError(err)) {
      store.setOffline(true);
      return false;
    }
    // Server responded with some HTTP error - it IS reachable.
    store.setOffline(false);
    return true;
  } finally {
    useConnectivityStore.getState().setChecking(false);
  }
}

export function getUploadsUrl(filename: string): string {
  return `${BASE_URL}/uploads/${filename}`;
}

export default api;
