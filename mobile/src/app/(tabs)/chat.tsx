/**
 * Chat (2026-11-24, Unified Chat Architecture Step 3): the mobile app's own simplified,
 * single-column answer to the website's 3-column /chat page -- a segmented Private/Channels list
 * built from the same aggregator (chat_core.list_my_conversations(), via Q.chatConversations()),
 * tapping a row opening the EXISTING, unchanged /chat/[kind]/[id] screen that already handles all
 * five ChatKinds. No 3-column layout here on purpose -- that's desktop/web only, per the approved
 * Phase 2 decision; this tab is the one new mobile surface Step 3 actually needs; every other
 * backend/behavior piece is reused as-is.
 *
 * "Favorites" and a working "Unread"/"Mentions" split are intentionally absent here too, for the
 * exact same reasons as the website's chat.js: no pinning mechanism and no per-user "last read"
 * timestamp exist anywhere in the backend yet (chat_core.list_my_conversations()'s own docstring
 * says unread_count is always 0 today) -- building fake UI for data that doesn't exist would be
 * worse than a plain flat list.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { Avatar } from '@/components/Avatar';
import { Chip, ErrorText, Screen, TabHeading } from '@/components/ui';
import { colors, fonts, radius, space, tint } from '@/theme';

const PRESENCE_COLOR: Record<Q.PresenceStatus, string> = { green: '#3DBE6B', yellow: '#F2B705', grey: colors.faint, red: '#E0483E' };

export default function ChatTab() {
  const [conversations, setConversations] = useState<Q.Conversation[] | null>(null);
  const [presence, setPresence] = useState<Record<number, Q.PresenceStatus>>({});
  const [segment, setSegment] = useState<'private' | 'channel'>('private');
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const { conversations: rows } = await Q.chatConversations();
      setConversations(rows);
      const otherIds = Array.from(new Set(rows.map((c) => c.other_user_id).filter((id): id is number => !!id)));
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

  function openRow(c: Q.Conversation) {
    router.push({ pathname: '/chat/[kind]/[id]', params: { kind: c.kind, id: String(c.id) } });
  }

  const privateRows = (conversations ?? []).filter((c) => c.pane === 'private');
  const channelRows = (conversations ?? []).filter((c) => c.pane === 'channel');

  // Channels grouped by location, same structural signal the website's chat.js groups by --
  // a Village's channels kept visually apart from a Tehsil's.
  const channelGroups: { label: string; items: Q.Conversation[] }[] = [];
  channelRows.forEach((c) => {
    const key = `${c.location_level ?? ''}:${c.location_id ?? ''}`;
    let group = channelGroups.find((g) => g.label === key);
    if (!group) {
      const label = c.location_level ? `${c.location_level[0].toUpperCase()}${c.location_level.slice(1)} · ${c.location_id}` : 'Channel';
      group = { label, items: [] };
      channelGroups.push(group);
    }
    group.items.push(c);
  });

  return (
    <Screen>
      <TabHeading title="Chat" note="Private chats and Governance Channels, in one place." accent={colors.gold} />

      <View style={styles.segment}>
        <Chip label="Private" selected={segment === 'private'} onPress={() => setSegment('private')} />
        <Chip label="Channels" selected={segment === 'channel'} onPress={() => setSegment('channel')} />
      </View>

      <ErrorText>{error}</ErrorText>

      {!conversations ? (
        !error && <ActivityIndicator color={colors.gold} style={{ marginTop: space.xl }} />
      ) : segment === 'private' ? (
        privateRows.length === 0 ? (
          <Text style={styles.empty}>No private chats yet.</Text>
        ) : (
          privateRows.map((c) => (
            <Pressable key={`${c.kind}-${c.id}`} style={styles.row} onPress={() => openRow(c)} accessibilityRole="button">
              <View>
                <Avatar name={c.title} size={40} />
                {c.other_user_id != null && (
                  <View style={[styles.presenceDot, { backgroundColor: PRESENCE_COLOR[presence[c.other_user_id] ?? 'grey'] }]} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.title}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {c.kind === 'family' ? 'Family' : c.kind === 'group' ? 'Group' : 'Private chat'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          ))
        )
      ) : channelRows.length === 0 ? (
        <Text style={styles.empty}>No Governance Channels yet.</Text>
      ) : (
        channelGroups.map((group) => (
          <View key={group.label} style={{ marginBottom: space.md }}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.items.map((c) => (
              <Pressable key={`${c.kind}-${c.id}`} style={styles.row} onPress={() => openRow(c)} accessibilityRole="button">
                <View style={[styles.channelIcon, { backgroundColor: tint(colors.saffron) }]}>
                  <Ionicons name="megaphone" size={18} color={colors.saffron} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{c.title}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {c.location_level ? `${c.location_level[0].toUpperCase()}${c.location_level.slice(1)} Channel` : 'Channel'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.faint} />
              </Pressable>
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
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
