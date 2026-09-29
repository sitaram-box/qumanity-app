/** Only a real "sign in again" may sign the person out — never a missing route on an older website. */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({ default: { expoConfig: { hostUri: '192.168.1.20:8081' } } }));
vi.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

const page = (body: string, status: number, url = 'http://192.168.1.20:5050/api/x') =>
  ({ status, ok: status < 400, url, text: async () => body }) as unknown as Response;

describe('api() sign-out rule', () => {
  let C: typeof import('../client');
  const onUnauthorized = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    C = await import('../client');
    await C.setToken('t');
    onUnauthorized.mockReset();
    C.setUnauthorizedHandler(onUnauthorized);
  });

  it('a 404 web page (route missing on an older website) is an error, not a sign-out', async () => {
    globalThis.fetch = vi.fn(async () => page('<!doctype html><html><title>404 Not Found</title></html>', 404));
    await expect(C.api('/api/onboarding')).rejects.toMatchObject({ status: 404 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('a 401 signs out', async () => {
    globalThis.fetch = vi.fn(async () => page('{"error":"Please sign in again"}', 401));
    await expect(C.api('/api/me')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("being sent to the website's login page signs out", async () => {
    globalThis.fetch = vi.fn(async () => page('<html><form id="login-form" class="qm-form"></form></html>', 200, 'http://192.168.1.20:5050/login'));
    await expect(C.api('/api/me')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('JSON comes through', async () => {
    globalThis.fetch = vi.fn(async () => page('{"tour":null,"review_done":false}', 200));
    await expect(C.api('/api/onboarding')).resolves.toEqual({ tour: null, review_done: false });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
