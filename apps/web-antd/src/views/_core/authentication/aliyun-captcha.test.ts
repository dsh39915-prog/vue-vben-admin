import type { App } from 'vue';

import type { CaptchaOptions } from './aliyun-captcha-sdk';

import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AliyunCaptcha from './aliyun-captcha.vue';

const sdk = vi.hoisted(() => ({
  load: vi.fn(),
  initialize: vi.fn(),
  refresh: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('./aliyun-captcha-sdk', () => ({ loadAliyunCaptcha: sdk.load }));
let app: App | undefined;
let options: CaptchaOptions;
const config = { enabled: true, sceneId: 'test-scene', prefix: 'test-prefix' };
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  sdk.load.mockResolvedValue(sdk.initialize);
  sdk.initialize.mockImplementation((value: CaptchaOptions) => {
    options = value;
    value.getInstance({ refresh: sdk.refresh, destroyCaptcha: sdk.destroy });
  });
});
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
  vi.useRealTimers();
});
async function mount(verify = vi.fn().mockResolvedValue(true)) {
  const component = ref<InstanceType<typeof AliyunCaptcha>>();
  const ready = vi.fn();
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp({
    render: () =>
      h(AliyunCaptcha, { config, verify, ref: component, onReady: ready }),
  });
  app.mount(container);
  await vi.advanceTimersByTimeAsync(2100);
  await nextTick();
  return { component, ready, verify };
}

describe('嵌入式验证码', () => {
  it('渲染内嵌容器，初始化后通过内部触发器接入登录，不展示额外验证按钮', async () => {
    const { component, ready } = await mount();
    expect(options.mode).toBe('embed');
    expect(options.SceneId).toBe('test-scene');
    expect(document.querySelector(options.element)).not.toBeNull();
    expect(
      document.querySelector(options.button)?.classList.contains('hidden'),
    ).toBe(true);
    expect(ready).toHaveBeenLastCalledWith(true);
    const trigger = vi.fn();
    document.querySelector(options.button)?.addEventListener('click', trigger);
    component.value?.start();
    expect(trigger).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain('点击完成滑块验证');
  });
  it('业务接口拒绝时向SDK返回失败，只有真实业务接受才返回成功', async () => {
    const verify = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await mount(verify);
    expect(await options.captchaVerifyCallback('test-proof-1')).toEqual({
      captchaResult: false,
      bizResult: false,
    });
    expect(await options.captchaVerifyCallback('test-proof-2')).toEqual({
      captchaResult: true,
      bizResult: true,
    });
    expect(verify.mock.calls).toEqual([['test-proof-1'], ['test-proof-2']]);
  });
  it('重复回调不会并发提交，使用官方实例方法刷新和销毁', async () => {
    let finish: ((value: boolean) => void) | undefined;
    const verify = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const { component } = await mount(verify);
    const first = options.captchaVerifyCallback('test-proof');
    await options.captchaVerifyCallback('test-proof');
    expect(verify).toHaveBeenCalledOnce();
    finish?.(true);
    await first;
    component.value?.reset();
    expect(sdk.refresh).toHaveBeenCalledOnce();
    app?.unmount();
    app = undefined;
    expect(sdk.destroy).toHaveBeenCalledOnce();
  });
  it('销毁时SDK回传空实例不会中断组件卸载', async () => {
    await mount();
    sdk.destroy.mockImplementation(() => {
      options.getInstance();
      options.getInstance(null);
    });
    const mountedApp = app;
    app = undefined;
    expect(() => mountedApp?.unmount()).not.toThrow();
    expect(sdk.destroy).toHaveBeenCalledOnce();
  });
  it('卸载后迟到的实例及重复回调只销毁一次', async () => {
    sdk.initialize.mockImplementation((value: CaptchaOptions) => {
      options = value;
    });
    await mount();
    app?.unmount();
    app = undefined;
    const lateInstance = {
      refresh: sdk.refresh,
      destroyCaptcha: sdk.destroy,
    };
    sdk.destroy.mockImplementation(() => {
      options.getInstance(lateInstance);
      options.getInstance();
    });
    expect(() => options.getInstance(lateInstance)).not.toThrow();
    options.getInstance(lateInstance);
    expect(sdk.destroy).toHaveBeenCalledOnce();
  });
  it('重试销毁旧实例后，旧回调的空值不会清除新实例', async () => {
    const { component, ready } = await mount();
    const previousOptions = options;
    const replacementRefresh = vi.fn();
    sdk.destroy.mockImplementation(() => previousOptions.getInstance());
    sdk.initialize.mockImplementationOnce((value: CaptchaOptions) => {
      options = value;
      value.getInstance({
        refresh: replacementRefresh,
        destroyCaptcha: vi.fn(),
      });
    });
    previousOptions.onError();
    await nextTick();
    const retry = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.replaceAll(/\s/g, '').includes('重试'),
    );
    expect(retry).toBeDefined();
    retry?.click();
    await vi.advanceTimersByTimeAsync(2100);
    expect(ready).toHaveBeenLastCalledWith(true);
    previousOptions.getInstance(null);
    component.value?.reset();
    expect(replacementRefresh).toHaveBeenCalledOnce();
    expect(sdk.destroy).toHaveBeenCalledOnce();
  });
});
