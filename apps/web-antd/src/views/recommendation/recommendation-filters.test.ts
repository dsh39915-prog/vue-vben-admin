import type { App } from 'vue';

import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { defaultRecommendationSelection } from './filter-selection';
import RecommendationFilters from './recommendation-filters.vue';

let app: App;
function mountFilters() {
  const selection = ref(defaultRecommendationSelection());
  const retryCategories = vi.fn();
  const categoryFailed = ref(false);
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp({
    render: () =>
      h(RecommendationFilters, {
        modelValue: selection.value,
        'onUpdate:modelValue': (value) => {
          selection.value = value;
        },
        categories: [
          { id: 111, name: '图书', sort: 1 },
          { id: 107, name: '工具', sort: 1 },
        ],
        categoryFailed: categoryFailed.value,
        categoryLoading: false,
        disabled: false,
        onRetryCategories: retryCategories,
      }),
  });
  app.mount(container);
  return { selection, retryCategories, categoryFailed };
}
async function choose(level: string, value: number | string) {
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
  it('首页精选隐藏栏目，应用和游戏显示栏目，仅分类显示第四级接口分类', async () => {
    const { selection } = mountFilters();
    expect(
      [...document.querySelectorAll('button')].some((button) =>
        ['查询', '重置'].includes(button.textContent?.trim() ?? ''),
      ),
    ).toBe(false);
    expect(document.querySelector('[data-filter-level="section"]')).toBeNull();
    expect(document.querySelector('[data-filter-level="category"]')).toBeNull();
    await choose('audience', 'apps');
    expect(
      document.querySelector('[data-filter-level="section"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-filter-level="category"]')).toBeNull();
    await choose('section', 'category');
    expect(
      document.querySelector('[data-filter-level="category"] input[value="0"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-filter-level="category"]')?.textContent,
    ).not.toContain('全部');
    expect(
      document.querySelector('[data-filter-level="category"]')?.textContent,
    ).toContain('图书');
    await choose('category', 111);
    expect(selection.value.categoryId).toBe(111);
    await choose('audience', 'games');
    expect(selection.value).toMatchObject({
      audience: 'games',
      section: 'recommend',
      categoryId: 0,
    });
    expect(document.querySelector('[data-filter-level="category"]')).toBeNull();
    await choose('section', 'category');
    await choose('category', 107);
    await choose('audience', 'featured');
    expect(selection.value.categoryId).toBe(0);
    expect(document.querySelector('[data-filter-level="section"]')).toBeNull();
  });
  it('切换运行平台清空所有下级筛选，切换栏目清空分类', async () => {
    const { selection } = mountFilters();
    await choose('audience', 'apps');
    await choose('section', 'category');
    await choose('category', 111);
    await choose('section', 'ranking');
    expect(selection.value.categoryId).toBe(0);
    await choose('section', 'category');
    await choose('category', 107);
    await choose('platform', '102');
    expect(selection.value).toEqual({
      ...defaultRecommendationSelection(),
      platform: '102',
    });
    expect(document.querySelector('[data-filter-level="category"]')).toBeNull();
  });
  it('分类加载错误仅在第四级展示，允许重试', async () => {
    const { categoryFailed, retryCategories } = mountFilters();
    categoryFailed.value = true;
    await nextTick();
    expect(document.body.textContent).not.toContain('应用分类加载失败');
    await choose('audience', 'apps');
    await choose('section', 'category');
    expect(document.body.textContent).toContain('应用分类加载失败');
    const retry = [...document.querySelectorAll('button')].find(
      (button) => button.textContent?.replaceAll(/\s/g, '') === '重试分类',
    );
    retry?.click();
    expect(retryCategories).toHaveBeenCalledOnce();
  });
});
