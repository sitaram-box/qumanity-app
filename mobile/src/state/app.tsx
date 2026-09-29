/**
 * App-wide state: server address, sign-in (9-digit Private ID + PIN → token),
 * the signed-in person's profile, and the registration draft.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { currentServer, loadStoredSession, setServer as saveServer, setToken, setUnauthorizedHandler } from '@/api/client';
import type { Place } from '@/api/locations';
import * as Q from '@/api/qumanity';

export type Stage = 'loading' | 'signedOut' | 'ready';

export interface Draft {
  name: string;
  gender: 'male' | 'female' | 'both' | '';
  dob: string;
  tob: string;
  language: string;
  email: string;
  phone: string;
  pin: string;
  birth: Place[];
  present: Place[];
  donate: boolean;
  donationAmount: number;
  referralCode: string;
  referrerPin: string;
  /** Registering someone else: the helper (this phone's member) becomes their referrer. */
  helping: boolean;
  helperId: string;
  helperPin: string;
}

export const emptyDraft: Draft = {
  name: '',
  gender: '',
  dob: '',
  tob: '',
  language: 'Hindi',
  email: '',
  phone: '',
  pin: '',
  birth: [],
  present: [],
  donate: false,
  donationAmount: 0,
  referralCode: '',
  referrerPin: '',
  helping: false,
  helperId: '',
  helperPin: '',
};

interface AppState {
  stage: Stage;
  server: string;
  me: Q.Me | null;
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  resetDraft: () => void;
  setServer: (url: string) => Promise<void>;
  signIn: (privateId: string, pin: string) => Promise<void>;
  /** After registration or a PIN change, the website hands over a fresh token. */
  acceptToken: (token: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>('loading');
  const [server, setServerState] = useState(currentServer());
  const [me, setMe] = useState<Q.Me | null>(null);
  const [draft, setDraftState] = useState<Draft>(emptyDraft);

  const signOut = useCallback(async () => {
    await setToken(null);
    setMe(null);
    setStage('signedOut');
  }, []);

  const loadMe = useCallback(async () => {
    const profile = await Q.me();
    setMe(profile);
    setStage('ready');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
    });
    loadStoredSession().then(async ({ token, server: s }) => {
      setServerState(s);
      if (!token) return setStage('signedOut');
      try {
        await loadMe();
      } catch {
        setStage('signedOut'); // offline or token expired: sign in again
      }
    });
  }, [loadMe, signOut]);

  const value = useMemo<AppState>(
    () => ({
      stage,
      server,
      me,
      draft,
      setDraft: (patch) => setDraftState((d) => ({ ...d, ...patch })),
      resetDraft: () => setDraftState(emptyDraft),
      setServer: async (url) => {
        await saveServer(url);
        setServerState(currentServer());
      },
      signIn: async (privateId, pin) => {
        const { token } = await Q.login(privateId, pin);
        await setToken(token);
        await loadMe();
      },
      acceptToken: async (token) => {
        await setToken(token);
        await loadMe();
      },
      refreshMe: loadMe,
      signOut,
    }),
    [stage, server, me, draft, loadMe, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
