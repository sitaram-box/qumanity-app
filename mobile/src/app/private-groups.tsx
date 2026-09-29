/**
 * Private Groups (2026-09-28): the 1:1 chats opened by an accepted message request. Both members
 * are admins — rename or leave from here; a left chat stays visible (read-only) with a "Request to
 * rejoin" button until the other member approves it.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { BackHeader, ErrorText, Screen } from '@/components/ui';
import { colors, fonts, radius, space, timelineColors } from '@/theme';

export default function PrivateGroups() {
  const [chats, setChats] = useState<Q.PrivateChat[] | null>(null);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setChats((await Q.privateChats()).chats);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function rejoin(chatId: number) {
    setBusyId(chatId);
    setError(undefined);
    try {
      await Q.requestRejoinChat(chatId);
      Alert.alert('Request sent', 'Waiting for the other member to let you back in.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen>
      <BackHeader title="Self" />
      {!chats ? (
        error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.gold} style={{ marginTop: space.xl }} />
      ) : chats.length === 0 ? (
        <Text style={styles.empty}>
          No private chats yet. Find someone by their search code on the Personal tab to start one.
        </Text>
      ) : (
        chats.map((c) => (
          <View key={c.chat_id} style={styles.row}>
            <Pressable
              style={styles.rowMain}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/chat/[kind]/[id]', params: { kind: 'private', id: String(c.chat_id) } })}
            >
              <View style={[styles.icon, { backgroundColor: timelineColors.private + '22' }]}>
                <Ionicons name="lock-closed" size={18} color={timelineColors.private} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {c.left ? 'You left this chat' : c.last || `Chat with ${c.with}`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
            {c.left && (
              <Pressable style={styles.rejoinBtn} onPress={() => rejoin(c.chat_id)} disabled={busyId === c.chat_id} accessibilityRole="button">
                {busyId === c.chat_id ? (
                  <ActivityIndicator color={colors.gold} size="small" />
                ) : (
                  <Text style={styles.rejoinText}>Request to rejoin</Text>
                )}
              </Pressable>
            )}
          </View>
        ))
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.dim, fontFamily: fonts.body, textAlign: 'center', marginTop: space.xxl },
  row: { backgroundColor: colors.panel, borderRadius: radius.md, marginBottom: space.sm, overflow: 'hidden' },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  meta: { color: colors.faint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  rejoinBtn: { paddingVertical: space.sm, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rejoinText: { color: colors.gold, fontFamily: fonts.bold, fontSize: 13 },
});
