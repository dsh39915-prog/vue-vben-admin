import type { App } from 'vue';

import type { MobileCacheType } from '#/api';

import { createApp, h, nextTick, reactive } from 'vue';

import { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CacheReloadButton from './cache-reload-button.vue';

const api = vi.hoisted(() => ({ reloadMobileCacheApi: vi.fn() }));
vi.mock('#/api', () => api);
vi.mock('ant-design-vue', async () => {
  const original =
    await vi.importActual<typeof import('ant-design-vue')>('ant-design-vue');
  return { ...original, message: { success: vi.fn() } };
});
let app: App;
let state: { cacheType: MobileCacheType; disabled: boolean; label: string };
function button() {
  const element = document.querySelector('button');
  if (!element) throw new Error('未显示刷新缓存按钮');
  return element;
}
function mountButton(disabled = false) {
  state = reactive({
    cacheType: 20 as MobileCacheType,
    label: '首页精选',
    disabled,
  });
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp({ render: () => h(CacheReloadButton, state) });
  app.mount(container);
}
beforeEach(() => {
  vi.resetAllMocks();
  api.reloadMobileCacheApi.mockResolvedValue(null);
});
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('刷新缓存按钮', () => {
  it('请求期间防止重复点击，筛选变化不改变正在刷新缓存的类型及结果提示', async () => {
    let finish: (() => void) | undefined;
    api.reloadMobileCacheApi.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    mountButton();
    button().click();
    button().click();
    await nextTick();
    expect(api.reloadMobileCacheApi).toHaveBeenCalledExactlyOnceWith(20);
    expect(button().disabled).toBe(true);
    state.cacheType = 27;
    state.label = '游戏推荐';
    finish?.();
    await vi.waitFor(() => expect(button().disabled).toBe(false));
    expect(message.success).toHaveBeenCalledWith('首页精选缓存刷新已提交');
    button().click();
    await vi.waitFor(() =>
      expect(api.reloadMobileCacheApi).toHaveBeenLastCalledWith(27),
    );
    await vi.waitFor(() =>
      expect(message.success).toHaveBeenLastCalledWith(
        '游戏推荐缓存刷新已提交',
      ),
    );
  });
  it('失败不提示成功，解除请求状态后允许重试', async () => {
    api.reloadMobileCacheApi.mockRejectedValueOnce(new Error('刷新失败'));
    mountButton();
    button().click();
    await nextTick();
    await vi.waitFor(() => expect(button().disabled).toBe(false));
    expect(message.success).not.toHaveBeenCalled();
    button().click();
    await vi.waitFor(() =>
      expect(api.reloadMobileCacheApi).toHaveBeenCalledTimes(2),
    );
    await vi.waitFor(() =>
      expect(message.success).toHaveBeenCalledWith('首页精选缓存刷新已提交'),
    );
  });
  it('页面保存或编辑期间禁用刷新缓存', () => {
    mountButton(true);
    button().click();
    expect(button().disabled).toBe(true);
    expect(api.reloadMobileCacheApi).not.toHaveBeenCalled();
  });
});
