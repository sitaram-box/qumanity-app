/**
 * Step 3 · Present Location: where you live now, anywhere on Earth.
 *
 * Determines Public vs Global Account -- but that classification is the BACKEND's call
 * (account_access_type(), derived from present_location.country.id), never decided here. Picking
 * one of the 10 Sub-continent countries continues down to Village, same as before (Public
 * Account); any other country completes immediately at Country (Global Account) -- both outcomes
 * already fall out of LocationPicker's own isComplete()/autoDescend() logic unchanged; this
 * screen no longer restricts the picker to the 10 with `onlySubcontinent`, which is the one
 * functional change needed here (2026-11-08, Phase 2).
 */

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { childrenOf, SUBCONTINENT_IDS } from '@/api/locations';
import { LocationPicker } from '@/components/LocationPicker';
import { Button, Lead, Screen, Steps, Title } from '@/components/ui';
import { useApp } from '@/state/app';
import { space } from '@/theme';

export default function PresentLocation() {
  const { draft, setDraft } = useApp();
  const [complete, setComplete] = useState(false);
  const onComplete = useCallback((v: boolean) => setComplete(v), []);

  const birthLeaf = draft.birth[draft.birth.length - 1];
  const bornInSubcontinent = draft.birth.some((p) => p.tier === 'country' && SUBCONTINENT_IDS.includes(p.id));
  const canCopy = !!birthLeaf && birthLeaf.tier === 'village' && bornInSubcontinent && draft.present.length <= 1;

  // Start inside Asia -- a convenient default (most members live in the Sub-continent), not a
  // restriction: the picker itself offers every continent/country once the user changes it.
  useEffect(() => {
    if (draft.present.length) return;
    childrenOf(null, false).then(
      (continents) => {
        const asia = continents.find((c) => c.id === 'O_AS');
        if (asia) setDraft({ present: [asia] });
      },
      () => undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen scroll={false} footer={<Button title="Next · Review" onPress={() => router.push('/register/review')} disabled={!complete} />}>
      <Steps at={3} of={4} />
      <Title>Where do you live now?</Title>
      <Lead>
        If your country is one of the 10 in the Indian Sub-continent, you'll pick all the way down
        to your village and join its local groups. Any other country registers you with just your
        country -- you still join Qumanity worldwide.
      </Lead>
      {canCopy && (
        <Button title={`Same as birth place: ${birthLeaf.name}`} variant="ghost" onPress={() => setDraft({ present: draft.birth })} style={{ marginBottom: space.lg }} />
      )}
      <LocationPicker path={draft.present} onChange={(p) => setDraft({ present: p })} onComplete={onComplete} />
    </Screen>
  );
}
