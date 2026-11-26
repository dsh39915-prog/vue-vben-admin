import type { RecommendationSelection } from './filter-selection';

import type { MobileCacheType } from '#/api';

export function recommendationCacheTarget(selection: RecommendationSelection): {
  label: string;
  type: MobileCacheType;
} {
  if (selection.audience === 'featured') return { label: '首页精选', type: 20 };
  const targets = {
    apps: {
      recommend: { label: '应用推荐', type: 21 },
      ranking: { label: '应用排行', type: 22 },
      latest: { label: '应用最新', type: 25 },
    },
    games: {
      recommend: { label: '游戏推荐', type: 27 },
      ranking: { label: '游戏排行', type: 28 },
      latest: { label: '游戏最新', type: 31 },
    },
  } as const;
  return targets[selection.audience][selection.section];
}
