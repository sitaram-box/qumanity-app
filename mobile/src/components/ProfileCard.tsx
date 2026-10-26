/**
 * The person you found by Public ID, shown so you can say "yes, that's them": photo (or initials +
 * gender badge), name, gender, age group and place — and never an ID.
 *
 * A member who keeps their identity private (website hide_identity, e.g. the Founder) gets the
 * masked card: "Private until you are family", initials only (no photo), gender, age group, and
 * their state. The website already masks this; the card just never prints the Account ID that
 * stands in for their name.
 *
 * <PublicIdLookup> is the reusable "type 12 digits -> Find -> card" field used by every
 * "Already on Qumanity?" spot (wizard people, linking a person in the tree, inviting).
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { colors, fonts, radius, space } from '@/theme';
import { Avatar } from './Avatar';
import { ErrorText, Field } from './ui';

const GENDER: Record<string, string> = { male: 'Male', female: 'Female', both: 'Third gender' };
export const PRIVATE_NAME = 'Private until you are family';
const group4 = (s: string) => s.replace(/(\d{4})(?=\d)/g, '$1 ');

/** The name to show for a found person (never the Account ID of a hidden member). */
export const displayName = (p: Q.FoundPerson) => (p.hidden ? PRIVATE_NAME : p.name);

export function ProfileCard({ person, right, compact }: { person: Q.FoundPerson; right?: React.ReactNode; compact?: boolean }) {
  const details = [GENDER[person.gender] ?? person.gender, person.age_group, person.location ?? person.place].filter(Boolean).join(' · ');
  return (
    <View style={[styles.card, compact && styles.compact]} accessibilityLabel={`${displayName(person)}. ${details}`}>
      <Avatar
        // Hidden: initials only. Their "name" is an Account ID, so use a neutral initial instead.
        user={person.hidden ? { name: '?', gender: person.gender } : person}
        size={compact ? 40 : 52}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, person.hidden && styles.private]} numberOfLines={2}>
          {displayName(person)}
        </Text>
        {!!details && <Text style={styles.meta}>{details}</Text>}
      </View>
      {right}
    </View>
  );
}

/**
 * 12-digit Public ID -> ProfileCard, looked up automatically as soon as the 12th digit is typed
 * (no Find button). `onFound` fires with the person found. `action` (e.g. a Link or Invite button)
 * is shown on the card.
 * Uncontrolled: the field keeps the digits and calls onFound(null) when they change.
 * Controlled (`code` + `onCode`): the parent keeps the digits — e.g. so a wizard's Next can look
 * them up itself — and must clear its own found person inside onCode (one state update, not two).
 */
export function PublicIdLookup({
  found,
  onFound,
  code: codeProp,
  onCode,
  label = 'Their 12-digit Public ID',
  action,
}: {
  found: Q.FoundPerson | null;
  onFound: (p: Q.FoundPerson | null) => void;
  code?: string;
  onCode?: (digits: string) => void;
  label?: string;
  action?: React.ReactNode;
}) {
  const [own, setOwn] = useState('');
  const code = codeProp ?? own;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // Look up the moment all 12 digits are in; a newer code (still typing/editing) cancels the
  // older lookup's result so a stale card can never appear.
  useEffect(() => {
    setError(undefined);
    if (code.length !== 12 || found) return;
    let live = true;
    setBusy(true);
    Q.searchPerson(code)
      .then((p) => live && onFound(p), (e) => live && setError((e as Error).message))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
      setBusy(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <View>
      <Field
        label={label}
        value={group4(code)}
        onChangeText={(t) => {
          const d = t.replace(/\D/g, '').slice(0, 12);
          if (onCode) return onCode(d);
          setOwn(d);
          if (found) onFound(null);
        }}
        keyboardType="number-pad"
        placeholder="1234 5678 9012"
      />
      {found ? (
        <ProfileCard person={found} compact right={action} />
      ) : busy ? (
        <ActivityIndicator color={colors.gold} style={{ alignSelf: 'flex-start', marginBottom: space.sm }} />
      ) : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.panelRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  compact: { padding: space.sm, gap: space.sm },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  private: { color: colors.dim, fontFamily: fonts.medium, fontStyle: 'italic' },
  meta: { color: colors.dim, fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
});
