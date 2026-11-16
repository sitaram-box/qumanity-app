/**
 * "A new version of Qumanity is available." — the sideloaded APK can't update itself, so on launch
 * the app asks the website which version is current (GET /api/app-version, public, no login) and,
 * if that is newer than this build's own version (app.json expo.version), shows a small dismissible
 * card at the top: "Update Now" opens the download page in the browser, "Later" hides it until the
 * app is next opened. Never forces anything.
 *
 * Any failure (offline, server down, odd response) is silent: no banner, no error; the next launch
 * simply checks again. The comparison and the link check are in updateCheck.logic.ts (unit-tested).
 */

import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currentServer } from '@/api/client';
import { colors, fonts, radius, space } from '@/theme';
import { isNewer, safeDownloadUrl } from './updateCheck.logic';

const TIMEOUT_MS = 8000;

export function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    (async () => {
      try {
        // Production builds always talk to https://qumanity.in (api/client.ts defaultServer()).
        const res = await fetch(`${currentServer()}/api/app-version`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { latest_version?: unknown; download_url?: unknown };
        const latest = typeof data.latest_version === 'string' ? data.latest_version : null;
        if (isNewer(latest, Constants.expoConfig?.version)) setDownloadUrl(safeDownloadUrl(data.download_url));
      } catch {
        // Offline / server down / not JSON: skip the check silently; next launch tries again.
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  if (!downloadUrl) return null;

  return (
    <View style={[styles.wrap, { top: insets.top + space.sm }]} pointerEvents="box-none">
      <View style={styles.card} accessibilityRole="alert">
        <Text style={styles.text}>A new version of Qumanity is available.</Text>
        <View style={styles.actions}>
          <Pressable onPress={() => setDownloadUrl(null)} style={styles.later} accessibilityRole="button" accessibilityLabel="Later" hitSlop={6}>
            <Text style={styles.laterText}>Later</Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(downloadUrl).catch(() => undefined)}
            style={styles.update}
            accessibilityRole="button"
            accessibilityLabel="Update now: opens the download page"
            hitSlop={6}
          >
            <Text style={styles.updateText}>Update Now</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md, zIndex: 100, elevation: 12 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: space.md,
    gap: space.sm,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  text: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  later: { height: 34, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  laterText: { color: colors.dim, fontFamily: fonts.medium, fontSize: 13 },
  update: { height: 34, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.gold },
  updateText: { color: colors.onAccent, fontFamily: fonts.bold, fontSize: 13 },
});
