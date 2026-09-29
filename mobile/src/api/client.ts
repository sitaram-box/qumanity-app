/**
 * HTTP client for the Qumanity website API (Desktop/Qumanity_DPG, Flask).
 * The website is the one backend for web and phone: same accounts, wallets,
 * boards, chats and 0_Earth folders. The app signs in with the 9-digit
 * Private ID + PIN and sends the returned token as "Authorization: Bearer".
 *
 * Testing phase: phone and Mac on the same Wi-Fi. The server address defaults
 * to the Mac that serves the Expo bundle (port 5050) and can be changed on the
 * sign-in screen.
 */

import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'qm_token';
const SERVER_KEY = 'qm_server';
export const WEBSITE_PORT = 5050;

let token: string | null = null;
let server: string | null = null;
let onUnauthorized: (() => void) | null = null;

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** The Mac's address as seen by Expo (e.g. "192.168.1.20:8081") → http://192.168.1.20:5050 */
export function guessServer(): string {
  const hostUri = Constants.expoConfig?.hostUri ?? '';
  const host = hostUri.split(':')[0];
  if (host) return `http://${host}:${WEBSITE_PORT}`;
  return Platform.OS === 'android' ? `http://10.0.2.2:${WEBSITE_PORT}` : `http://localhost:${WEBSITE_PORT}`;
}

async function stored(key: string): Promise<string | null> {
  try {
    return Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) ?? null : await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function store(key: string, value: string | null) {
  try {
    if (Platform.OS === 'web') {
      if (value === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, value);
    } else if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // Storage can fail (private mode, keystore reset); the app still works for this launch.
  }
}

export async function loadStoredSession(): Promise<{ token: string | null; server: string }> {
  token = await stored(TOKEN_KEY);
  server = (await stored(SERVER_KEY)) ?? guessServer();
  return { token, server };
}

export function currentServer(): string {
  return server ?? guessServer();
}

export async function setServer(url: string) {
  server = url.replace(/\/+$/, '');
  await store(SERVER_KEY, server);
}

export async function setToken(t: string | null) {
  token = t;
  await store(TOKEN_KEY, t);
}

export function hasToken(): boolean {
  return !!token;
}

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function api<T>(path: string, options: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  let res: Response;
  try {
    res = await fetch(`${currentServer()}${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      credentials: 'omit',
    });
  } catch {
    throw new ApiError(`Cannot reach Qumanity at ${currentServer()}. Is the Mac on the same Wi-Fi and the website running?`, 0);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON: the website sent a page (usually the login redirect).
  }
  // Sign out only when the website really says so: a 401, or it sent us to its login page.
  // Any other web page (e.g. a 404 because the running website is older than the app) is an
  // ordinary error — it must never throw the person out of the app.
  const isLoginPage = data === null && (/\/login(\?|$)/.test(res.url ?? '') || /id="login-form"/.test(text));
  if (res.status === 401 || isLoginPage) {
    if (token) onUnauthorized?.();
    throw new ApiError((data as { error?: string } | null)?.error ?? 'Please sign in again.', 401);
  }
  if (data === null && /<html/i.test(text)) {
    throw new ApiError(
      res.status === 404 ? 'This needs the latest Qumanity website — please restart the website on the Mac.' : `Something went wrong (${res.status}).`,
      res.status,
    );
  }
  if (!res.ok) {
    throw new ApiError((data as { error?: string } | null)?.error ?? `Something went wrong (${res.status}).`, res.status);
  }
  return data as T;
}
