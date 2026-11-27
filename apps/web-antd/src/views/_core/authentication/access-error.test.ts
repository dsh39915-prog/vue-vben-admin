import type { App } from 'vue';

import { createApp } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import AccessError from './access-error.vue';

const state = vi.hoisted(() => ({
  redirect: '',
  replace: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { redirect: state.redirect } }),
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock('#/store', () => ({ useAuthStore: () => ({ logout: state.logout }) }));
let app: App;
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
  vi.resetAllMocks();
});
function button(label: string) {
  const element = [...document.querySelectorAll('button')].find(
    (item) => item.textContent?.replaceAll(/\s/g, '') === label,
  );
  if (!element) throw new Error(`找不到按钮：${label}`);
  return element;
}
function mount() {
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp(AccessError);
  app.mount(root);
}
describe('初始化失败恢复', () => {
  it.each([
    [encodeURIComponent('/app-info?page=2#row'), '/app-info?page=2#row'],
    ['https://example.com', '/'],
    ['//example.com', '/'],
    ['%broken', '/'],
    [encodeURIComponent('/auth/access-error?redirect=again'), '/'],
  ])('重试保留业务地址并过滤无效回跳：%s', async (redirect, expected) => {
    state.redirect = redirect;
    mount();
    button('重新加载').click();
    await vi.waitFor(() =>
      expect(state.replace).toHaveBeenCalledExactlyOnceWith(expected),
    );
  });
  it('重新登录只清理本地会话，服务不可用时也能返回登录表单', () => {
    mount();
    button('重新登录').click();
    expect(state.logout).toHaveBeenCalledExactlyOnceWith(false, false);
  });
});
