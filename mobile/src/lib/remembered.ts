/**
 * The Private ID remembered on this phone ("Remember my Private ID on this device" at sign-in).
 * Only the 9-digit ID is stored — never the PIN. Also used to pre-fill the helper when a member
 * registers someone else on their phone.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REMEMBER_KEY = 'qm_remembered_id';

export async function rememberedId(): Promise<string | null> {
  try {
    return Platform.OS === 'web' ? globalThis.localStorage?.getItem(REMEMBER_KEY) ?? null : await SecureStore.getItemAsync(REMEMBER_KEY);
  } catch {
    return null;
  }
}

export async function setRememberedId(value: string | null) {
  try {
    if (Platform.OS === 'web') {
      if (value === null) globalThis.localStorage?.removeItem(REMEMBER_KEY);
      else globalThis.localStorage?.setItem(REMEMBER_KEY, value);
    } else if (value === null) {
      await SecureStore.deleteItemAsync(REMEMBER_KEY);
    } else {
      await SecureStore.setItemAsync(REMEMBER_KEY, value);
    }
  } catch {
    // best-effort only
  }
}

// The 12-digit Public ID (search code) of the member last signed in on this phone. Public by
// design (it's the ID people share to be found), so keeping it is safe; it pre-fills "Referred By"
// when someone registers on this phone (website referral engine, 2026-10-25).
const PUBLIC_ID_KEY = 'qm_public_id';

export async function rememberedPublicId(): Promise<string | null> {
  try {
    return Platform.OS === 'web' ? globalThis.localStorage?.getItem(PUBLIC_ID_KEY) ?? null : await SecureStore.getItemAsync(PUBLIC_ID_KEY);
  } catch {
    return null;
  }
}

export async function setRememberedPublicId(value: string) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(PUBLIC_ID_KEY, value);
    else await SecureStore.setItemAsync(PUBLIC_ID_KEY, value);
  } catch {
    // best-effort only
  }
}
