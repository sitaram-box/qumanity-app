/**
 * "Add member by Public ID": type the 12-digit Public ID; the person is looked up as soon as the
 * 12th digit is in and shown as a ProfileCard with an Invite button. Two steps on purpose — the
 * website's invite routes take a resolved user_id, never a raw Public ID (HANDOVER §4.15), so the
 * person is always confirmed before anything is sent.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { colors, fonts, radius, space } from '@/theme';
import { PublicIdLookup } from './ProfileCard';
import { Button, ErrorText } from './ui';

export function PublicIdInvite({ onInvite, label = 'Add member by Public ID' }: { onInvite: (userId: number) => Promise<unknown>; label?: string }) {
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Q.FoundPerson | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<string | null>(null);

  async function invite() {
    if (!found) return;
    setBusy(true);
    setError(undefined);
    try {
      await onInvite(found.user_id);
      setSent(`Invitation sent${found.hidden ? '' : ` to ${found.name}`}. They'll see it in their notifications.`);
      setFound(null);
      setCode('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{label}</Text>
      <PublicIdLookup
        label="12-digit Public ID"
        code={code}
        onCode={(d) => {
          setCode(d);
          setFound(null);
          setSent(null);
        }}
        found={found}
        onFound={setFound}
        action={<Button title="Invite" size="sm" icon="person-add" onPress={invite} busy={busy} />}
      />
      {sent && <Text style={styles.ok}>{sent}</Text>}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: space.lg, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.panel, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 14, marginBottom: space.sm },
  ok: { color: colors.earth, fontFamily: fonts.medium, fontSize: 13, marginTop: space.sm },
});
