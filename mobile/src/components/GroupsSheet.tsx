/**
 * The board's groups drawer (docs/sub_groups.md), titled like the button that opens it (website
 * naming, 2026-11-16):
 *   Village          → "Local Areas": the village's neighbourhoods, each with its own chat (LocalAreas.tsx,
 *                      2026-11-18 — replacing the older village sub-groups here, as on the website)
 *   Tehsil → Earth   → "Sub-Groups": the places one level below, for their statistics only (never a chat)
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { childrenOf, type Place } from '@/api/locations';
import * as Q from '@/api/qumanity';
import { colors, fonts, space } from '@/theme';
import { LocalAreas } from './LocalAreas';
import { ErrorText } from './ui';

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
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{level === 'village' ? 'Local Areas' : 'Sub-Groups'}</Text>
          {/* Which places the list holds ("Villages", "Tehsils" …) stays visible under the title. */}
          {level !== 'village' && BELOW[level] ? <Text style={styles.sub}>{BELOW[level]}</Text> : null}
        </View>
        <Pressable onPress={onClose} accessibilityRole="button">
          <Text style={styles.close}>← Board</Text>
        </Pressable>
      </View>
      {level !== 'village' ? (
        <PlacesBelow level={level} struct={struct} onClose={onClose} />
      ) : struct.village?.id ? (
        <LocalAreas villageId={String(struct.village.id)} villageName={struct.village.name} onClose={onClose} />
      ) : (
        <Text style={[styles.hint, { padding: space.lg }]}>Set your present village to see its Local Areas.</Text>
      )}
    </SafeAreaView>
  );
}

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
  sub: { color: colors.dim, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  close: { color: colors.gold, fontFamily: fonts.medium },
  hint: { color: colors.dim, fontFamily: fonts.body, fontSize: 14, marginBottom: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowText: { color: colors.text, fontFamily: fonts.body, fontSize: 16 },
});
