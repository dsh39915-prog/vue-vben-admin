import type { App } from 'vue';

import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it } from 'vitest';

import { defaultRecommendationSelection } from './filter-selection';
import RecommendationFilters from './recommendation-filters.vue';

let app: App;
function mountFilters() {
  const selection = ref(defaultRecommendationSelection());
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp({
    render: () =>
      h(RecommendationFilters, {
        modelValue: selection.value,
        'onUpdate:modelValue': (value) => {
          selection.value = value;
        },
        disabled: false,
      }),
  });
  app.mount(container);
  return { selection };
}
async function choose(level: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(
    `[data-filter-level="${level}"] input[value="${value}"]`,
  );
  if (!input) throw new Error(`找不到选项：${level}/${value}`);
  input.click();
  await nextTick();
}
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('推荐筛选层级联动', () => {
  it('首页精选隐藏栏目，应用和游戏仅提供推荐、排行和最新', async () => {
    const { selection } = mountFilters();
    expect(
      [...document.querySelectorAll('button')].some((button) =>
        ['查询', '重置'].includes(button.textContent?.trim() ?? ''),
      ),
    ).toBe(false);
    expect(document.querySelector('[data-filter-level="section"]')).toBeNull();
    await choose('audience', 'apps');
    expect(
      [
        ...document.querySelectorAll<HTMLInputElement>(
          '[data-filter-level="section"] input',
        ),
      ].map((input) => input.value),
    ).toEqual(['recommend', 'ranking', 'latest']);
    expect(document.querySelector('[data-filter-level="category"]')).toBeNull();
    await choose('section', 'ranking');
    expect(selection.value.section).toBe('ranking');
    await choose('audience', 'games');
    expect(selection.value).toMatchObject({
      audience: 'games',
      section: 'recommend',
    });
    await choose('section', 'latest');
    expect(selection.value.section).toBe('latest');
    await choose('audience', 'featured');
    expect(document.querySelector('[data-filter-level="section"]')).toBeNull();
  });
  it('切换应用类型重置栏目，切换平台重置全部下级筛选', async () => {
    const { selection } = mountFilters();
    await choose('audience', 'apps');
    await choose('section', 'latest');
    await choose('audience', 'games');
    expect(selection.value.section).toBe('recommend');
    await choose('section', 'ranking');
    await choose('platform', '102');
    expect(selection.value).toEqual({
      ...defaultRecommendationSelection(),
      platform: '102',
    });
  });
});
