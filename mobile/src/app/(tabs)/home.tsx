/**
 * Home (2026-11-25, mobile redesign Step 2 -- was "Chat", renamed to match the website's own
 * Home tab, docs/HANDOVER.md §20.1/§21.3): the mobile app's single-column answer to the website's
 * Universal Inbox. Was a 2-way Private/Channels split (2026-11-24, Unified Chat Architecture Step
 * 3); now a 6-way filter -- All, Private, Groups, Areas, Councils, Cases -- matching the website's
 * own `qm-chat-type-filter-tabs` row exactly (templates/dashboard.html). Tapping a row still opens
 * the EXISTING, unchanged /chat/[kind]/[id] screen that already handles every ChatKind, now
 * extended (this same redesign's Step 3) with a 6th kind, 'case'.
 *
 * Still no 3-column layout -- that's desktop/web only, per the approved Phase 2 decision; this tab
 * is the one new mobile surface this arc needs beyond the filter + Cases merge, every other
 * backend/behavior piece is reused as-is.
 *
 * Cases are fetched separately (Q.casesList(), /api/cases/my-cases) and merged into this list
 * client-side -- chat_core.list_my_conversations() / Q.chatConversations() is untouched, exactly
 * mirroring the website's own dashboard.js loadConversations() merge (see the website repo's
 * docs/HANDOVER.md §21.3 for why Cases stay a separate fetch rather than a 6th ChatKind in the
 * aggregator itself).
 *
 * "Favorites" and a working "Unread"/"Mentions" split are intentionally absent here too, for the
 * exact same reasons as the website's chat.js: no pinning mechanism and no per-user "last read"
 * timestamp exist anywhere in the backend yet.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { Avatar } from '@/components/Avatar';
import { ErrorText, Screen, TabHeading } from '@/components/ui';
import { colors, fonts, radius, space, tint } from '@/theme';

const PRESENCE_COLOR: Record<Q.PresenceStatus, string> = { green: '#3DBE6B', yellow: '#F2B705', grey: colors.faint, red: '#E0483E' };

type TypeFilter = 'all' | 'private' | 'groups' | 'areas' | 'councils' | 'cases';

const FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'private', label: 'Private' },
  { key: 'groups', label: 'Groups' },
  { key: 'areas', label: 'Areas' },
  { key: 'councils', label: 'Councils' },
  { key: 'cases', label: 'Cases' },
];

/** Which filter bucket a conversation's own ChatKind falls under -- the same mapping the
 * website's chat_core kinds use: private -> Private, family + group -> Groups, local -> Areas,
 * sub -> Councils. 'case' rows are tagged this way too, below, since they aren't a ChatKind at all. */
function bucketFor(kind: Q.ChatKind | 'case'): Exclude<TypeFilter, 'all'> {
  if (kind === 'private') return 'private';
  if (kind === 'family' || kind === 'group') return 'groups';
  if (kind === 'local') return 'areas';
  if (kind === 'case') return 'cases';
  return 'councils'; // kind === 'sub'
}

const CASE_STATUS_LABEL: Record<Q.CaseStatus, string> = {
  created: 'Created', agent_assigned: 'Agent Assigned', supplier_contacted: 'Supplier Contacted',
  pending_supplier: 'Awaiting Supplier', pending_payment: 'Pending Payment', in_progress: 'In Progress',
  resolved: 'Resolved', disputed: 'Disputed', escalated: 'Escalated', cancelled: 'Cancelled',
};

type Row = { kind: Q.ChatKind | 'case'; id: number; title: string; location_level: Q.BoardLevel | null; location_id: string | null; other_user_id?: number; caseStatus?: Q.CaseStatus };

