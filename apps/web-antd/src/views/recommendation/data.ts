export const platformOptions = [
  { label: 'iPhone', value: '101' },
  { label: 'iPad', value: '102' },
];

export type RecommendationAudience = 'apps' | 'featured' | 'games';
export type RecommendationSection = 'latest' | 'ranking' | 'recommend';

export const audienceOptions: {
  label: string;
  value: RecommendationAudience;
}[] = [
  { label: '首页精选', value: 'featured' },
  { label: '应用推荐', value: 'apps' },
  { label: '游戏推荐', value: 'games' },
];
export const sectionOptions: { label: string; value: RecommendationSection }[] =
  [
    { label: '推荐', value: 'recommend' },
    { label: '排行', value: 'ranking' },
    { label: '最新', value: 'latest' },
  ];
