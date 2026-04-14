import axios from 'axios';
import { Platform } from 'react-native';

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

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export function getUploadsUrl(filename: string): string {
  return `${BASE_URL}/uploads/${filename}`;
}

export default api;
