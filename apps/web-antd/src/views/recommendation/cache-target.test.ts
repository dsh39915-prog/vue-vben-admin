import { describe, expect, it } from 'vitest';

import { recommendationCacheTarget } from './cache-target';
import { defaultRecommendationSelection } from './filter-selection';

describe('推荐缓存类型', () => {
  it('首页精选忽略隐藏的栏目选项，使用type20', () => {
    expect(
      recommendationCacheTarget({
        ...defaultRecommendationSelection(),
        section: 'latest',
      }),
    ).toEqual({ label: '首页精选', type: 20 });
  });
  it.each([
    { audience: 'apps', section: 'recommend', type: 21, label: '应用推荐' },
    { audience: 'apps', section: 'ranking', type: 22, label: '应用排行' },
    { audience: 'apps', section: 'latest', type: 25, label: '应用最新' },
    { audience: 'games', section: 'recommend', type: 27, label: '游戏推荐' },
    { audience: 'games', section: 'ranking', type: 28, label: '游戏排行' },
    { audience: 'games', section: 'latest', type: 31, label: '游戏最新' },
  ] as const)(
    '$label 传入type=$type，平台不参与缓存类型计算',
    ({ audience, section, type, label }) => {
      for (const platform of ['101', '102'] as const) {
        expect(
          recommendationCacheTarget({
            ...defaultRecommendationSelection(),
            audience,
            section,
            platform,
          }),
        ).toEqual({ label, type });
      }
    },
  );
});
