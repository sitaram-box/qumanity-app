/** What's new: pending people-requests (act on them right here), family recovery requests a
 * relative sent you (Approve / Deny; they arrive in Qmail on the website, and the app reads them
 * from there), and a summary of unread chats. */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { currentServer } from '@/api/client';
import * as Q from '@/api/qumanity';
import { Avatar } from '@/components/Avatar';
import { approveCall, verifierLines } from '@/components/familyRecovery.logic';
import { BackHeader, Chip, ErrorText, Screen } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

export default function Notifications() {
  const [requests, setRequests] = useState<Q.InboxItem[] | null>(null);
  const [summary, setSummary] = useState<Q.NotificationSummary | null>(null);
  const [error, setError] = useState<string>();
  const [recovery, setRecovery] = useState<Q.FamilyRecoveryDetail[]>([]);
  const [recoveryMsg, setRecoveryMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [inbox, s] = await Promise.all([Q.inbox(), Q.notificationSummary()]);
      setRequests(inbox.requests);
      setSummary(s);
    } catch (e) {
      setError((e as Error).message);
    }
    setRecovery(await loadRecoveryRequests());
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

  function decideRecovery(d: Q.FamilyRecoveryDetail, approve: boolean) {
    const lines = verifierLines(d);
    const title = approve ? `Approve for ${d.requester_claimed_name}?` : `Deny ${d.requester_claimed_name}'s request?`;
    const text = approve
      ? `${lines.approveMeans} Only approve if you are sure this is really them.`
      : 'They will be told their family member declined. They can send a new request later.';
    const run = async () => {
      setRecoveryBusy(d.id);
      setRecoveryMsg(null);
      try {
        if (!approve) await Q.familyRecoveryReject(d.id);
        else if (approveCall(d.action) === 'share_id') await Q.familyRecoveryShareId(d.id);
        else await Q.familyRecoveryApprovePin(d.id);
        setRecoveryMsg({ ok: true, text: approve ? `Approved. ${d.requester_claimed_name} can now finish with their tracking code.` : 'Request denied.' });
      } catch (e) {
        setRecoveryMsg({ ok: false, text: (e as Error).message }); // e.g. already decided or expired
      } finally {
        setRecoveryBusy(null);
        setRecovery(await loadRecoveryRequests());
      }
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${title}\n${text}`)) run();
      return;
    }
    Alert.alert(title, text, [
      { text: 'Cancel', style: 'cancel' },
      { text: approve ? 'Approve' : 'Deny', style: approve ? 'default' : 'destructive', onPress: run },
    ]);
  }

  return (
    <Screen>
      <BackHeader title="Notifications" />
      {/* Outside the list: still shown when deciding the last request leaves "You're all caught up". */}
      {recoveryMsg && <Text style={[styles.recoveryMsg, { color: recoveryMsg.ok ? colors.earth : colors.danger }]}>{recoveryMsg.text}</Text>}

      {!requests || !summary ? (
        error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.gold} style={{ marginTop: space.xl }} />
      ) : requests.length === 0 && summary.total === 0 && recovery.length === 0 ? (
        <Text style={styles.empty}>You're all caught up.</Text>
      ) : (
        <>
          {recovery.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Family recovery requests</Text>
              {recovery.map((d) => {
                const lines = verifierLines(d);
                return (
                  <View key={d.id} style={[styles.card, { borderWidth: 1, borderColor: colors.gold }]}>
                    <View style={styles.cardHead}>
                      <Ionicons name="key" size={20} color={colors.gold} />
                      <Text style={[styles.cardTitle, { flex: 1 }]}>{lines.asks}</Text>
                    </View>
                    <Text style={styles.msg}>{lines.verified}</Text>
                    <Text style={styles.meta}>{lines.approveMeans}</Text>
                    <Text style={styles.meta}>Expires {shortDate(d.expires_at)}</Text>
                    {recoveryBusy === d.id ? (
                      <ActivityIndicator color={colors.gold} style={{ marginTop: space.sm, alignSelf: 'flex-start' }} />
                    ) : (
                      <View style={styles.actions}>
                        <Chip label="Approve" icon="checkmark" onPress={() => decideRecovery(d, true)} />
                        <Chip label="Deny" icon="close" onPress={() => decideRecovery(d, false)} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
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
          {/* Replies that live in Qmail, which the app doesn't have yet. The bell's total
              counts them, so they're listed here (opening Qmail on the website) instead of
              leaving an unexplained badge over an empty screen. */}
          {(
            [
              ['unread_queries', 'reply from Admin to your question', 'replies from Admin to your questions', 'help-circle'],
              ['unread_council', 'reply from your council', 'replies from your council', 'shield-checkmark'],
            ] as const
          ).map(([key, one, many, icon]) => {
            const n = summary[key] ?? 0;
            if (n <= 0) return null;
            return (
              <Pressable
                key={key}
                style={styles.row}
                onPress={() => Linking.openURL(`${currentServer()}/qmail`)}
                accessibilityRole="link"
                accessibilityHint="Opens Qmail on the Qumanity website"
              >
                <Ionicons name={icon} size={20} color={colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText}>
                    {n} unread {n === 1 ? one : many}
                  </Text>
                  <Text style={styles.meta}>In Qmail on the website (sign in there) — not in the app yet.</Text>
                </View>
                <Ionicons name="open-outline" size={18} color={colors.faint} />
              </Pressable>
            );
          })}
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

/** Family recovery requests addressed to you that you can still decide. They arrive as system
 * messages in your Qmail inbox; each one's details come from its own route. Any failure (e.g. Qmail
 * unavailable) just hides the section; the rest of the screen still works. */
async function loadRecoveryRequests(): Promise<Q.FamilyRecoveryDetail[]> {
  try {
    const { messages } = await Q.qmailInbox();
    const ids = [...new Set(messages.filter((m) => m.message_type === 'family_recovery_request' && m.recovery_request_id).map((m) => m.recovery_request_id!))];
    const details = await Promise.allSettled(ids.map((id) => Q.familyRecoveryDetail(id)));
    return details.flatMap((r) => (r.status === 'fulfilled' && r.value.can_act ? [r.value] : []));
  } catch {
    return [];
  }
}

/** "16 Nov, 14:05" in the phone's own time zone (the website sends UTC). */
function shortDate(iso: string): string {
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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
  sectionTitle: { color: colors.faint, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: space.sm },
  recoveryMsg: { fontFamily: fonts.medium, fontSize: 13, textAlign: 'center', marginBottom: space.md },
  card: { backgroundColor: colors.panel, borderRadius: radius.md, padding: space.lg, marginBottom: space.md },
  cardTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  msg: { color: colors.text, fontFamily: fonts.body, marginTop: 4 },
  meta: { color: colors.faint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.panel, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  rowText: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
});
