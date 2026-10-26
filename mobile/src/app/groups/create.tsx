/**
 * Create a new Personal-timeline group (the single "+" on the Personal tab, 2026-09-28): name it,
 * pick which bucket it belongs in. It's created as Custom on the server, then immediately moved
 * into the chosen category — Friends/Business are never created directly (family lives in the
 * Family Tree now).
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import * as Q from '@/api/qumanity';
import { BackHeader, Button, Chip, ErrorText, Field, Screen } from '@/components/ui';
import { BUCKETS, type Bucket } from '@/lib/groupBuckets';
import { space } from '@/theme';

export default function CreateGroup() {
  const { category } = useLocalSearchParams<{ category?: Bucket }>();
  const [bucket, setBucket] = useState<Bucket | null>(BUCKETS.some((b) => b.key === category) ? (category as Bucket) : null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function create() {
    if (!bucket) return;
    setBusy(true);
    setError(undefined);
    try {
      const { id } = await Q.createGroup('custom', name.trim());
      await Q.moveGroup(id, bucket);
      router.replace({ pathname: '/groups/[category]', params: { category: bucket } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button title="Create group" onPress={create} disabled={name.trim().length < 2 || !bucket} busy={busy} />}>
      <BackHeader title="Create New Group" />
      <Field label="Group name" value={name} onChangeText={setName} placeholder="e.g. Maternal side, Study group…" maxLength={60} autoFocus />
      <View style={{ marginBottom: space.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {BUCKETS.map((b) => (
            <Chip key={b.key} label={b.title} selected={bucket === b.key} onPress={() => setBucket(b.key)} />
          ))}
        </View>
      </View>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
