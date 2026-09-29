import { PUBLIC_LEVELS } from '@/api/qumanity';
import { LevelPage } from '@/components/LevelPage';
import { timelineColors } from '@/theme';

export default function PublicTimeline() {
  return <LevelPage title="Public" note="Where you live now: Village → Zone" accent={timelineColors.public} levels={PUBLIC_LEVELS} />;
}
