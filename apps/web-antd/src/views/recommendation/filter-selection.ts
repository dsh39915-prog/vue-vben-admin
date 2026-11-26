import type { RecommendationAudience, RecommendationSection } from './data';

import type { RecommendationContext, RecommendationPlatform } from '#/api';

export interface RecommendationSelection {
  audience: RecommendationAudience;
  platform: RecommendationPlatform;
  section: RecommendationSection;
}

export function defaultRecommendationSelection(): RecommendationSelection {
  return {
    platform: '101',
    audience: 'featured',
    section: 'recommend',
  };
}

/** 采用业务确认的栏目参数，隐藏的下级选项不参与查询。 */
export function recommendationFilters(
  selection: RecommendationSelection,
): Omit<RecommendationContext, 'iosVersion'> {
  if (selection.audience === 'featured') {
    return { platform: selection.platform, column: 1, sort: 1, type: 0 };
  }
  const columns: Record<RecommendationSection, number> = {
    recommend: 2,
    ranking: 42,
    latest: 4,
  };
  return {
    platform: selection.platform,
    column: columns[selection.section],
    sort: selection.audience === 'games' ? 2 : 1,
    type: 0,
  };
}

/** 切换上级时重置全部下级，防止隐藏的筛选值继续参与请求。 */
export function changeRecommendationSelection(
  current: RecommendationSelection,
  change:
    | { audience: RecommendationAudience }
    | { platform: RecommendationPlatform }
    | { section: RecommendationSection },
): RecommendationSelection {
  if ('platform' in change)
    return { ...defaultRecommendationSelection(), platform: change.platform };
  if ('audience' in change)
    return {
      ...current,
      audience: change.audience,
      section: 'recommend',
    };
  return { ...current, section: change.section };
}
