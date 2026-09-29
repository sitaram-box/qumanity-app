/**
 * Personal timeline (2026-09-28 restructure): Private / Family / Friends / Business, each opening
 * its own list screen — no chat is ever shown inline here. A single "+" (bottom-right) creates a
 * new group. Private Groups are the 1:1 chats opened by an accepted message request (not a
 * personal_groups category) — see app/private-groups.tsx.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { Button, Chip, ErrorText, Label, Screen, TabHeading } from '@/components/ui';
import { colors, fonts, radius, space, timelineColors, tint } from '@/theme';
import { BUCKETS, countFor, groupsInBucket } from '@/lib/groupBuckets';

export default function PersonalTimeline() {
  const [groups, setGroups] = useState<Q.PersonalGroups | null>(null);
  const [privateCount, setPrivateCount] = useState<number | null>(null);
  const [requests, setRequests] = useState<Q.InboxItem[]>([]);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const [g, r, pc] = await Promise.all([Q.personalGroups(), Q.inbox(), Q.privateChats()]);
      setGroups(g);
      setRequests(r.requests);
      setPrivateCount(pc.chats.length);
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
      if (decision === 'accept' && r.kind === 'message') router.push('/private-groups');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const owned = groups ? BUCKETS.flatMap((b) => groupsInBucket(groups, b.key).owned) : [];

  return (
    <Screen>
      <TabHeading title="Personal" note="Your own groups and chats" accent={timelineColors.personal} />

      {requests.length > 0 && (
        <View style={styles.section}>
          <Label>Requests</Label>
          {requests.map((r) => (
            <View key={r.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {r.from_name}{' '}
                {r.kind === 'group'
                  ? `invites you to “${r.group_name}”`
                  : r.kind === 'rejoin'
                    ? `wants back into “${r.chat_name}”`
                    : 'sent you a message'}
              </Text>
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

      <View style={styles.grid}>
        <Pressable style={[styles.tile, { borderColor: timelineColors.private }]} accessibilityRole="button" onPress={() => router.push('/private-groups')}>
          <View style={[styles.tileIcon, { backgroundColor: tint(timelineColors.private) }]}>
            <Ionicons name="lock-closed" size={19} color={timelineColors.private} />
          </View>
          <Text style={styles.tileTitle}>Self</Text>
          <Text style={styles.tileCount}>{privateCount ?? '…'}</Text>
        </Pressable>
        {BUCKETS.map((b) => (
          <Pressable
            key={b.key}
            style={[styles.tile, { borderColor: b.color }]}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/groups/[category]', params: { category: b.key } })}
          >
            <View style={[styles.tileIcon, { backgroundColor: tint(b.color) }]}>
              <Ionicons name={b.icon} size={19} color={b.color} />
            </View>
            <Text style={styles.tileTitle}>{b.title}</Text>
            <Text style={styles.tileCount}>{groups ? countFor(groups, b.key) : '…'}</Text>
          </Pressable>
        ))}
      </View>

      <FindPerson owned={owned} />
      <ErrorText>{error}</ErrorText>

      <Pressable style={styles.fab} accessibilityRole="button" accessibilityLabel="Create new group" onPress={() => router.push('/groups/create')}>
        <Ionicons name="add" size={26} color={colors.onAccent} />
      </Pressable>
    </Screen>
  );
}

function FindPerson({ owned }: { owned: Q.PersonalGroup[] }) {
  const [code, setCode] = useState('');
  const [person, setPerson] = useState<Awaited<ReturnType<typeof Q.searchPerson>> | null>(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();

  async function find() {
    setError(undefined);
    setStatus(undefined);
    setPerson(null);
    try {
      setPerson(await Q.searchPerson(code.replace(/\D/g, '')));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const run = (fn: () => Promise<unknown>, done: string) => async () => {
    setError(undefined);
    try {
      await fn();
      setStatus(done);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <View style={styles.section}>
      <Label>Find someone by their 12-digit search code</Label>
      <View style={styles.searchRow}>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^\d ]/g, ''))}
          keyboardType="number-pad"
          placeholder="e.g. 7881 8304 1907"
          placeholderTextColor={colors.faint}
          style={styles.search}
          accessibilityLabel="12-digit search code"
        />
        <Button title="Find" variant="ghost" onPress={find} disabled={code.replace(/\D/g, '').length !== 12} />
      </View>
      {person && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{person.name}</Text>
          {person.place && <Text style={styles.meta}>{person.place}</Text>}
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="A first message (sent once, then they decide)"
            placeholderTextColor={colors.faint}
            style={[styles.search, { marginVertical: space.sm }]}
            maxLength={500}
            accessibilityLabel="First message"
          />
          <Button title="Send message request" variant="ghost" disabled={!message.trim()} onPress={run(() => Q.messageRequest(person.user_id, message.trim()), 'Message request sent.')} />
          {owned.length > 0 && (
            <>
              <Text style={[styles.meta, { marginTop: space.md }]}>Or invite them to one of your groups:</Text>
              <View style={styles.actions}>
                {owned.map((g) => (
                  <Chip key={g.id} label={g.name} onPress={run(() => Q.invite(g.id, person.user_id), `Invitation to “${g.name}” sent.`)} />
                ))}
              </View>
            </>
          )}
          {status && <Text style={styles.ok}>{status}</Text>}
        </View>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.lg },
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: space.md, marginBottom: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  cardTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  msg: { color: colors.text, fontFamily: fonts.body, marginTop: 4 },
  meta: { color: colors.faint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    padding: space.md,
    minHeight: 84,
    justifyContent: 'space-between',
  },
  tileIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 14, marginTop: space.sm },
  tileCount: { color: colors.faint, fontFamily: fonts.body, fontSize: 11.5, marginTop: 1 },
  searchRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center', marginTop: space.sm },
  search: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontFamily: fonts.body,
  },
  ok: { color: colors.earth, fontFamily: fonts.medium, marginTop: space.sm },
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.lg,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
