/**
 * The ☰ Groups drawer (docs/sub_groups.md):
 *   Village          → the village's sub-groups (council creates; members ask to join ONE)
 *   Tehsil → Earth   → the places one level below, for their statistics only (never a chat)
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { childrenOf, type Place } from '@/api/locations';
import * as Q from '@/api/qumanity';
import { colors, fonts, radius, space } from '@/theme';
import { Button, ErrorText, Field } from './ui';

const BELOW: Partial<Record<Q.BoardLevel, string>> = {
  earth: 'Continents',
  continent: 'Countries',
  country: 'Zones',
  zone: 'States',
  state: 'Districts',
  district: 'Tehsils',
  tehsil: 'Villages',
};

export function GroupsSheet({ level, struct, onClose }: { level: Q.BoardLevel; struct: Q.LocationStruct; onClose: () => void }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.head}>
        <Text style={styles.title}>{level === 'village' ? 'Village groups' : BELOW[level]}</Text>
        <Pressable onPress={onClose} accessibilityRole="button">
          <Text style={styles.close}>← Board</Text>
        </Pressable>
      </View>
      {level === 'village' ? <VillageGroups onClose={onClose} /> : <PlacesBelow level={level} struct={struct} onClose={onClose} />}
    </SafeAreaView>
  );
}

function VillageGroups({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof Q.subgroups>> | null>(null);
  const [error, setError] = useState<string>();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const load = () => Q.subgroups().then(setData, (e) => setError((e as Error).message));
  useEffect(() => {
    load();
  }, []);

  const act = (fn: () => Promise<unknown>) => async () => {
    setError(undefined);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.gold} />;
  const joinedOne = data.groups.some((g) => g.my_status === 'approved' || g.my_status === 'pending');

  return (
    <FlatList
      data={data.groups}
      keyExtractor={(g) => String(g.id)}
      contentContainerStyle={{ padding: space.lg }}
      ListHeaderComponent={<Text style={styles.hint}>Groups inside {data.village ?? 'your village'}. You can belong to one.</Text>}
      ListEmptyComponent={<Text style={styles.hint}>No village groups yet.</Text>}
      renderItem={({ item: g }) => (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{g.name}</Text>
          {!!g.description && <Text style={styles.hint}>{g.description}</Text>}
          <Text style={styles.meta}>{g.members} members</Text>
          {g.my_status === 'approved' || data.is_admin ? (
            <Button
              title="Open chat"
              variant="ghost"
              onPress={() => {
                onClose();
                router.push({ pathname: '/chat/[kind]/[id]', params: { kind: 'sub', id: String(g.id) } });
              }}
            />
          ) : g.my_status === 'pending' ? (
            <Text style={styles.meta}>Waiting for the council to approve.</Text>
          ) : !joinedOne ? (
            <Button title="Ask to join" variant="ghost" onPress={act(() => Q.joinSubgroup(g.id))} />
          ) : null}
          {data.is_admin &&
            g.pending?.map((p) => (
              <View key={p.user_id} style={styles.pending}>
                <Text style={styles.pendingName}>{p.name} wants to join</Text>
                <Pressable onPress={act(() => Q.decideSubgroup(g.id, p.user_id, true))} accessibilityRole="button">
                  <Text style={styles.yes}>Approve</Text>
                </Pressable>
                <Pressable onPress={act(() => Q.decideSubgroup(g.id, p.user_id, false))} accessibilityRole="button">
                  <Text style={styles.no}>Decline</Text>
                </Pressable>
              </View>
            ))}
        </View>
      )}
      ListFooterComponent={
        <View>
          <ErrorText>{error}</ErrorText>
          {data.is_admin && (
            <View style={[styles.card, { marginTop: space.lg }]}>
              <Text style={styles.cardTitle}>New village group (council only)</Text>
              <Field label="Name" value={name} onChangeText={setName} />
              <Field label="Description" value={desc} onChangeText={setDesc} />
              <Button
                title="Create"
                variant="ghost"
                disabled={name.trim().length < 2}
                onPress={act(async () => {
                  await Q.createSubgroup(name.trim(), desc.trim());
                  setName('');
                  setDesc('');
                })}
              />
            </View>
          )}
        </View>
      }
    />
  );
}

/** Rebuild the location-API place for the person's group at this level. */
function placeAt(level: Q.BoardLevel, struct: Q.LocationStruct): Place | null {
  if (level === 'earth') return null;
  const node = struct[level];
  if (!node) return null;
  return {
    tier: level as Place['tier'],
    id: node.id,
    name: node.name,
    label: level,
    node,
    countryCode: struct.country?.code as string | undefined,
    parentId: level === 'district' ? struct.state?.id : undefined,
  };
}

function PlacesBelow({ level, struct, onClose }: { level: Q.BoardLevel; struct: Q.LocationStruct; onClose: () => void }) {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    childrenOf(placeAt(level, struct)).then(setPlaces, (e) => setError((e as Error).message));
  }, [level, struct]);

  if (!places) return error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.gold} />;
  return (
    <FlatList
      data={places}
      keyExtractor={(p) => `${p.tier}:${p.id}`}
      contentContainerStyle={{ padding: space.lg }}
      ListHeaderComponent={<Text style={styles.hint}>Pick a place to see its statistics.</Text>}
      ListEmptyComponent={<Text style={styles.hint}>No places listed below this level.</Text>}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          accessibilityRole="button"
          onPress={() => {
            onClose();
            router.push({ pathname: '/place/[level]/[id]', params: { level: item.tier, id: item.id, name: item.name } });
          }}
        >
          <Text style={styles.rowText}>{item.name}</Text>
          <Ionicons name="stats-chart" size={16} color={colors.faint} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.lg },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  close: { color: colors.gold, fontFamily: fonts.medium },
  hint: { color: colors.dim, fontFamily: fonts.body, fontSize: 14, marginBottom: space.md },
  meta: { color: colors.faint, fontFamily: fonts.body, fontSize: 12, marginBottom: space.sm },
  card: { backgroundColor: colors.panel, borderRadius: radius.md, padding: space.lg, marginBottom: space.md },
  cardTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 16, marginBottom: 4 },
  pending: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  pendingName: { flex: 1, color: colors.text, fontFamily: fonts.body },
  yes: { color: colors.earth, fontFamily: fonts.bold },
  no: { color: colors.danger, fontFamily: fonts.bold },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowText: { color: colors.text, fontFamily: fonts.body, fontSize: 16 },
});
