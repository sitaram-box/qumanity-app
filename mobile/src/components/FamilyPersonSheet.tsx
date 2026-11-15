/**
 * Family Tree person sheet: who this is (name, relationship to you, 🕊️ if deceased, on Qumanity or
 * not), "Link to account" for someone alive who isn't on Qumanity yet, and "Add family member":
 * Child / Sibling / Spouse / Parents — only the options the website will accept for this person
 * (familyAdd.logic.ts). A new person is an unlinked placeholder ("Tap to link") until someone links
 * them. Uses the website's existing routes; the website checks permissions and its message is shown
 * as-is if it refuses.
 */

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Q from '@/api/qumanity';
import { colors, fonts, radius, space } from '@/theme';
import { Avatar } from './Avatar';
import { type AddOption } from './familyAdd.logic';
import { Button, Chip, ErrorText, Field, Label } from './ui';

const GENDERS: { value: Q.Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'both', label: 'Third gender' },
];

export function FamilyPersonSheet({
  person,
  deceased,
  options,
  canLink,
  onLink,
  onClose,
  onAdded,
}: {
  person: Q.FamilyPerson | null;
  deceased: boolean;
  options: AddOption[];
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

  // Fresh form for each person / each option.
  useEffect(() => {
    setChoice(null);
  }, [person?.id]);
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
        });
        onAdded(`Added ${name.trim()}${passed ? '' : ' — tap them to link their account if they are on Qumanity'}.`);
      }
    } catch (e) {
      setError((e as Error).message); // the website's own reason, e.g. "Only an admin of this group can grow the tree here"
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {/* Its own provider: a Modal is a separate window, and the app's root layout reports a bottom
          inset of 0 to every screen, so the sheet measures the navigation bar / home indicator itself. */}
      <SafeAreaProvider>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
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
            <NavBarSpacer />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
  );
}

/** Room under the sheet's last button for the Android navigation bar (or iOS home indicator),
 * which the sheet otherwise draws underneath — on a real Android phone the Add buttons were
 * cut off and untappable. 0 where there's nothing to clear. */
function NavBarSpacer() {
  const { bottom } = useSafeAreaInsets();
  return <View style={{ height: bottom }} />;
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
  backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.ink,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: space.lg,
    paddingBottom: space.xl,
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
  meta: { color: colors.dim, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  close: { color: colors.gold, fontFamily: fonts.medium },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, borderRadius: radius.md },
  switchText: { color: colors.text, fontFamily: fonts.body, fontSize: 14 },
});
