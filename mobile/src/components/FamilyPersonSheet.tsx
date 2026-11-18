/**
 * Family Tree person sheet: who this is (name, relationship to you, 🕊️ if deceased, on Qumanity or
 * not), "Link to account" for someone alive who isn't on Qumanity yet, and "Add family member":
 * Child / Sibling / Spouse / Parents — only the options the website will accept for this person
 * (familyAdd.logic.ts). A new person is an unlinked placeholder ("Tap to link") until someone links
 * them. Uses the website's existing routes; the website checks permissions and its message is shown
 * as-is if it refuses.
 *
 * 2026-11-18 (website e8b85e7): the sheet reads the person's cascade, so relationships that already
 * exist show as "View Spouse / View Children / View Siblings" (opening that family unit) and "Add
 * Spouse" disappears once a spouse is recorded. While a new relative's name is typed, the website
 * is asked whether that person is already on Qumanity; linking a match reuses their place in
 * another tree ('join') or asks them to confirm ('notify') instead of adding a duplicate.
 */

import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { colors, fonts, radius, space } from '@/theme';
import { Avatar } from './Avatar';
import { BottomSheet } from './BottomSheet';
import { relativeMatches, viewLinks, type AddOption, type CascadeLike, type RelativeMatch } from './familyAdd.logic';
import { Button, Chip, ErrorText, Field, Label } from './ui';

const GENDERS: { value: Q.Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'both', label: 'Third gender' },
];

