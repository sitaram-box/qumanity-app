/** What's new: pending people-requests (act on them right here) and a summary of unread chats. */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { Avatar } from '@/components/Avatar';
import { BackHeader, Chip, ErrorText, Screen } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

export default function Notifications() {
  const [requests, setRequests] = useState<Q.InboxItem[] | null>(null);
  const [summary, setSummary] = useState<Q.NotificationSummary | null>(null);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const [inbox, s] = await Promise.all([Q.inbox(), Q.notificationSummary()]);
      setRequests(inbox.requests);
      setSummary(s);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function answer(r: Q.InboxItem, decision: 'accept' | 'decline' | 'waiting') {
    try {
      await Q.decide(r.id, decision);
      await load();
      if (decision === 'accept' && r.kind === 'message') router.push('/private');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen>
      <BackHeader title="Notifications" />

      {!requests || !summary ? (
        error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.gold} style={{ marginTop: space.xl }} />
      ) : requests.length === 0 && summary.total === 0 ? (
        <Text style={styles.empty}>You're all caught up.</Text>
      ) : (
        <>
          {requests.length > 0 && (
            <View style={styles.section}>
              {requests.map((r) => (
                <View key={r.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Avatar
                      user={{ name: r.from_name, profile_picture_url: r.from_user_id ? Q.pictureUrlFor(r.from_user_id) : null }}
                      size={36}
                    />
                    <Text style={[styles.cardTitle, { flex: 1 }]}>
                      {r.from_name} {requestText(r)}
                    </Text>
                  </View>
                  {r.first_message && <Text style={styles.msg}>“{r.first_message}”</Text>}
                  {r.status === 'waiting' && <Text style={styles.meta}>On waiting</Text>}
                  <View style={styles.actions}>
                    <Chip label="Accept" onPress={() => answer(r, 'accept')} />
                    <Chip label="Decline" onPress={() => answer(r, 'decline')} />
                    {r.status !== 'waiting' && <Chip label="Waiting" onPress={() => answer(r, 'waiting')} />}
                  </View>
                </View>
              ))}
            </View>
          )}

          {summary.election && (
            <Pressable style={[styles.row, { borderWidth: 1, borderColor: colors.gold }]} onPress={() => router.push('/public')} accessibilityRole="button">
              <Ionicons name="megaphone" size={20} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowText}>
                  {summary.election.sign} election · {summary.election.action === 'stand' ? 'stand as a candidate' : 'vote now'}
                </Text>
                <Text style={styles.meta}>{summary.election.text} Open Village → Q-Punch.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          )}
          {summary.unread_private > 0 && (
            <Pressable style={styles.row} onPress={() => router.push('/private')} accessibilityRole="button">
              <Ionicons name="chatbubble-ellipses" size={20} color={colors.violet} />
              <Text style={styles.rowText}>
                {summary.unread_private} unread private {summary.unread_private === 1 ? 'chat' : 'chats'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          )}
          {summary.unread_groups > 0 && (
            <Pressable style={styles.row} onPress={() => router.push('/personal')} accessibilityRole="button">
              <Ionicons name="people" size={20} color={colors.teal} />
              <Text style={styles.rowText}>
                {summary.unread_groups} unread group {summary.unread_groups === 1 ? 'chat' : 'chats'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          )}
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

function requestText(r: Q.InboxItem): string {
  switch (r.kind) {
    case 'group':
      return `invites you to “${r.group_name}”`;
    case 'family_group_invite':
      return `invites you to the family unit “${r.family_group_name ?? 'Family'}”`;
    case 'family_group_join':
      return `asks to join your family unit “${r.family_group_name ?? 'Family'}”`;
    case 'rejoin':
      return `asks to rejoin “${r.chat_name ?? 'your chat'}”`;
    default:
      return 'sent you a message';
  }
}

const styles = StyleSheet.create({
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  empty: { color: colors.dim, fontFamily: fonts.body, textAlign: 'center', marginTop: space.xxl },
  section: { marginBottom: space.md },
  card: { backgroundColor: colors.panel, borderRadius: radius.md, padding: space.lg, marginBottom: space.md },
  cardTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  msg: { color: colors.text, fontFamily: fonts.body, marginTop: 4 },
  meta: { color: colors.faint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.panel, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  rowText: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
});
