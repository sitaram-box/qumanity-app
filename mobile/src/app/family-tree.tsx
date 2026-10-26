/**
 * Family Tree (website family_core "Nuclear Family Units"), phone layout: ONE unit at a time —
 * its parents' units above, the couple in the middle, children and their own units below. Tap a
 * unit to move there (a trail lets you step back). A unit you aren't a member of can be asked to
 * join. Members + "Add by Public ID" (admins) per unit.
 *
 * Activation (the 6-step wizard: relationship, spouse, parents, children…) stays on the website
 * for now — until a member has activated, this screen points them there.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError, currentServer } from '@/api/client';
import * as Q from '@/api/qumanity';
import { Avatar } from '@/components/Avatar';
import { MembersSheet } from '@/components/MembersSheet';
import { PublicIdInvite } from '@/components/PublicIdInvite';
import { BackHeader, Button, ErrorText, Lead, Screen, SectionTitle } from '@/components/ui';
import { colors, fonts, radius, space, timelineColors, tint } from '@/theme';

const ACCENT = timelineColors.personal;

export default function FamilyTree() {
  const [status, setStatus] = useState<Q.FamilyStatus | null>(null);
  const [trail, setTrail] = useState<{ id: number; name: string }[]>([]);
  const [unit, setUnit] = useState<Q.FamilyNeighborhood | null>(null);
  const [outside, setOutside] = useState<{ id: number; name: string } | null>(null); // a unit you're not in
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [members, setMembers] = useState<Q.MemberRow[] | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [joinMsg, setJoinMsg] = useState<string>();

  const open = useCallback(async (id: number, name: string, mode: 'push' | 'reset' | 'back' = 'push') => {
    setLoading(true);
    setError(undefined);
    setJoinMsg(undefined);
    setOutside(null);
    try {
      const n = await Q.familyNeighborhood(id);
      setUnit(n);
      setTrail((t) => (mode === 'reset' ? [{ id, name: n.name }] : mode === 'back' ? t.slice(0, t.findIndex((x) => x.id === id) + 1) : [...t, { id, name: n.name }]));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setOutside({ id, name }); // exists, but you're not a member
      else setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      Q.familyStatus().then(
        (s) => {
          setStatus(s);
          const mine = s.groups.find((g) => g.is_founder) ?? s.groups[0];
          if (mine && !unit) open(mine.id, mine.name, 'reset');
        },
        (e) => setError((e as Error).message),
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  async function showMembersOf(id: number) {
    setMembers(null);
    setShowMembers(true);
    try {
      setMembers((await Q.familyMembers(id)).members);
    } catch (e) {
      setShowMembers(false);
      setError((e as Error).message);
    }
  }

  async function askToJoin(id: number) {
    try {
      await Q.familyJoinRequest(id);
      setJoinMsg('Request sent. An admin of that family unit will approve it.');
    } catch (e) {
      setJoinMsg((e as Error).message);
    }
  }

  if (!status) {
    return (
      <Screen>
        <BackHeader title="Family Tree" />
        {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.gold} style={{ marginTop: space.xl }} />}
      </Screen>
    );
  }

  if (!status.activated) {
    return (
      <Screen>
        <BackHeader title="Family Tree" />
        <View style={styles.empty}>
          <Ionicons name="git-network-outline" size={40} color={ACCENT} />
          <Text style={styles.emptyTitle}>Activate your Family Tree on the website</Text>
          <Lead>
            A few questions — your relationship, your spouse, parents and children — build your family units. It takes about two minutes on
            the Qumanity website; afterwards your tree, members and invitations all appear here.
          </Lead>
          <Button title="Open the website" icon="open-outline" onPress={() => Linking.openURL(`${currentServer()}/dashboard`)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackHeader title="Family Tree" subtitle={unit?.name} />

      {status.groups.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {status.groups.map((g) => {
            const on = trail[0]?.id === g.id;
            return (
              <Pressable key={g.id} onPress={() => open(g.id, g.name, 'reset')} style={[styles.chip, on && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
                <Text style={[styles.chipText, on && { color: colors.onAccent }]}>
                  {g.is_founder ? 'My family' : g.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {trail.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trail}>
          {trail.map((t, i) => (
            <Pressable key={`${t.id}-${i}`} onPress={() => i < trail.length - 1 && open(t.id, t.name, 'back')} hitSlop={6}>
              <Text style={[styles.trailText, i === trail.length - 1 && { color: colors.text }]}>
                {i > 0 ? '›  ' : ''}
                {t.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ErrorText>{error}</ErrorText>
      {loading && <ActivityIndicator color={colors.gold} style={{ marginVertical: space.md }} />}

      {outside && !loading && (
        <View style={styles.outside}>
          <Text style={styles.emptyTitle}>{outside.name}</Text>
          <Text style={styles.meta}>You are not a member of this family unit yet.</Text>
          <Button title="Ask to join" icon="hand-left-outline" variant="ghost" onPress={() => askToJoin(outside.id)} />
          {joinMsg && <Text style={styles.ok}>{joinMsg}</Text>}
          {trail.length > 0 && (
            <Button title={`Back to ${trail[trail.length - 1].name}`} variant="ghost" onPress={() => open(trail[trail.length - 1].id, trail[trail.length - 1].name, 'back')} />
          )}
        </View>
      )}

      {unit && !outside && !loading && (
        <>
          {unit.parent_groups.length > 0 && (
            <>
              <SectionTitle>Parents</SectionTitle>
              <View style={styles.parentRow}>
                {unit.parent_groups.map((p) => (
                  <UnitCard key={p.group_id} unit={p} label={p.side === 'wife' ? "Wife's side" : "Husband's side"} onPress={() => open(p.group_id, p.name)} />
                ))}
              </View>
              <View style={styles.connector} />
            </>
          )}

          <View style={[styles.core, unit.is_dormant && { opacity: 0.55 }]}>
            <Text style={styles.coreLabel}>THIS FAMILY UNIT</Text>
            <View style={styles.couple}>
              <PersonBadge person={unit.husband} size={58} />
              <Ionicons name="heart" size={18} color={colors.fire} style={{ marginTop: 18 }} />
              <PersonBadge person={unit.wife} size={58} />
            </View>
            <Text style={styles.meta}>
              {unit.members} {unit.members === 1 ? 'member' : 'members'}
              {unit.is_admin ? ' · you are an admin' : ''}
              {unit.is_dormant ? ' · remembered (both founders passed)' : ''}
            </Text>
          </View>

          {(unit.unmarried_children.length > 0 || unit.child_groups.length > 0) && (
            <>
              <View style={styles.connector} />
              <SectionTitle>Children</SectionTitle>
              {unit.unmarried_children.length > 0 && (
                <View style={styles.childRow}>
                  {unit.unmarried_children.map((c) => (
                    <PersonBadge key={c.id} person={c} size={46} />
                  ))}
                </View>
              )}
              {unit.child_groups.map((c) => (
                <UnitCard key={c.group_id} unit={c} wide onPress={() => open(c.group_id, c.name)} />
              ))}
            </>
          )}

          <View style={styles.actions}>
            <Button title="Members" icon="people" variant="soft" onPress={() => showMembersOf(unit.group_id)} style={{ flex: 1 }} />
          </View>
          {unit.is_admin && <PublicIdInvite label="Add to this family by Public ID" onInvite={(uid) => Q.familyInvite(unit.group_id, uid)} />}
        </>
      )}

      <MembersSheet visible={showMembers} onClose={() => setShowMembers(false)} title={unit ? `${unit.name} · Members` : 'Members'} members={members} />
    </Screen>
  );
}

function PersonBadge({ person, size }: { person: Q.FamilyPerson | null; size: number }) {
  if (!person) {
    return (
      <View style={[styles.badge, { width: size + 28 }]}>
        <View style={[styles.unknown, { width: size, height: size, borderRadius: size / 2 }]}>
          <Ionicons name="help" size={size * 0.4} color={colors.faint} />
        </View>
        <Text style={styles.badgeName}>Not added</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { width: size + 34 }, person.is_deceased && { opacity: 0.55 }]} accessibilityLabel={`${person.name}${person.is_deceased ? ', passed away' : ''}`}>
      <Avatar user={person} size={size} color={person.is_viewer ? colors.gold : undefined} />
      <Text style={styles.badgeName} numberOfLines={2}>
        {person.is_deceased ? '✝ ' : ''}
        {person.name}
      </Text>
      {person.is_viewer ? <Text style={styles.youTag}>You</Text> : !person.claimed && <Text style={styles.metaSmall}>not joined yet</Text>}
    </View>
  );
}

function UnitCard({ unit, label, wide, onPress }: { unit: Q.FamilyUnitBrief; label?: string; wide?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.unit, wide ? { marginTop: space.sm } : { flex: 1 }, unit.is_dormant && { opacity: 0.55 }, pressed && { backgroundColor: colors.panelRaised }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${unit.name}`}
    >
      {label && <Text style={styles.unitLabel}>{label}</Text>}
      <View style={styles.unitTop}>
        <View style={{ flexDirection: 'row' }}>
          {unit.husband && <Avatar user={unit.husband} size={30} />}
          {unit.wife && (
            <View style={{ marginLeft: unit.husband ? -8 : 0 }}>
              <Avatar user={unit.wife} size={30} />
            </View>
          )}
        </View>
        <Text style={styles.unitName} numberOfLines={2}>
          {unit.name}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.faint} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: space.md, marginTop: space.xl, paddingHorizontal: space.md },
  emptyTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 17, textAlign: 'center' },
  chips: { gap: 6, paddingBottom: space.sm },
  chip: { height: 30, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, justifyContent: 'center' },
  chipText: { color: colors.dim, fontFamily: fonts.medium, fontSize: 12.5 },
  trail: { gap: 8, paddingBottom: space.sm },
  trailText: { color: colors.gold, fontFamily: fonts.medium, fontSize: 12.5 },
  outside: { alignItems: 'center', gap: space.sm, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.panel },
  parentRow: { flexDirection: 'row', gap: space.sm },
  connector: { alignSelf: 'center', width: 2, height: 18, backgroundColor: colors.line, marginVertical: 2 },
  core: { alignItems: 'center', padding: space.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: ACCENT, backgroundColor: tint(ACCENT, '14'), gap: space.sm },
  coreLabel: { color: ACCENT, fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.8 },
  couple: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  childRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: { alignItems: 'center', gap: 4 },
  unknown: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  badgeName: { color: colors.text, fontFamily: fonts.medium, fontSize: 12, textAlign: 'center' },
  youTag: { color: colors.gold, fontFamily: fonts.bold, fontSize: 10.5 },
  metaSmall: { color: colors.faint, fontFamily: fonts.body, fontSize: 10.5 },
  meta: { color: colors.dim, fontFamily: fonts.body, fontSize: 12.5, textAlign: 'center' },
  unit: { padding: space.sm, borderRadius: radius.md, backgroundColor: colors.panel, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, gap: 4 },
  unitLabel: { color: colors.faint, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5 },
  unitTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  unitName: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  ok: { color: colors.earth, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center' },
});
