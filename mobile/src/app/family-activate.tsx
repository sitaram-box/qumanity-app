/**
 * Build your Family Tree: the 6-step Activation wizard, mirroring the website's
 * static/js/family.js step for step so both create the same tree.
 *
 *   1 Parents (+ optional grandparents)   2 Your status (the branching point)
 *   3 Spouse  (married/separated/divorced/widowed only; optional Public ID link + spouse's parents)
 *   4 Children (same — skipped for Single)   5 Discover (join an existing unit / notify a member /
 *   create new, per person)   6 Review -> POST /api/family/activate, then /api/family/marry.
 * Marriage is automatic on the website (2026-10-26): joining as a spouse (or giving their Public ID)
 * makes this member co-founder/admin of the spouse's unit and a member of the spouse's parents'
 * unit at once — no approval — so the spouse option reads "Join instantly".
 *
 * Every person becomes a slot {name, action: create|join|notify, ...} exactly as
 * family_core._resolve_slot() expects, so Step 6 only picks slots out by key.
 *
 * Every person can be "Already on Qumanity? Link by Public ID" (2026-10-26): Next looks up any
 * typed 12-digit ID itself, the person is shown as a ProfileCard (never an ID; a private member
 * shows as "Private until you are family"), and their slot becomes {action: "notify", user_id}.
 * The website then reuses their place in the tree if they already have one, or creates one and
 * invites them.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ApiError } from '@/api/client';
import * as Q from '@/api/qumanity';
import { Avatar } from '@/components/Avatar';
import { PublicIdLookup } from '@/components/ProfileCard';
import { BackHeader, Button, Chip, ErrorText, Field, Label, Lead, Screen, Steps, Title } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

/** One person in the wizard; `found` is set once their Public ID has been looked up. */
type Person = { name: string; deceased: boolean; onApp: boolean; code: string; found: Q.FoundPerson | null };
type Child = Person & { gender: Q.Gender | null };
type Step = 'parents' | 'status' | 'spouse' | 'children' | 'discover' | 'review' | 'done';
type Slot = Q.FamilySlot & { key: string; label: string; skipDiscover?: boolean; resolved?: boolean };

