/**
 * Drill-down place picker on the website's location data (api/locations.ts).
 * Each country shows its own tier names; hidden tiers are passed through.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { autoDescend, childrenOf, isComplete, type Place } from '@/api/locations';
import { colors, fonts, radius, space } from '@/theme';
import { ErrorText } from './ui';

export function LocationPicker({
  path,
  onChange,
  onlySubcontinent = false,
  onComplete,
}: {
  path: Place[];
  onChange: (path: Place[]) => void;
  onlySubcontinent?: boolean;
  /** Called whenever completeness changes. */
  onComplete?: (done: boolean) => void;
}) {
  const leaf = path[path.length - 1] ?? null;
  const [options, setOptions] = useState<Place[] | null>(null);
  const [error, setError] = useState<string>();
  const [search, setSearch] = useState('');
  const done = !!leaf && options !== null && isComplete(path, options.length > 0);

  useEffect(() => {
    onComplete?.(done);
  }, [done, onComplete]);

  useEffect(() => {
    let live = true;
    setOptions(null);
    setSearch('');
    setError(undefined);
    (async () => {
      const descended = await autoDescend(path, onlySubcontinent);
      if (!live) return;
      if (descended.length !== path.length) return onChange(descended);
      const leafNow = descended[descended.length - 1] ?? null;
      if (leafNow?.tier === 'country' && !onlySubcontinent && !isSubcontinent(leafNow)) return setOptions([]);
      setOptions(await childrenOf(leafNow, onlySubcontinent));
    })().catch((e) => live && setError(String(e?.message ?? e)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaf?.id, leaf?.tier, path.length]);

  const tierName = (options?.[0]?.label ?? options?.[0]?.tier ?? 'place').toLowerCase();
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return !options ? [] : q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, search]);
  const shown = path.filter((p) => p.label !== null);

  return (
    <View style={{ flex: 1 }}>
      {shown.length > 0 && (
        <View style={styles.crumbs}>
          {shown.map((p) => (
            <Pressable
              key={`${p.tier}:${p.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Change ${p.label} ${p.name}`}
              onPress={() => onChange(path.slice(0, path.indexOf(p)))}
              style={styles.crumb}
            >
              <Text style={styles.crumbTier}>{p.label}</Text>
              <Text style={styles.crumbText}>{p.name}</Text>
              <Ionicons name="close" size={14} color={colors.dim} />
            </Pressable>
          ))}
        </View>
      )}

      {done ? (
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={22} color={colors.earth} />
          <Text style={styles.doneText}>{leaf!.name}</Text>
        </View>
      ) : (
        <>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${tierName}`}
            placeholderTextColor={colors.faint}
            style={styles.search}
            accessibilityLabel={`Search ${tierName}`}
          />
          <ErrorText>{error}</ErrorText>
          {!options && !error ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.loadingText}>Loading places…</Text>
            </View>
          ) : (
            <FlatList
              data={visible}
              keyExtractor={(l) => `${l.tier}:${l.id}`}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={30}
              ListEmptyComponent={options?.length ? <Text style={styles.empty}>No matches.</Text> : null}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onChange([...path, item])}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.panelRaised }]}
                >
                  <Text style={styles.rowText}>{item.name}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                </Pressable>
              )}
            />
          )}
        </>
      )}
    </View>
  );
}

function isSubcontinent(p: Place) {
  return ['IND', 'NPL', 'BTN', 'BGD', 'MMR', 'LKA', 'PAK', 'BLC', 'AFG', 'MDV'].includes(p.countryCode ?? '');
}

const styles = StyleSheet.create({
  crumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.panelRaised,
  },
  crumbTier: { color: colors.faint, fontFamily: fonts.medium, fontSize: 11 },
  crumbText: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  search: {
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontFamily: fonts.body,
    marginBottom: space.sm,
  },
  loading: { alignItems: 'center', gap: space.sm, marginTop: space.xl },
  loadingText: { color: colors.dim, fontFamily: fonts.body },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowText: { color: colors.text, fontFamily: fonts.body, fontSize: 16, flex: 1 },
  empty: { color: colors.dim, fontFamily: fonts.body, textAlign: 'center', marginTop: space.xl },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.earth,
  },
  doneText: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
});
