/**
 * "Add member by Public ID": type the 12-digit Public ID, see WHO it is (avatar + name), then
 * invite. Two steps on purpose — the website's invite routes take a resolved user_id, never a raw
 * Public ID (HANDOVER §4.15), so the person is always confirmed before anything is sent.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { colors, fonts, radius, space } from '@/theme';
import { Avatar } from './Avatar';
import { Button, ErrorText, Field } from './ui';

const group4 = (s: string) => s.replace(/(\d{4})(?=\d)/g, '$1 ');

export function PublicIdInvite({ onInvite, label = 'Add member by Public ID' }: { onInvite: (userId: number) => Promise<unknown>; label?: string }) {
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Q.FoundPerson | null>(null);
  const [busy, setBusy] = useState<'find' | 'invite' | null>(null);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<string | null>(null);
  const digits = code.replace(/\D/g, '');

  async function find() {
    setBusy('find');
    setError(undefined);
    setSent(null);
    setFound(null);
    try {
      setFound(await Q.searchPerson(digits));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function invite() {
    if (!found) return;
    setBusy('invite');
    setError(undefined);
    try {
      await onInvite(found.user_id);
      setSent(`Invitation sent to ${found.name}. They'll see it in their notifications.`);
      setFound(null);
      setCode('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{label}</Text>
      <Field
        label="12-digit Public ID"
        value={group4(digits)}
        onChangeText={(t) => {
          setCode(t.replace(/\D/g, '').slice(0, 12));
          setFound(null);
        }}
        keyboardType="number-pad"
        placeholder="1234 5678 9012"
      />
      {!found && <Button title="Find" variant="ghost" icon="search" onPress={find} busy={busy === 'find'} disabled={digits.length !== 12} />}
      {found && (
        <View style={styles.person}>
          <Avatar user={found} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{found.name}</Text>
            {!!found.place && <Text style={styles.meta}>{found.place}</Text>}
          </View>
          <Button title="Invite" size="sm" icon="person-add" onPress={invite} busy={busy === 'invite'} />
        </View>
      )}
      {sent && <Text style={styles.ok}>{sent}</Text>}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: space.lg, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.panel, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 14, marginBottom: space.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 14.5 },
  meta: { color: colors.dim, fontFamily: fonts.body, fontSize: 12 },
  ok: { color: colors.earth, fontFamily: fonts.medium, fontSize: 13, marginTop: space.sm },
});
