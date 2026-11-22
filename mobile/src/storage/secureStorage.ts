import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Small key/value persistence. Uses the device keychain/keystore through
 * expo-secure-store on iOS/Android, and localStorage on web (where SecureStore
 * is unavailable). Every call is failure-tolerant: storage problems never crash the app.
 */
const isWeb = Platform.OS === 'web';

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    try {
      if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      if (isWeb) globalThis.localStorage?.setItem(key, value);
      else await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore: persistence is best-effort
    }
  },

  async remove(key: string): Promise<void> {
    try {
      if (isWeb) globalThis.localStorage?.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  },
};

export const STORAGE_KEYS = {
  session: 'libtrack.session.v1',
  themeMode: 'libtrack.theme-mode.v1',
} as const;
