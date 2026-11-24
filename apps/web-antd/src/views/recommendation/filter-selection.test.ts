import { describe, expect, it } from 'vitest';

import {
  defaultRecommendationSelection,
  recommendationFilters,
} from './filter-selection';

describe('推荐筛选接口映射', () => {
  it('首页精选固定 column=1、sort=1，忽略隐藏的栏目和分类', () => {
    expect(
      recommendationFilters({
        ...defaultRecommendationSelection(),
        platform: '102',
        section: 'category',
        categoryId: 203,
      }),
    ).toEqual({ column: 1, sort: 1, type: 0, platform: '102' });
  });
  it.each([
    { section: 'recommend' as const, column: 2 },
    { section: 'ranking' as const, column: 42 },
    { section: 'latest' as const, column: 4 },
    { section: 'category' as const, column: 72 },
  ])(
    '$section 对应 column=$column，应用和游戏分别使用sort=1/2',
    ({ section, column }) => {
      for (const audience of ['apps', 'games'] as const) {
        expect(
          recommendationFilters({
            platform: '101',
            audience,
            section,
            categoryId: 111,
          }),
        ).toEqual({
          column,
          sort: audience === 'games' ? 2 : 1,
          type: section === 'category' ? 111 : 0,
          platform: '101',
        });
      }
    },
  );
});
