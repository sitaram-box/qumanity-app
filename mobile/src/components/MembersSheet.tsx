/**
 * A group's Members list (website social_core.member_display_row): avatar, name, gender, age
 * group, location, Admin/Member, "You" — admins first. Used by personal group chats and by
 * Family units. Rows for a hidden identity arrive already masked by the website.
 */

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MemberRow } from '@/api/qumanity';
import { colors, fonts, radius, space, tint } from '@/theme';
import { Avatar } from './Avatar';

const GENDER_LABEL: Record<string, string> = { male: 'Male', female: 'Female', both: 'Third gender' };

export function MembersSheet({
  visible,
  onClose,
  title = 'Members',
  members,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  members: MemberRow[] | null;
  /** e.g. the "Add by Public ID" box for admins */
  footer?: React.ReactNode;
}) {
  const sorted = [...(members ?? [])].sort((a, b) => Number(b.is_admin) - Number(a.is_admin) || a.name.localeCompare(b.name));
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>
              {title}
              {members ? <Text style={styles.count}> · {members.length}</Text> : null}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {members === null && <Text style={styles.meta}>Loading…</Text>}
            {sorted.map((m) => (
              <View key={m.user_id} style={styles.row} accessibilityLabel={`${m.name}, ${m.is_admin ? 'Admin' : 'Member'}`}>
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
                <View style={[styles.role, m.is_admin && { backgroundColor: tint(colors.gold) }]}>
                  <Text style={[styles.roleText, m.is_admin && { color: colors.gold }]}>{m.is_admin ? 'Admin' : 'Member'}</Text>
                </View>
              </View>
            ))}
            {footer}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.ink, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: space.lg, paddingBottom: space.xl, paddingTop: space.sm, maxHeight: '85%', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: space.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  count: { color: colors.faint, fontFamily: fonts.body },
  close: { color: colors.gold, fontFamily: fonts.medium },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 14.5 },
  you: { color: colors.gold, fontFamily: fonts.medium },
  meta: { color: colors.dim, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  role: { paddingHorizontal: 9, height: 24, borderRadius: radius.pill, backgroundColor: colors.panelRaised, justifyContent: 'center' },
  roleText: { color: colors.dim, fontFamily: fonts.bold, fontSize: 11 },
});