export default function HomeTab() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [presence, setPresence] = useState<Record<number, Q.PresenceStatus>>({});
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const [{ conversations }, { cases }] = await Promise.all([Q.chatConversations(), Q.casesList()]);
      const conversationRows: Row[] = conversations.map((c) => ({
        kind: c.kind, id: c.id, title: c.title, location_level: c.location_level, location_id: c.location_id, other_user_id: c.other_user_id,
      }));
      const caseRows: Row[] = cases.map((c) => ({
        kind: 'case', id: c.id, title: c.subject || `Case #${c.id}`, location_level: c.location_level, location_id: c.location_id, caseStatus: c.status,
      }));
      setRows([...conversationRows, ...caseRows]);
      const otherIds = Array.from(new Set(conversations.map((c) => c.other_user_id).filter((id): id is number => !!id)));
      if (otherIds.length) {
        const { statuses } = await Q.presenceBatch(otherIds);
        setPresence(statuses);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openRow(r: Row) {
    router.push({ pathname: '/chat/[kind]/[id]', params: { kind: r.kind, id: String(r.id) } });
  }

  const filtered = (rows ?? []).filter((r) => filter === 'all' || bucketFor(r.kind) === filter);

  // Location-scoped kinds (sub/local/case) group by place, same structural signal the website
  // groups channels by -- a Village's own rows kept visually apart from a Tehsil's. Private/Groups
  // stay a flat list, same as before this redesign.
  const grouped = filter === 'councils' || filter === 'areas' || filter === 'cases';
  const groups: { label: string; items: Row[] }[] = [];
  if (grouped) {
    filtered.forEach((r) => {
      const key = `${r.location_level ?? ''}:${r.location_id ?? ''}`;
      let group = groups.find((g) => g.label === key);
      if (!group) {
        const label = r.location_level ? `${r.location_level[0].toUpperCase()}${r.location_level.slice(1)} · ${r.location_id}` : 'Case';
        group = { label, items: [] };
        groups.push(group);
      }
      group.items.push(r);
    });
  }

  function renderRow(r: Row) {
    if (r.kind === 'case') {
      return (
        <Pressable key={`case-${r.id}`} style={styles.row} onPress={() => openRow(r)} accessibilityRole="button">
          <View style={[styles.channelIcon, { backgroundColor: tint(colors.gold) }]}>
            <Ionicons name="briefcase" size={18} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{r.title}</Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {r.caseStatus ? CASE_STATUS_LABEL[r.caseStatus] : 'Case'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>
      );
    }
    if (r.kind === 'private') {
      return (
        <Pressable key={`private-${r.id}`} style={styles.row} onPress={() => openRow(r)} accessibilityRole="button">
          <View>
            <Avatar name={r.title} size={40} />
            {r.other_user_id != null && (
              <View style={[styles.presenceDot, { backgroundColor: PRESENCE_COLOR[presence[r.other_user_id] ?? 'grey'] }]} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{r.title}</Text>
            <Text style={styles.rowMeta} numberOfLines={1}>Private chat</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>
      );
    }
    if (r.kind === 'family' || r.kind === 'group') {
      return (
        <Pressable key={`${r.kind}-${r.id}`} style={styles.row} onPress={() => openRow(r)} accessibilityRole="button">
          <Avatar name={r.title} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{r.title}</Text>
            <Text style={styles.rowMeta} numberOfLines={1}>{r.kind === 'family' ? 'Family' : 'Group'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>
      );
    }
    // 'sub' (Councils) / 'local' (Areas)
    return (
      <Pressable key={`${r.kind}-${r.id}`} style={styles.row} onPress={() => openRow(r)} accessibilityRole="button">
        <View style={[styles.channelIcon, { backgroundColor: tint(colors.saffron) }]}>
          <Ionicons name="megaphone" size={18} color={colors.saffron} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{r.title}</Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {r.location_level ? `${r.location_level[0].toUpperCase()}${r.location_level.slice(1)} Channel` : 'Channel'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </Pressable>
    );
  }

  return (
    <Screen>
      <TabHeading title="Home" note="Private chats, Groups, Areas, Councils and Cases — in one place." accent={colors.gold} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterInner}>
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, on && { backgroundColor: colors.gold, borderColor: colors.gold }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.filterText, on && styles.filterTextOn]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ErrorText>{error}</ErrorText>

      {!rows ? (
        !error && <ActivityIndicator color={colors.gold} style={{ marginTop: space.xl }} />
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>Nothing here yet.</Text>
      ) : grouped ? (
        groups.map((group) => (
          <View key={group.label} style={{ marginBottom: space.md }}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.items.map(renderRow)}
          </View>
        ))
      ) : (
        filtered.map(renderRow)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterScroll: { flexGrow: 0, marginBottom: space.md },
  filterInner: { gap: 6, paddingRight: space.sm },
  filterChip: { height: 30, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, justifyContent: 'center' },
  filterText: { color: colors.dim, fontFamily: fonts.medium, fontSize: 12.5 },
  filterTextOn: { color: colors.onAccent, fontFamily: fonts.bold },
  empty: { color: colors.dim, fontFamily: fonts.body, textAlign: 'center', marginTop: space.xxl },
  groupLabel: { color: colors.gold, fontFamily: fonts.bold, fontSize: 12, marginBottom: space.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  rowTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  rowMeta: { color: colors.faint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  channelIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  presenceDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.panel,
  },
});
