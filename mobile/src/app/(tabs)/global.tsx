import { GLOBAL_LEVELS } from '@/api/qumanity';
import { LevelPage } from '@/components/LevelPage';
import { timelineColors } from '@/theme';

export default function GlobalTimeline() {
  return <LevelPage title="Global" note="Country · Continent · Earth" accent={timelineColors.global} levels={GLOBAL_LEVELS} />;
}
