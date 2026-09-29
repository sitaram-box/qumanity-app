/**
 * Persistent header for the 4 signed-in timelines: the Qumanity wordmark, a notification bell
 * (unread Personal-timeline chats + pending people-requests, polled every 30s) and a power-icon
 * Sign out button. Per the user's explicit correction, registering a new member is never offered
 * from inside the dashboard — a person must sign out first, then use Welcome's "Create my
 * Qumanity account".
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Q from '@/api/qumanity';
import { Logo } from '@/components/ui';
import { useApp } from '@/state/app';
import { colors, fonts, space } from '@/theme';

const POLL_MS = 30000;

export default function DashboardHeader() {
  const insets = useSafeAreaInsets();
  const { signOut } = useApp();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let live = true;
    const refresh = () => Q.notificationSummary().then((s) => live && setTotal(s.total), () => undefined);
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  function confirmSignOut() {
    const doSignOut = () => {
      signOut();
    };
    if (Platform.OS === 'web') {
      // Alert.alert has no buttons on web; fall back to a plain confirm.
      if (globalThis.confirm?.('Sign out of Qumanity?')) doSignOut();
      return;
    }
    Alert.alert('Sign out', 'Sign out of Qumanity on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: doSignOut },
    ]);
  }

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
      <View style={styles.brand}>
        <Logo size={24} />
        <Text style={styles.wordmark}>Qumanity</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={total > 0 ? `Notifications, ${total} new` : 'Notifications'}
          style={styles.iconBtn}
        >
          <Ionicons name="notifications" size={17} color={colors.dim} />
          {total > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{total > 99 ? '99+' : total}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmSignOut} accessibilityRole="button" accessibilityLabel="Sign out" style={styles.iconBtn}>
          <Ionicons name="power" size={18} color={colors.dim} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: 6,
    backgroundColor: colors.ink,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmark: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.text, letterSpacing: 0.2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.panel,
  },
  badgeText: { color: '#fff', fontFamily: fonts.bold, fontSize: 9 },
});
