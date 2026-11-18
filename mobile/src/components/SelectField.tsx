/**
 * One tappable field that opens a list to choose from (a bottom sheet), in place of a wall of
 * chips. Options can be grouped under headings, and long lists get a search box. Used by
 * registration for Mother tongue and Spiritual path. No extra package: the app's own BottomSheet.
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, space } from '@/theme';
import { BottomSheet } from './BottomSheet';
import { Label } from './ui';

export interface SelectOption {
  value: string;
  label: string;
  /** Optional heading the option sits under (e.g. a language family). */
  group?: string;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose',
  searchable = false,
  clearLabel,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  /** Adds a first row that clears the choice (e.g. "Prefer not to answer" for an optional field). */
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const current = options.find((o) => o.value === value);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, search]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setSearch('');
  }

  return (
    <View style={{ marginBottom: space.md }}>
      <Label>{label}</Label>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.field}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? 'not chosen'}. Tap to choose.`}
      >
        <Text style={[styles.value, !current && { color: colors.faint }]} numberOfLines={1}>
          {current?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.dim} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} style={styles.sheet}>
        <View style={styles.head}>
          <Text style={styles.title}>{label}</Text>
          <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        {searchable && (
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search"
            placeholderTextColor={colors.faint}
            style={styles.search}
            accessibilityLabel={`Search ${label}`}
            autoCorrect={false}
          />
        )}
        <ScrollView keyboardShouldPersistTaps="handled">
          {clearLabel && !search && (
            <Row label={clearLabel} selected={!value} onPress={() => pick('')} muted />
          )}
          {visible.map((o, i) => (
            <View key={o.value}>
              {o.group && o.group !== visible[i - 1]?.group && <Text style={styles.group}>{o.group}</Text>}
              <Row label={o.label} selected={o.value === value} onPress={() => pick(o.value)} />
            </View>
          ))}
          {visible.length === 0 && <Text style={styles.empty}>No matches.</Text>}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function Row({ label, selected, onPress, muted }: { label: string; selected: boolean; onPress: () => void; muted?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.panelRaised }]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.rowText, muted && { color: colors.dim }, selected && { color: colors.gold, fontFamily: fonts.bold }]}>{label}</Text>
      {selected && <Ionicons name="checkmark" size={18} color={colors.gold} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  value: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 15.5 },
  sheet: { maxHeight: '80%', padding: space.lg, paddingBottom: space.xl, gap: space.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
  close: { color: colors.gold, fontFamily: fonts.medium },
  search: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontFamily: fonts.body,
  },
  group: { color: colors.faint, fontFamily: fonts.medium, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: space.md, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 15.5 },
  empty: { color: colors.dim, fontFamily: fonts.body, textAlign: 'center', marginTop: space.lg },
});