const STEP_NO: Record<Exclude<Step, 'done'>, number> = { parents: 1, status: 2, spouse: 3, children: 4, discover: 5, review: 6 };
const STATUS: { value: Q.Relationship; label: string }[] = [
  { value: 'single', label: 'Single / Never married' },
  { value: 'married', label: 'Married' },
  { value: 'separated', label: 'Separated' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
];
// Same mapping as the website: the wizard's answer -> family_groups.marriage_status.
const MARRIAGE_STATUS: Record<Exclude<Q.Relationship, 'single'>, 'active' | 'separated' | 'dissolved'> = {
  married: 'active',
  separated: 'separated',
  divorced: 'dissolved',
  widowed: 'active',
};
const SPOUSE_TITLE: Record<Exclude<Q.Relationship, 'single'>, string> = {
  married: 'Your spouse',
  separated: 'Your former spouse',
  divorced: 'Your former spouse',
  widowed: 'Your late spouse',
};
const CHILD_GENDER: { value: Q.Gender; label: string }[] = [
  { value: 'male', label: 'Son' },
  { value: 'female', label: 'Daughter' },
  { value: 'both', label: 'Third gender' },
];
const empty = (): Person => ({ name: '', deceased: false, onApp: false, code: '', found: null });
const emptyChild = (): Child => ({ ...empty(), gender: null });
/** The name to record: what they typed, else the found member's real name (never a private one). */
const nameOf = (p: Person) => p.name.trim() || (p.found && !p.found.hidden ? p.found.name : '');

export default function FamilyActivate() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('parents');
  const [error, setError] = useState<string>();

  // Step 1
  const [father, setFather] = useState<Person>(empty());
  const [mother, setMother] = useState<Person>(empty());
  const [gpKnown, setGpKnown] = useState<boolean | null>(null);
  const [gp, setGp] = useState<Record<'ff' | 'fm' | 'mf' | 'mm', Person>>({ ff: empty(), fm: empty(), mf: empty(), mm: empty() });
  // Step 2
  const [relationship, setRelationship] = useState<Q.Relationship | null>(null);
  // Step 3
  const [spouse, setSpouse] = useState<Person>(empty());
  const [searching, setSearching] = useState(false);
  const [spParentsKnown, setSpParentsKnown] = useState<boolean | null>(null);
  const [sf, setSf] = useState<Person>(empty());
  const [sm, setSm] = useState<Person>(empty());
  // Step 4
  const [hasChildren, setHasChildren] = useState<boolean | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  // Step 5
  const [slots, setSlots] = useState<Slot[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, Q.FamilySuggestion[] | 'loading' | 'error'>>({});
  const [decided, setDecided] = useState<Record<string, string>>({});
  // Step 6
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ activate: Q.FamilyResult; marry?: Q.FamilyResult; marryError?: string; alreadyMarried?: boolean } | null>(null);

  const go = (s: Step) => {
    setError(undefined);
    setStep(s);
  };
  const married = relationship !== null && relationship !== 'single';

  /**
   * Before leaving a step: anyone switched to "Already on Qumanity" whose 12-digit ID was typed
   * but not looked up is looked up now (no separate Find tap needed). Returns the updated people,
   * or null with the error shown (ID not 12 digits, not found, or a private member with no name).
   */
  async function resolve(people: { p: Person; set: (p: Person) => void; label: string }[]): Promise<Person[] | null> {
    setError(undefined);
    setSearching(true);
    try {
      const out: Person[] = [];
      for (const { p, set, label } of people) {
        let next = p;
        if (p.onApp && !p.found) {
          if (p.code.length !== 12) {
            setError(`${label}: enter their 12-digit Public ID, or switch off "Already on Qumanity".`);
            return null;
          }
          try {
            const found = await Q.searchPerson(p.code);
            next = { ...p, found, name: p.name.trim() ? p.name : found.hidden ? p.name : found.name };
            set(next);
          } catch (e) {
            setError(`${label}: ${(e as Error).message}`);
            return null;
          }
        }
        if (next.found?.hidden && !next.name.trim()) {
          setError(`${label}: their name is private — type it as you know them.`);
          return null;
        }
        out.push(next);
      }
      return out;
    } finally {
      setSearching(false);
    }
  }
  const gpSetter = (k: 'ff' | 'fm' | 'mf' | 'mm') => (v: Person) => setGp((g) => ({ ...g, [k]: v }));

  // ---- Step 1 ----
  async function nextFromParents() {
    const r = await resolve([
      { p: father, set: setFather, label: 'Father' },
      { p: mother, set: setMother, label: 'Mother' },
      ...(gpKnown
        ? ([
            ['ff', "Father's father"],
            ['fm', "Father's mother"],
            ['mf', "Mother's father"],
            ['mm', "Mother's mother"],
          ] as const).map(([k, label]) => ({ p: gp[k], set: gpSetter(k), label }))
        : []),
    ]);
    if (!r) return;
    if (!nameOf(r[0]) || !nameOf(r[1])) return setError("Both parents' names are required.");
    go('status');
  }

  // ---- Step 2 ----
  function nextFromStatus() {
    if (!relationship) return setError('Please choose your relationship status.');
    if (relationship === 'single') return enterDiscover([]);
    go('spouse');
  }

  // ---- Step 3 ----
  async function nextFromSpouse() {
    const r = await resolve([
      { p: spouse, set: setSpouse, label: 'Spouse' },
      ...(spParentsKnown
        ? [
            { p: sf, set: setSf, label: "Spouse's father" },
            { p: sm, set: setSm, label: "Spouse's mother" },
          ]
        : []),
    ]);
    if (!r) return;
    if (!nameOf(r[0])) return setError("Spouse's name is required.");
    go('children');
  }

  // ---- Step 4 ----
  async function nextFromChildren() {
    if (hasChildren === null) return setError('Please choose Yes or No.');
    if (!hasChildren) return enterDiscover([]);
    const r = await resolve(
      children.map((c, i) => ({
        p: c,
        set: (v: Person) => setChildren((all) => all.map((x, j) => (j === i ? { ...x, ...v } : x))),
        label: `Child ${i + 1}`,
      })),
    );
    if (!r) return;
    const kids: Child[] = r.map((p, i) => ({ ...children[i], ...p }));
    const named = kids.filter((c) => nameOf(c));
    const missing = named.find((c) => !c.gender);
    if (missing) return setError(`Please choose Son, Daughter or Third gender for ${nameOf(missing)}.`);
    if (!named.length) return setError('Add at least one child, or choose No.');
    enterDiscover(named);
  }

  // ---- Step 5: build the slots, then look each person up ----
  /** A linked person -> {action: "notify", user_id} (already resolved); anyone else -> "create". */
  const personSlot = (key: string, label: string, p: Person, extra: Partial<Slot> = {}): Slot =>
    p.found
      ? { key, label, name: nameOf(p), action: 'notify', user_id: p.found.user_id, resolved: true, ...extra, is_deceased: undefined }
      : { key, label, name: nameOf(p), is_deceased: p.deceased, action: 'create', ...extra };

  function enterDiscover(kids: Child[]) {
    const list: Slot[] = [personSlot('father', 'Father', father), personSlot('mother', 'Mother', mother)];
    // Grandparents and the spouse's parents skip the name-matching step (same scoped
    // simplification as the website): each is either linked by Public ID or created new.
    if (gpKnown) {
      (
        [
          ['ff', 'father_father', "Father's father"],
          ['fm', 'father_mother', "Father's mother"],
          ['mf', 'mother_father', "Mother's father"],
          ['mm', 'mother_mother', "Mother's mother"],
        ] as const
      ).forEach(([k, key, label]) => {
        if (nameOf(gp[k])) list.push(personSlot(key, label, gp[k], { skipDiscover: true }));
      });
    }
    if (relationship && relationship !== 'single') {
      // Widowed marks a newly created spouse as deceased, as on the website.
      list.push(personSlot('spouse', 'Spouse', { ...spouse, deceased: relationship === 'widowed' }));
      if (spParentsKnown) {
        if (nameOf(sf)) list.push(personSlot('spouse_father', "Spouse's father", sf, { skipDiscover: true }));
        if (nameOf(sm)) list.push(personSlot('spouse_mother', "Spouse's mother", sm, { skipDiscover: true }));
      }
    }
    kids.forEach((c, i) => list.push(personSlot(`child_${i + 1}`, `Child ${i + 1}`, c, { gender: c.gender ?? undefined })));

    setSlots(list);
    setDecided({});
    const pending: Record<string, 'loading'> = {};
    list.filter((s) => !s.resolved && !s.skipDiscover).forEach((s) => (pending[s.key] = 'loading'));
    setSuggestions(pending);
    go('discover');
    list
      .filter((s) => !s.resolved && !s.skipDiscover)
      .forEach((s) =>
        Q.familySuggest(s.name).then(
          (d) => setSuggestions((m) => ({ ...m, [s.key]: d.results.filter(Q.isWizardSuggestion) })),
          () => setSuggestions((m) => ({ ...m, [s.key]: 'error' })),
        ),
      );
  }

  /** Set one person's action. Clears any earlier join/notify target first; an empty `text`
   * re-opens the suggestions for that person. */
  function choose(key: string, patch: Partial<Q.FamilySlot>, text: string) {
    setSlots((all) =>
      all.map((s) => {
        if (s.key !== key) return s;
        const next: Slot = { ...s, ...patch };
        if (patch.action !== 'join') delete next.group_id, delete next.matched_node_id;
        if (patch.action !== 'notify') delete next.user_id;
        return next;
      }),
    );
    setDecided((d) => ({ ...d, [key]: text }));
  }

  // ---- Step 6: submit ----
  const slot = (key: string): Q.FamilySlot | null => {
    const s = slots.find((x) => x.key === key);
    if (!s) return null;
    const out: Q.FamilySlot = { name: s.name, action: s.action };
    if (s.is_deceased) out.is_deceased = true;
    if (s.gender) out.gender = s.gender;
    if (s.group_id) out.group_id = s.group_id;
    if (s.matched_node_id) out.matched_node_id = s.matched_node_id;
    if (s.user_id) out.user_id = s.user_id;
    return out;
  };

  async function marry(): Promise<{ marry?: Q.FamilyResult; marryError?: string; alreadyMarried?: boolean }> {
    if (!relationship || relationship === 'single') return {};
    try {
      const m = await Q.familyMarry({
        spouse: slot('spouse')!,
        children: slots.filter((s) => s.key.startsWith('child_')).map((s) => slot(s.key)!),
        marriage_status: MARRIAGE_STATUS[relationship],
        spouse_father: slot('spouse_father'),
        spouse_mother: slot('spouse_mother'),
      });
      return { marry: m };
    } catch (e) {
      // Already the spouse in a recorded marriage (e.g. their partner added and linked them):
      // the website refuses a second one, which is correct — the couple's unit exists. Success.
      if (e instanceof ApiError && e.status === 400 && /already have an active marriage/i.test(e.message)) return { alreadyMarried: true };
      return { marryError: (e as Error).message };
    }
  }

  async function activate() {
    setBusy(true);
    setError(undefined);
    try {
      const a = await Q.familyActivate({
        father: slot('father')!,
        mother: slot('mother')!,
        relationship: relationship!,
        father_father: slot('father_father'),
        father_mother: slot('father_mother'),
        mother_father: slot('mother_father'),
        mother_mother: slot('mother_mother'),
      });
      // Activation has succeeded at this point; a spouse problem never undoes it.
      setResult({ activate: a, ...(await marry()) });
      go('done');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function retryMarry() {
    if (!result) return;
    setBusy(true);
    const m = await marry();
    setResult({ ...result, ...m, marryError: m.marryError, alreadyMarried: m.alreadyMarried });
    setBusy(false);
  }

  // ---- Render ----
  const back: Partial<Record<Step, Step>> = {
    status: 'parents',
    spouse: 'status',
    children: 'spouse',
    discover: married ? 'children' : 'status',
    review: 'discover',
  };
  const footer =
    step === 'done' ? (
      <Button title="Open my Family Tree" icon="git-network" onPress={() => router.back()} />
    ) : (
      <View style={styles.footerRow}>
        {back[step] && <Button title="Back" variant="ghost" onPress={() => go(back[step]!)} style={{ flex: 1 }} />}
        {step === 'review' ? (
          <Button title="Activate" icon="checkmark-circle" onPress={activate} busy={busy} style={{ flex: 2 }} />
        ) : (
          <Button
            title="Next"
            onPress={
              step === 'parents'
                ? nextFromParents
                : step === 'status'
                  ? nextFromStatus
                  : step === 'spouse'
                    ? nextFromSpouse
                    : step === 'children'
                      ? nextFromChildren
                      : () => go('review')
            }
            busy={step === 'spouse' && searching}
            disabled={step === 'discover' && Object.values(suggestions).includes('loading')}
            style={{ flex: 2 }}
          />
        )}
      </View>
    );

  return (
    <Screen footer={footer}>
      <BackHeader title="Build your Family Tree" />
      {step !== 'done' && <Steps at={STEP_NO[step]} of={6} />}

      {step === 'parents' && (
        <>
          <Title>Your parents</Title>
          <Lead>Your parents and you form your first family unit. Mark anyone who has passed away.</Lead>
          <PersonInput label="Father's name" value={father} onChange={setFather} />
          <PersonInput label="Mother's name" value={mother} onChange={setMother} />
          <YesNo label="Do you know your grandparents' names? (optional)" value={gpKnown} onChange={setGpKnown} />
          {gpKnown && (
            <View style={styles.card}>
              <PersonInput label="Father's father" value={gp.ff} onChange={gpSetter('ff')} />
              <PersonInput label="Father's mother" value={gp.fm} onChange={gpSetter('fm')} />
              <PersonInput label="Mother's father" value={gp.mf} onChange={gpSetter('mf')} />
              <PersonInput label="Mother's mother" value={gp.mm} onChange={gpSetter('mm')} />
            </View>
          )}
        </>
      )}

      {step === 'status' && (
        <>
          <Title>Your status</Title>
          <Lead>This decides whether we ask about a spouse and children next.</Lead>
          <View style={styles.choices}>
            {STATUS.map((s) => (
              <Chip key={s.value} label={s.label} selected={relationship === s.value} onPress={() => setRelationship(s.value)} />
            ))}
          </View>
        </>
      )}

      {step === 'spouse' && relationship && relationship !== 'single' && (
        <>
          <Title>{SPOUSE_TITLE[relationship]}</Title>
          <PersonInput label="Name" value={spouse} onChange={setSpouse} allowDeceased={false} />
          {relationship === 'widowed' && !spouse.onApp && <Text style={styles.hint}>They will be remembered as having passed away.</Text>}
          <YesNo label="Do you know your spouse's parents' names? (optional)" value={spParentsKnown} onChange={setSpParentsKnown} />
          {spParentsKnown && (
            <View style={styles.card}>
              <PersonInput label="Spouse's father" value={sf} onChange={setSf} />
              <PersonInput label="Spouse's mother" value={sm} onChange={setSm} />
            </View>
          )}
        </>
      )}

      {step === 'children' && (
        <>
          <Title>Your children</Title>
          <YesNo
            label="Do you have children?"
            value={hasChildren}
            onChange={(v) => {
              setHasChildren(v);
              if (v && children.length === 0) setChildren([emptyChild()]);
            }}
          />
          {hasChildren &&
            children.map((c, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.childHead}>
                  <Text style={styles.k}>Child {i + 1}</Text>
                  <Pressable onPress={() => setChildren(children.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Remove child ${i + 1}`} hitSlop={8}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                </View>
                <PersonInput label="Name" value={c} onChange={(v) => setChildren((all) => all.map((x, j) => (j === i ? { ...x, ...v } : x)))} />
                <View style={styles.choices}>
                  {CHILD_GENDER.map((g) => (
                    <Chip key={g.value} label={g.label} selected={c.gender === g.value} onPress={() => setChildren(children.map((x, j) => (j === i ? { ...x, gender: g.value } : x)))} />
                  ))}
                </View>
              </View>
            ))}
          {hasChildren && <Button title="Add another child" variant="ghost" icon="add" onPress={() => setChildren([...children, emptyChild()])} />}
        </>
      )}

      {step === 'discover' && (
        <>
          <Title>Is your family already here?</Title>
          <Lead>We looked for each name. Join an existing family unit, notify a member, or create a new profile. New is the default.</Lead>
          {slots.map((s) => {
            const sug = suggestions[s.key];
            return (
              <View key={s.key} style={styles.card}>
                <Text style={styles.v}>
                  {s.label}: {s.name}
                </Text>
                {s.resolved ? (
                  <Text style={styles.ok}>✓ Linked by Public ID to their Qumanity account.</Text>
                ) : s.skipDiscover ? (
                  <Text style={styles.hint}>A new profile will be created.</Text>
                ) : decided[s.key] ? (
                  <View style={styles.decidedRow}>
                    <Text style={[styles.ok, { flex: 1 }]}>✓ {decided[s.key]}</Text>
                    <Pressable onPress={() => choose(s.key, { action: 'create' }, '')} accessibilityRole="button" hitSlop={8}>
                      <Text style={styles.remove}>Change</Text>
                    </Pressable>
                  </View>
                ) : sug === 'loading' ? (
                  <ActivityIndicator color={colors.gold} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
                ) : sug === 'error' || !sug || sug.length === 0 ? (
                  <Text style={styles.hint}>{sug === 'error' ? "Couldn't check — " : 'No existing match — '}a new profile will be created.</Text>
                ) : (
                  <>
                    {forSlot(s.key, sug).length === 0 && <Text style={styles.hint}>No family unit to join as their spouse — a new profile will be created.</Text>}
                    {forSlot(s.key, sug).map((m, i) =>
                      m.type === 'group' ? (
                        <View key={i} style={styles.suggestion}>
                          <Text style={styles.v}>{founders(m)}</Text>
                          <Text style={styles.hint}>
                            {m.group_name} · {m.member_count} {m.member_count === 1 ? 'member' : 'members'} · {m.matched_name}
                            {m.matched_role === 'child' ? ' is a child here' : m.matched_role ? ' founded this family' : ''}
                          </Text>
                          <Button
                            title={s.key === 'spouse' ? 'Join instantly' : 'Request to join'}
                            size="sm"
                            onPress={() =>
                              choose(
                                s.key,
                                { action: 'join', group_id: m.group_id, matched_node_id: m.matched_node_id },
                                s.key === 'spouse' ? `Will join ${founders(m)} as ${m.matched_name}'s spouse.` : `Will ask to join ${founders(m)}.`,
                              )
                            }
                          />
                        </View>
                      ) : (
                        <View key={i} style={styles.suggestion}>
                          <View style={styles.found}>
                            <Avatar user={m} size={32} />
                            <Text style={[styles.hint, { flex: 1 }]}>{m.name} is on Qumanity but hasn't built their Family Tree yet.</Text>
                          </View>
                          <Button
                            title="Notify them"
                            size="sm"
                            variant="ghost"
                            onPress={() => choose(s.key, { action: 'notify', user_id: m.user_id }, `Will notify ${m.name} to activate.`)}
                          />
                        </View>
                      ),
                    )}
                    <Button title="Not them — create new" size="sm" variant="ghost" onPress={() => choose(s.key, { action: 'create' }, `Will create a new profile for ${s.name}.`)} />
                  </>
                )}
              </View>
            );
          })}
        </>
      )}

      {step === 'review' && (
        <>
          <Title>Review</Title>
          <View style={styles.card}>
            <Row k="Your status" v={STATUS.find((s) => s.value === relationship)?.label ?? ''} />
            {slots.map((s) => (
              <Row
                key={s.key}
                k={s.label}
                v={`${s.name}${s.gender ? ` (${CHILD_GENDER.find((g) => g.value === s.gender)?.label})` : ''}${s.is_deceased ? ' (passed away)' : ''} — ${
                  s.action === 'join' ? 'request to join an existing unit' : s.action === 'notify' ? 'link to their Qumanity account' : 'create a new profile'
                }`}
              />
            ))}
          </View>
          <Text style={styles.hint}>Activation can be done once. You can add parents, children and corrections later from the Family Tree.</Text>
        </>
      )}

      {step === 'done' && result && (
        <>
          <Title>Your Family Tree is active</Title>
          {result.activate.parents_group_name && <Row k="Your parents' family" v={result.activate.parents_group_name} />}
          {result.marry?.marital_group_name && <Row k="Your own family" v={result.marry.marital_group_name} />}
          {result.marry?.auto_joined && (
            <Row
              k="Your family"
              v={`You joined ${result.marry.auto_joined.name}'s family unit as their spouse — you are an admin there, and a member of their parents' family.`}
            />
          )}
          {[...result.activate.joined_requests, ...(result.marry?.joined_requests ?? [])].map((j, i) => (
            <Row key={`j${i}`} k="Join request sent" v={`${j.name} — an admin of that family will approve it`} />
          ))}
          {!!result.marry?.children_not_added && (
            <Row
              k="Your children"
              v={`Not added here (${result.marry.children_not_added}). Once your spouse approves, either of you can add them in your family unit.`}
            />
          )}
          {[...result.activate.notified, ...(result.marry?.notified ?? [])].map((n, i) => (
            <Row key={`n${i}`} k={n.name} v={linkedText(n.label, result)} />
          ))}
          {result.alreadyMarried && (
            <Row k="Your marriage" v="Already recorded in your spouse's family — you're linked there as their partner." />
          )}
          {result.marryError && (
            <View style={[styles.card, { borderColor: colors.saffron }]}>
              <Text style={styles.v}>Your tree is active, but adding your spouse ran into a problem:</Text>
              <Text style={styles.hint}>{result.marryError}</Text>
              <Button title="Try adding your spouse again" variant="ghost" onPress={retryMarry} busy={busy} />
            </View>
          )}
        </>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

/** Who founded a suggested unit — units can share a name (e.g. someone's parents' unit and their own). */
function founders(m: Extract<Q.FamilySuggestion, { type: 'group' }>): string {
  return [m.husband_name, m.wife_name].filter(Boolean).join(' & ') || m.group_name;
}

/** The spouse may only join a unit where the matched person is a FOUNDER with an open partner
 * place (never e.g. their parents' unit, where they are a child). Other people see every match. */
function forSlot(key: string, sug: Q.FamilySuggestion[]): Q.FamilySuggestion[] {
  if (key !== 'spouse') return sug;
  return sug.filter((m) => m.type !== 'group' || ((m.matched_role === 'husband' || m.matched_role === 'wife') && m.partner_slot_open === true));
}

/** How a linked person ended up: their existing place in the tree was used, or they were invited. */
function linkedText(label: string, result: { activate: Q.FamilyResult; marry?: Q.FamilyResult }): string {
  const entry = [...(result.activate.created_node_ids ?? []), ...(result.marry?.created_node_ids ?? [])].find((n) => n.label === label);
  return entry?.linked_existing
    ? 'Linked to their own place in the Family Tree.'
    : "Invited to build their Family Tree. An admin can link them to their account from the tree.";
}

/** Name, "passed away", and "Already on Qumanity? Link by Public ID" -> ProfileCard. */
function PersonInput({ label, value, onChange, allowDeceased = true }: { label: string; value: Person; onChange: (p: Person) => void; allowDeceased?: boolean }) {
  return (
    <View>
      <Field label={label} value={value.name} onChangeText={(t) => onChange({ ...value, name: t })} maxLength={80} />
      <View style={[styles.switchRow, { marginTop: -space.sm }]}>
        <Text style={styles.hint}>Already on Qumanity? Link by Public ID</Text>
        <Switch
          value={value.onApp}
          onValueChange={(v) => onChange({ ...value, onApp: v, found: null, deceased: v ? false : value.deceased })}
          trackColor={{ true: colors.gold, false: colors.line }}
          accessibilityLabel={`${label}: already on Qumanity`}
        />
      </View>
      {value.onApp ? (
        <View style={styles.linkBox}>
          <PublicIdLookup
            code={value.code}
            onCode={(d) => onChange({ ...value, code: d, found: null })}
            found={value.found}
            onFound={(p) => onChange({ ...value, found: p, name: value.name.trim() || !p || p.hidden ? value.name : p.name })}
          />
          {value.found?.hidden && !value.name.trim() && <Text style={styles.hint}>Their name is private — type it above as you know them.</Text>}
        </View>
      ) : (
        allowDeceased && (
          <View style={styles.switchRow}>
            <Text style={styles.hint}>Passed away</Text>
            <Switch value={value.deceased} onValueChange={(v) => onChange({ ...value, deceased: v })} trackColor={{ true: colors.faint, false: colors.line }} accessibilityLabel={`${label}: passed away`} />
          </View>
        )
      )}
    </View>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <View style={{ marginTop: space.md }}>
      <Label>{label}</Label>
      <View style={styles.choices}>
        <Chip label="Yes" selected={value === true} onPress={() => onChange(true)} />
        <Chip label="No" selected={value === false} onPress={() => onChange(false)} />
      </View>
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ paddingVertical: 5 }}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', gap: space.sm },
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: space.md, marginTop: space.sm, marginBottom: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, gap: 6 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, marginVertical: space.xs },
  switchLabel: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  found: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  linkBox: { paddingLeft: space.sm, borderLeftWidth: 2, borderColor: colors.gold, marginBottom: space.sm },
  suggestion: { gap: 6, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  decidedRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  childHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  k: { color: colors.faint, fontFamily: fonts.medium, fontSize: 12 },
  v: { color: colors.text, fontFamily: fonts.medium, fontSize: 14.5 },
  hint: { color: colors.dim, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
  ok: { color: colors.earth, fontFamily: fonts.medium, fontSize: 13 },
  remove: { color: colors.gold, fontFamily: fonts.medium, fontSize: 12.5 },
});
