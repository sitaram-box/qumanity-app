/**
 * The Personal timeline's group buckets (2026-09-28 restructure): Family / Friends / Business are
 * pre-defined-or-auto-created only — never directly creatable from the app. The single "+" on the
 * Personal tab creates a group as `custom`, then immediately moves it into whichever of these the
 * user picks (Q.moveGroup). Private Groups (1:1 chats) are a separate concept entirely — see
 * api/qumanity.ts's PrivateChat and app/private-groups.tsx — not a personal_groups category at all.
 */

import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import * as Q from '@/api/qumanity';
import { colors, timelineColors } from '@/theme';

export type Bucket = 'family' | 'friends' | 'business';

export const BUCKETS: { key: Bucket; title: string; icon: ComponentProps<typeof Ionicons>['name']; color: string }[] = [
  { key: 'family', title: 'Family', icon: 'home', color: colors.saffron },
  { key: 'friends', title: 'Friends', icon: 'happy', color: timelineColors.personal },
  { key: 'business', title: 'Business', icon: 'briefcase', color: timelineColors.private },
];

export function groupsInBucket(groups: Q.PersonalGroups, bucket: Bucket): { owned: Q.PersonalGroup[]; joined: Q.PersonalGroup[] } {
  return { owned: groups[bucket].owned, joined: groups[bucket].joined };
}

export function countFor(groups: Q.PersonalGroups, bucket: Bucket): number {
  const { owned, joined } = groupsInBucket(groups, bucket);
  return owned.length + joined.length;
}

export const BUCKET_TITLE: Record<Bucket, string> = { family: 'Family', friends: 'Friends', business: 'Business' };
