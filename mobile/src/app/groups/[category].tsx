/**
 * One bucket's group list (Family / Friends / Business) — its own screen, per the redesign:
 * tapping a bucket on the Personal tab never shows chats inline, it opens this list; tapping a
 * group here opens its own chat screen (chat/[kind]/[id].tsx). No "+ New" here — Family/Friends/
 * Business are pre-defined or auto-created only; the single "+" on the Personal tab is the only
 * way to create a group (as Custom, immediately moved into a category).
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { BackHeader, ErrorText, Screen } from '@/components/ui';
import { BUCKET_TITLE, BUCKETS, groupsInBucket, type Bucket } from '@/lib/groupBuckets';
import { colors, fonts, radius, space } from '@/theme';

export default function GroupBucketList() {
  const { category } = useLocalSearchParams<{ category: Bucket }>();
  const bucket = BUCKETS.some((b) => b.key === category) ? category : 'friends';
  const meta = BUCKETS.find((b) => b.key === bucket)!;

  const [groups, setGroups] = useState<Q.PersonalGroups | null>(null);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      setGroups(await Q.personalGroups());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const rows = groups ? [...groupsInBucket(groups, bucket).owned, ...groupsInBucket(groups, bucket).joined] : null;

  return (
    <Screen>
      <BackHeader title={BUCKET_TITLE[bucket]} />
      {!rows ? (
        error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.gold} style={{ marginTop: space.xl }} />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>No {BUCKET_TITLE[bucket].toLowerCase()} groups yet. Use the + on the Personal tab to create one.</Text>
      ) : (
        rows.map((g) => (
          <Pressable
            key={g.id}
            style={styles.row}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/chat/[kind]/[id]', params: { kind: 'group', id: String(g.id) } })}
          >
            <View style={[styles.icon, { backgroundColor: meta.color + '22' }]}>
              <Ionicons name={meta.icon} size={20} color={meta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{g.category === 'business' && g.business_name ? g.business_name : g.name}</Text>
              <Text style={styles.meta}>
                {g.members} {g.members === 1 ? 'member' : 'members'}
                {!g.mine && g.owner_name ? ` · owner ${g.owner_name}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </Pressable>
        ))
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.dim, fontFamily: fonts.body, textAlign: 'center', marginTop: space.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.panel, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  meta: { color: colors.faint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
});