export function FamilyPersonSheet({
  person,
  deceased,
  optionsFor,
  canLink,
  onLink,
  onClose,
  onAdded,
  onOpenUnit,
}: {
  person: Q.FamilyPerson | null;
  deceased: boolean;
  /** The Add options for this person, given what their cascade shows already exists. */
  optionsFor: (cascade: CascadeLike | null) => AddOption[];
  /** "View Spouse / Children / Siblings": open that family unit on the Family Tree screen. */
  onOpenUnit: (groupId: number) => void;
  /** Alive and not on Qumanity yet: offer the existing Public-ID link. */
  canLink: boolean;
  onLink: () => void;
  onClose: () => void;
  /** After a successful add: the parent reloads the tree. */
  onAdded: (message: string) => void;
}) {
  const [choice, setChoice] = useState<AddOption | null>(null);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Q.Gender | null>(null);
  const [passed, setPassed] = useState(false);
  const [father, setFather] = useState('');
  const [fatherPassed, setFatherPassed] = useState(false);
  const [mother, setMother] = useState('');
  const [motherPassed, setMotherPassed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [cascade, setCascade] = useState<Q.FamilyCascade | null>(null);
  const [matches, setMatches] = useState<RelativeMatch[]>([]);
  const [linkTo, setLinkTo] = useState<RelativeMatch | null>(null);

  // Fresh form for each person / each option; their cascade for the View links (none if it can't
  // be read — e.g. a relative outside your units; the Add options still work).
  useEffect(() => {
    setChoice(null);
    setCascade(null);
    if (!person) return;
    let live = true;
    Q.familyCascade(person.id).then(
      (c) => live && setCascade(c),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [person?.id]);

  // Is the person being added already on Qumanity? Asked a moment after typing stops.
  useEffect(() => {
    setMatches([]);
    setLinkTo(null);
    const n = name.trim();
    if (!choice || choice.kind === 'parents' || n.length < 3) return;
    let live = true;
    const t = setTimeout(() => {
      Q.familySuggest(n).then(
        (r) => live && setMatches(relativeMatches(r.results as { type: string }[]).slice(0, 4)),
        () => undefined,
      );
    }, 500);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [name, choice]);
  useEffect(() => {
    setName('');
    setPassed(false);
    setFather('');
    setFatherPassed(false);
    setMother('');
    setMotherPassed(false);
    setError(undefined);
    // A spouse is usually the opposite gender of the person; still editable.
    setGender(choice?.kind === 'spouse' && person?.gender === 'male' ? 'female' : choice?.kind === 'spouse' && person?.gender === 'female' ? 'male' : null);
  }, [choice, person?.gender]);

  if (!person) return null;
  const relation = person.is_viewer ? 'You' : person.relationship_to_viewer;
  const options = optionsFor(cascade);
  const views = viewLinks(cascade);

  function askLink(m: RelativeMatch) {
    const title = 'This person is already on Qumanity';
    const text =
      m.action === 'join'
        ? `Would you like to link ${m.name}? Their existing place in the family tree is used, instead of adding them twice.`
        : `Would you like to link ${m.name}? They'll be asked to confirm before it's final.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${title}\n${text}`)) setLinkTo(m);
      return;
    }
    Alert.alert(title, text, [
      { text: 'No, add as new', style: 'cancel' },
      { text: 'Link them', onPress: () => setLinkTo(m) },
    ]);
  }
  const isParents = choice?.kind === 'parents';
  const ready = isParents ? !!(father.trim() || mother.trim()) : !!(name.trim() && gender);

  async function add() {
    if (!choice || !person) return;
    setBusy(true);
    setError(undefined);
    try {
      if (choice.kind === 'parents') {
        const slot = (n: string, dead: boolean, g: Q.Gender): Q.FamilySlot | null =>
          n.trim() ? { name: n.trim(), action: 'create', is_deceased: dead, gender: g } : null;
        await Q.familyAddParents(choice.groupId!, choice.side!, slot(father, fatherPassed, 'male'), slot(mother, motherPassed, 'female'));
        onAdded(`Added ${person.name}'s parents.`);
      } else {
        await Q.familyAddRelative(choice.kind, person.id, {
          name: name.trim(),
          gender: gender ?? undefined,
          is_deceased: passed,
          ...(choice.kind === 'child' ? { group_id: choice.groupId } : {}),
          ...(linkTo ? { action: linkTo.action, matched_node_id: linkTo.matched_node_id, user_id: linkTo.user_id } : { action: 'create' as const }),
        });
        onAdded(
          linkTo?.action === 'join'
            ? `Linked ${linkTo.name} from their existing place in the family tree.`
            : linkTo?.action === 'notify'
              ? `Added ${name.trim()} — ${linkTo.name} has been asked to confirm.`
              : `Added ${name.trim()}${passed ? '' : ' — tap them to link their account if they are on Qumanity'}.`,
        );
      }
    } catch (e) {
      setError((e as Error).message); // the website's own reason, e.g. "Only an admin of this group can grow the tree here"
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet visible onClose={onClose} style={styles.sheet}>
        <View style={styles.head}>
          <Avatar user={person} size={44} color={person.is_viewer ? colors.gold : undefined} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>
              {person.name}
            </Text>
            <Text style={styles.meta}>
              {[relation, deceased ? '🕊️ Deceased' : person.claimed ? 'On Qumanity' : 'Not on Qumanity yet'].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.sm }}>
          {canLink && !choice && <Button title="Link to account" icon="link" variant="soft" onPress={onLink} />}

          {views.length > 0 && !choice && (
            <>
              <Label>Family</Label>
              <View style={styles.row}>
                {views.map((v) => (
                  <Chip key={v.kind} label={v.label} icon="arrow-forward" onPress={() => onOpenUnit(v.groupId)} />
                ))}
              </View>
            </>
          )}

          {options.length > 0 ? (
            <>
              <Label>Add family member</Label>
              <View style={styles.row}>
                {options.map((o) => (
                  <Chip key={o.kind} label={o.label} selected={choice?.kind === o.kind} onPress={() => setChoice(choice?.kind === o.kind ? null : o)} />
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.meta}>Only an admin of this family unit can add relatives here.</Text>
          )}

          {choice && !isParents && (
            <>
              <Field label={`${choice.label}'s name`} value={name} onChangeText={setName} autoCapitalize="words" maxLength={80} />
              {linkTo ? (
                <View style={styles.linkCard}>
                  <Text style={styles.linkTitle}>Linking {linkTo.name}</Text>
                  <Text style={styles.meta}>
                    {linkTo.action === 'join' ? 'Their existing place in the family tree is used.' : 'They will be asked to confirm.'}
                  </Text>
                  <Pressable onPress={() => setLinkTo(null)} accessibilityRole="button" hitSlop={6}>
                    <Text style={styles.close}>Add as a new person instead</Text>
                  </Pressable>
                </View>
              ) : (
                matches.length > 0 && (
                  <View style={styles.linkCard}>
                    <Text style={styles.linkTitle}>Already on Qumanity?</Text>
                    {matches.map((m) => (
                      <Pressable key={m.key} onPress={() => askLink(m)} style={styles.match} accessibilityRole="button" accessibilityLabel={`Link ${m.name}`}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.matchName}>{m.name}</Text>
                          <Text style={styles.meta} numberOfLines={2}>
                            {m.detail}
                          </Text>
                        </View>
                        <Text style={styles.close}>Link</Text>
                      </Pressable>
                    ))}
                  </View>
                )
              )}
              <View style={styles.row}>
                {GENDERS.map((g) => (
                  <Chip key={g.value} label={g.label} selected={gender === g.value} onPress={() => setGender(g.value)} />
                ))}
              </View>
              <PassedSwitch value={passed} onChange={setPassed} />
            </>
          )}

          {isParents && (
            <>
              <Text style={styles.meta}>At least one name. Both appear as a new parents' unit above {person.name}.</Text>
              <Field label="Father's name" value={father} onChangeText={setFather} autoCapitalize="words" maxLength={80} />
              <PassedSwitch value={fatherPassed} onChange={setFatherPassed} />
              <Field label="Mother's name" value={mother} onChangeText={setMother} autoCapitalize="words" maxLength={80} />
              <PassedSwitch value={motherPassed} onChange={setMotherPassed} />
            </>
          )}

          <ErrorText>{error}</ErrorText>
          {choice && <Button title={isParents ? 'Add parents' : `Add ${choice.label.toLowerCase()}`} icon="person-add" onPress={add} disabled={!ready} busy={busy} />}
        </ScrollView>
    </BottomSheet>
  );
}

/** The whole row toggles (a bigger target than the switch alone, label included). */
function PassedSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      style={styles.switchRow}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel="Has passed away"
    >
      <Text style={styles.switchText}>🕊️ Has passed away</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.gold, false: colors.line }} importantForAccessibility="no" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Backdrop, colours, corners and the navigation-bar room come from BottomSheet.
  sheet: { maxHeight: '88%', padding: space.lg, paddingBottom: space.xl, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
  meta: { color: colors.dim, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  close: { color: colors.gold, fontFamily: fonts.medium },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, borderRadius: radius.md },
  switchText: { color: colors.text, fontFamily: fonts.body, fontSize: 14 },
  linkCard: { borderWidth: 1, borderColor: colors.gold, borderRadius: radius.md, padding: space.md, gap: 6 },
  linkTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  match: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  matchName: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
});
