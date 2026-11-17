/**
 * Local Areas of a village (website local_area_core, 2026-11-18), the Village board's "Local Areas"
 * screen. Neighbourhoods inside the village, each with its own chat; posting and voting stay on the
 * Village board.
 *
 *   - Each area with its member count. You: Join (your first join is free), or — once you're in
 *     one — "Current Area" with Open chat and Leave, and Request Move on the others ("Move
 *     Pending" once asked). Moving, and rejoining after leaving, need approval.
 *   - Managers (the Founder, or this village's Nayak/Nayika — the website's can_manage): "Create
 *     Local Area" at the top, and the pending move requests with Approve / Deny.
 *
 * Every rule is the website's; its own message is shown if it refuses anything.
 */

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { colors, fonts, radius, space, tint } from '@/theme';
import { BottomSheet } from './BottomSheet';
import { rowState } from './localAreas.logic';
import { Button, ErrorText, Field } from './ui';

function confirmThen(title: string, text: string, ok: string, run: () => void, destructive = false) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n${text}`)) run();
    return;
  }
  Alert.alert(title, text, [
    { text: 'Cancel', style: 'cancel' },
    { text: ok, style: destructive ? 'destructive' : 'default', onPress: run },
  ]);
}

export function LocalAreas({ villageId, villageName, onClose }: { villageId: string; villageName?: string; onClose: () => void }) {
  const [data, setData] = useState<Q.LocalAreasList | null>(null);
  const [requests, setRequests] = useState<Q.LocalAreaMoveRequest[]>([]);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const l = await Q.localAreasList(villageId);
      setData(l);
      setRequests(l.can_manage ? (await Q.localAreaRequests(villageId)).requests : []);
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [villageId]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key);
    setError(undefined);
    setNote(undefined);
    try {
      await fn();
      setNote(done);
    } catch (e) {
      setError((e as Error).message); // the website's reason, e.g. rejoining needs approval
    } finally {
      setBusy(null);
      await load();
    }
  }

  async function create() {
    setBusy('create');
    setCreateError(undefined);
    try {
      await Q.localAreaCreate(villageId, newName.trim());
      setCreating(false);
      setNote(`“${newName.trim()}” created.`);
      setNewName('');
      await load();
    } catch (e) {
      setCreateError((e as Error).message); // e.g. a Local Area with this name already exists
    } finally {
      setBusy(null);
    }
  }

  // Open the chat first, then close this screen: closing first (while its slide-away animation
  // runs) made the navigation get lost, leaving the user back on the board.
  const openChat = (a: Q.LocalArea) => {
    router.push({ pathname: '/chat/[kind]/[id]', params: { kind: 'local', id: String(a.id) } });
    onClose();
  };

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.gold} style={{ marginTop: space.lg }} />;

  return (
    <>
      <FlatList
        data={data.local_areas}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={{ padding: space.lg, paddingTop: 0 }}
        ListHeaderComponent={
          <View style={{ gap: space.sm, marginBottom: space.md }}>
            <Text style={styles.hint}>
              Neighbourhoods inside {villageName ?? 'your village'}, each with its own chat. You can be in one. Posting and voting stay on the
              Village board.
            </Text>
            {data.can_manage && <Button title="Create Local Area" icon="add-circle-outline" variant="soft" onPress={() => setCreating(true)} />}
            {data.can_manage && requests.length > 0 && (
              <View style={[styles.card, { borderColor: colors.gold }]}>
                <Text style={styles.cardTitle}>Pending requests</Text>
                {requests.map((r) => (
                  <View key={r.id} style={styles.request}>
                    <Text style={styles.body}>
                      {r.user_name} wants {r.from_name ? `to move from ${r.from_name} to ${r.to_name}` : `to join ${r.to_name}`}
                    </Text>
                    <View style={styles.actions}>
                      <Button
                        title="Approve"
                        icon="checkmark"
                        size="sm"
                        busy={busy === `approve-${r.id}`}
                        disabled={busy !== null}
                        style={{ flex: 1 }}
                        onPress={() => run(`approve-${r.id}`, () => Q.localAreaDecide(r.id, 'approve'), `${r.user_name} is now in ${r.to_name}.`)}
                      />
                      <Button
                        title="Deny"
                        icon="close"
                        size="sm"
                        variant="ghost"
                        disabled={busy !== null}
                        style={{ flex: 1 }}
                        onPress={() => run(`deny-${r.id}`, () => Q.localAreaDecide(r.id, 'deny'), 'Request denied.')}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
            {note && <Text style={styles.ok}>{note}</Text>}
            <ErrorText>{error}</ErrorText>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.hint}>
            No Local Areas yet.{data.can_manage ? ' Create the first one above.' : ' The Village Q-Punch (Nayak / Nayika) creates them.'}
          </Text>
        }
        renderItem={({ item: a }) => {
          const state = rowState(a.id, data);
          return (
            <View style={[styles.card, state === 'current' && { borderColor: colors.gold, backgroundColor: tint(colors.gold, '10') }]}>
              <View style={styles.rowHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{a.name}</Text>
                  <Text style={styles.meta}>
                    {a.member_count} {a.member_count === 1 ? 'member' : 'members'}
                  </Text>
                </View>
                {state === 'current' && <Text style={[styles.badge, styles.badgeCurrent]}>Current Area</Text>}
                {state === 'pending' && <Text style={[styles.badge, styles.badgePending]}>Move Pending</Text>}
              </View>
              {state === 'current' && (
                <View style={styles.actions}>
                  <Button title="Open chat" icon="chatbubbles" size="sm" style={{ flex: 1 }} onPress={() => openChat(a)} />
                  <Button
                    title="Leave"
                    icon="exit-outline"
                    size="sm"
                    variant="ghost"
                    style={{ flex: 1 }}
                    busy={busy === `leave-${a.id}`}
                    disabled={busy !== null}
                    onPress={() =>
                      confirmThen(
                        `Leave ${a.name}?`,
                        'You will leave its chat and go back to just the Village group. Joining a Local Area again will need the Village Q-Punch’s approval.',
                        'Leave',
                        () => run(`leave-${a.id}`, () => Q.localAreaLeave(), `You left ${a.name}.`),
                        true,
                      )
                    }
                  />
                </View>
              )}
              {state === 'join' && (
                <Button
                  title="Join"
                  icon="enter-outline"
                  size="sm"
                  busy={busy === `join-${a.id}`}
                  disabled={busy !== null}
                  onPress={() =>
                    confirmThen(
                      `Join ${a.name}?`,
                      'Your first join is free. Moving to a different Local Area later needs the Village Q-Punch’s approval.',
                      'Join',
                      () => run(`join-${a.id}`, () => Q.localAreaJoin(a.id), `You joined ${a.name}.`),
                    )
                  }
                />
              )}
              {state === 'move' && (
                <Button
                  title="Request Move"
                  icon="swap-horizontal"
                  size="sm"
                  variant="ghost"
                  busy={busy === `move-${a.id}`}
                  disabled={busy !== null}
                  onPress={() =>
                    run(
                      `move-${a.id}`,
                      () => Q.localAreaRequestMove(a.id),
                      `Request sent. The Village Q-Punch will approve or deny your move to ${a.name}.`,
                    )
                  }
                />
              )}
            </View>
          );
        }}
      />

      <BottomSheet visible={creating} onClose={() => setCreating(false)} style={styles.sheet}>
        <Text style={styles.cardTitle}>Create a Local Area</Text>
        <Text style={styles.hint}>A neighbourhood inside {villageName ?? 'this village'}, e.g. a block, lane or colony.</Text>
        <Field label="Name" value={newName} onChangeText={setNewName} autoCapitalize="words" maxLength={60} placeholder="e.g. Block A" />
        <ErrorText>{createError}</ErrorText>
        <View style={styles.actions}>
          <Button title="Cancel" variant="ghost" style={{ flex: 1 }} onPress={() => setCreating(false)} disabled={busy === 'create'} />
          <Button title="Create" icon="add" style={{ flex: 1 }} onPress={create} busy={busy === 'create'} disabled={newName.trim().length < 2} />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.dim, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  body: { color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  meta: { color: colors.faint, fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
  ok: { color: colors.earth, fontFamily: fonts.medium, fontSize: 13 },
  card: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.md, marginBottom: space.sm, gap: space.sm },
  cardTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: { fontFamily: fonts.bold, fontSize: 11.5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
  badgeCurrent: { color: colors.onAccent, backgroundColor: colors.gold },
  badgePending: { color: colors.gold, backgroundColor: tint(colors.gold, '22') },
  actions: { flexDirection: 'row', gap: space.sm },
  request: { gap: space.sm, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  sheet: { padding: space.lg, paddingBottom: space.xl, gap: space.md },
});
