import type { App } from 'vue';

import { createApp } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { navigationFailure } from '#/router/navigation-error';

import NavigationError from './navigation-error.vue';

const actions = vi.hoisted(() => ({ resolve: vi.fn(), logout: vi.fn() }));
vi.mock('vue-router', () => ({
  useRouter: () => ({ resolve: actions.resolve }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ logout: actions.logout }),
}));
let app: App;
beforeEach(() => {
  vi.resetAllMocks();
  navigationFailure.value = { fullPath: '/client-switch?page=2#row' };
  actions.resolve.mockReturnValue({ href: '/#/client-switch?page=2#row' });
});
afterEach(() => {
  app?.unmount();
  navigationFailure.value = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function mount() {
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp(NavigationError);
  app.mount(root);
}
function button(label: string) {
  const found = [...document.querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === label,
  );
  if (!found) throw new Error(`找不到按钮：${label}`);
  return found;
}
describe('页面脚本加载失败恢复', () => {
  it('完整重载失败目标，并保留查询参数和定位', () => {
    const replace = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation(() => {});
    const reload = vi
      .spyOn(window.location, 'reload')
      .mockImplementation(() => {});
    mount();
    const state = window.history.state;
    button('重新加载').click();
    expect(actions.resolve).toHaveBeenCalledExactlyOnceWith(
      '/client-switch?page=2#row',
    );
    expect(replace).toHaveBeenCalledExactlyOnceWith(
      state,
      '',
      '/#/client-switch?page=2#row',
    );
    expect(reload).toHaveBeenCalledOnce();
  });
  it('返回登录清理本地会话，不等待不可用的退出接口', () => {
    mount();
    button('返回登录').click();
    expect(actions.logout).toHaveBeenCalledExactlyOnceWith(false, false);
  });
});
