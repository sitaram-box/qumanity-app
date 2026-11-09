/**
 * Step 2 · Birth Location: where you were born, anywhere on Earth, down to the village if it's
 * in the Indian Sub-continent.
 *
 * Unchanged by Phase 2 (2026-11-08): this screen's own meaning and payload (draft.birth,
 * birth_location) have never been about account classification -- despite the function name
 * below, "Global account" here is historical naming for "worldwide picker," not a statement that
 * registering here makes this a Global Account. Account classification (Public vs Global) is
 * decided by the server from Present Location (the NEXT step), never from Birth Location.
 */

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { childrenOf } from '@/api/locations';
import { LocationPicker } from '@/components/LocationPicker';
import { Button, Lead, Screen, Steps, Title } from '@/components/ui';
import { useApp } from '@/state/app';

export default function GlobalAccount() {
  const { draft, setDraft } = useApp();
  const [complete, setComplete] = useState(false);
  const onComplete = useCallback((v: boolean) => setComplete(v), []);

  // Asia is pre-selected, as on the website.
  useEffect(() => {
    if (draft.birth.length) return;
    childrenOf(null).then((continents) => {
      const asia = continents.find((c) => c.id === 'O_AS');
      if (asia) setDraft({ birth: [asia] });
    }, () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen scroll={false} footer={<Button title="Next · Present Location" onPress={() => router.push('/register/public')} disabled={!complete} />}>
      <Steps at={2} of={4} />
      <Title>Where were you born?</Title>
      <Lead>Your birth place never changes. Your Private ID is kept in your birth village.</Lead>
      <LocationPicker path={draft.birth} onChange={(p) => setDraft({ birth: p })} onComplete={onComplete} />
    </Screen>
  );
}
