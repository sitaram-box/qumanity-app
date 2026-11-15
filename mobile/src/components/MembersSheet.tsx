/**
 * A group's Members list (website social_core.member_display_row): avatar, name, gender, age
 * group, location, Founder/Admin/Member, "You" — founders first, then admins. Used by personal group chats and by
 * Family units. Rows for a hidden identity arrive already masked by the website.
 * Pass `onRemove` (Family units, when you are an admin) to show a Remove button per member; the
 * website refuses founders and explains any other refusal, which is shown under that member.
 * Family units pass `showMemberCount={false}`: this list is the chat roster, not the family, so its
 * length would contradict the family's own count (recursive_member_count) shown elsewhere.
 */

import { Fragment, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MemberRow } from '@/api/qumanity';
import { colors, fonts, radius, space, tint } from '@/theme';
import { Avatar } from './Avatar';
import { BottomSheet } from './BottomSheet';

const GENDER_LABEL: Record<string, string> = { male: 'Male', female: 'Female', both: 'Third gender' };
const ROLE_LABEL = { founder: 'Founder', admin: 'Admin', member: 'Member' } as const;
const ROLE_ORDER = { founder: 0, admin: 1, member: 2 } as const;
/** The website's `role`; an older website without it falls back to is_admin. */
const roleOf = (m: MemberRow) => m.role ?? (m.is_admin ? 'admin' : 'member');

export function MembersSheet({
  visible,
  onClose,
  title = 'Members',
  members,
  footer,
  onRemove,
  showMemberCount = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  members: MemberRow[] | null;
  /** e.g. the "Add by Public ID" box for admins */
  footer?: React.ReactNode;
  /** Admin-only removal; resolve on success, throw with the website's message on failure. */
  onRemove?: (userId: number) => Promise<unknown>;
  /** "· N" after the title. Default on (personal groups); family callers turn it off. */
  showMemberCount?: boolean;
}) {
  // A local copy so a removed member disappears at once, without reloading the whole list.
  const [list, setList] = useState<MemberRow[] | null>(members);
  const [busy, setBusy] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    setList(members);
    setRowError(null);
  }, [members]);

  async function remove(m: MemberRow) {
    if (!onRemove) return;
    setBusy(m.user_id);
    setRowError(null);
    try {
      await onRemove(m.user_id);
      setList((l) => (l ?? []).filter((x) => x.user_id !== m.user_id));
    } catch (e) {
      setRowError({ id: m.user_id, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function confirmRemove(m: MemberRow) {
    const text = `${m.name} will no longer see this family's chat. Their place in the family tree stays. Only an admin's invite can bring them back.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`Remove ${m.name}?\n${text}`)) remove(m);
      return;
    }
    Alert.alert(`Remove ${m.name}?`, text, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove(m) },
    ]);
  }

  const sorted = [...(list ?? [])].sort((a, b) => ROLE_ORDER[roleOf(a)] - ROLE_ORDER[roleOf(b)] || a.name.localeCompare(b.name));
  return (
    <BottomSheet visible={visible} onClose={onClose} style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.head}>
        <Text style={styles.title}>
          {title}
          {list && showMemberCount ? <Text style={styles.count}> · {list.length}</Text> : null}
        </Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled">
        {list === null && <Text style={styles.meta}>Loading…</Text>}
        {sorted.map((m) => (
          <Fragment key={m.user_id}>
          <View style={styles.row} accessibilityLabel={`${m.name}, ${ROLE_LABEL[roleOf(m)]}`}>
            <Avatar user={m} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {m.name}
                {m.you ? <Text style={styles.you}> · You</Text> : null}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[m.gender ? GENDER_LABEL[m.gender] ?? m.gender : null, m.age_group, m.present_location].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={[styles.role, roleOf(m) !== 'member' && { backgroundColor: tint(colors.gold) }]}>
              <Text style={[styles.roleText, roleOf(m) !== 'member' && { color: colors.gold }]}>{ROLE_LABEL[roleOf(m)]}</Text>
            </View>
            {/* The website refuses to remove a founder; anyone else (admin or member) can be removed. */}
            {onRemove && !m.you && roleOf(m) !== 'founder' && (
              <Pressable
                onPress={() => confirmRemove(m)}
                disabled={busy !== null}
                style={styles.removeBtn}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${m.name}`}
                hitSlop={6}
              >
                {busy === m.user_id ? <ActivityIndicator size="small" color={colors.danger} /> : <Text style={styles.removeText}>Remove</Text>}
              </Pressable>
            )}
          </View>
          {rowError?.id === m.user_id && <Text style={styles.rowError}>{rowError.text}</Text>}
          </Fragment>
        ))}
        {footer}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // Backdrop, colours, corners and the navigation-bar room come from BottomSheet.
  sheet: { paddingHorizontal: space.lg, paddingBottom: space.xl, paddingTop: space.sm, maxHeight: '85%' },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: space.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md, marginBottom: space.md },
  // A long title wraps in the space left over; Close never shrinks, so it can't be pushed off-screen.
  title: { flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  count: { color: colors.faint, fontFamily: fonts.body },
  close: { flexShrink: 0, color: colors.gold, fontFamily: fonts.medium },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 14.5 },
  you: { color: colors.gold, fontFamily: fonts.medium },
  meta: { color: colors.dim, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  role: { paddingHorizontal: 9, height: 24, borderRadius: radius.pill, backgroundColor: colors.panelRaised, justifyContent: 'center' },
  removeBtn: { height: 28, minWidth: 64, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.danger, fontFamily: fonts.bold, fontSize: 11.5 },
  rowError: { color: colors.danger, fontFamily: fonts.body, fontSize: 12, marginTop: -4, marginBottom: 6, marginLeft: 54 },
  roleText: { color: colors.dim, fontFamily: fonts.bold, fontSize: 11 },
});
