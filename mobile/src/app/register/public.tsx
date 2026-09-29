/** Step 3 · Public account: where you live now — one of the 10 Sub-continent countries, down to the village. */

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { childrenOf, SUBCONTINENT_IDS } from '@/api/locations';
import { LocationPicker } from '@/components/LocationPicker';
import { Button, Lead, Screen, Steps, Title } from '@/components/ui';
import { useApp } from '@/state/app';
import { space } from '@/theme';

export default function PublicAccount() {
  const { draft, setDraft } = useApp();
  const [complete, setComplete] = useState(false);
  const onComplete = useCallback((v: boolean) => setComplete(v), []);

  const birthLeaf = draft.birth[draft.birth.length - 1];
  const bornInSubcontinent = draft.birth.some((p) => p.tier === 'country' && SUBCONTINENT_IDS.includes(p.id));
  const canCopy = !!birthLeaf && birthLeaf.tier === 'village' && bornInSubcontinent && draft.present.length <= 1;

  // Start inside Asia: the 10 Sub-continent countries.
  useEffect(() => {
    if (draft.present.length) return;
    childrenOf(null, true).then((c) => c[0] && setDraft({ present: [c[0]] }), () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen scroll={false} footer={<Button title="Next · Review" onPress={() => router.push('/register/review')} disabled={!complete} />}>
      <Steps at={3} of={4} />
      <Title>Where do you live now?</Title>
      <Lead>You join the groups of this place, from your village up to Earth. It must be in the Indian Sub-continent.</Lead>
      {canCopy && (
        <Button title={`Same as birth place: ${birthLeaf.name}`} variant="ghost" onPress={() => setDraft({ present: draft.birth })} style={{ marginBottom: space.lg }} />
      )}
      <LocationPicker path={draft.present} onChange={(p) => setDraft({ present: p })} onlySubcontinent onComplete={onComplete} />
    </Screen>
  );
}
