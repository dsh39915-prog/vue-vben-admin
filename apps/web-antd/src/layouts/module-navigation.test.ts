import type { App } from 'vue';

import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import ModuleNavigation from './module-navigation.vue';

let app: App;
function mountNavigation(
  props: () => InstanceType<typeof ModuleNavigation>['$props'],
) {
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp({ render: () => h(ModuleNavigation, props()) });
  app.mount(container);
}
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('顶部模块菜单', () => {
  it('展示接口模块名称，点击仅发出接口模块ID并更新选中状态', async () => {
    const selected = ref(3);
    const choose = vi.fn((id: null | number) => {
      if (id !== null) selected.value = id;
    });
    mountNavigation(() => ({
      groups: [
        { id: 3, name: '后台返回的业务模块', order: 1, menus: [] },
        { id: 7, name: '后台返回的系统模块', order: 2, menus: [] },
      ],
      selected: selected.value,
      loading: false,
      failed: false,
      onSelect: choose,
    }));
    const buttons = [...document.querySelectorAll('nav button')];
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      '后台返回的业务模块',
      '后台返回的系统模块',
    ]);
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
    (buttons[1] as HTMLButtonElement).click();
    await nextTick();
    expect(choose).toHaveBeenCalledWith(7);
    expect(buttons[1]?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('a')).toBeNull();
  });
  it('模块信息失败时提供重试入口', () => {
    const retry = vi.fn();
    mountNavigation(() => ({
      groups: [],
      selected: undefined,
      loading: false,
      failed: true,
      onRetry: retry,
    }));
    const button = document.querySelector<HTMLButtonElement>('button');
    expect(button?.textContent?.replaceAll(/\s/g, '')).toBe('重试模块');
    button?.click();
    expect(retry).toHaveBeenCalledOnce();
  });
});
