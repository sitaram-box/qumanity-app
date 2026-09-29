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
