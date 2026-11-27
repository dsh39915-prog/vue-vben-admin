import type { CaptchaWindow } from './aliyun-captcha-sdk';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadAliyunCaptcha } from './aliyun-captcha-sdk';

const sdkWindow = window as CaptchaWindow;
const config = { enabled: true, sceneId: 'test-scene', prefix: 'test-prefix' };
let script: HTMLScriptElement | undefined;
beforeEach(() => {
  delete sdkWindow.initAliyunCaptcha;
  delete sdkWindow.AliyunCaptchaConfig;
  script = undefined;
  vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
    const node = nodes[0];
    if (!(node instanceof HTMLScriptElement))
      throw new Error('预期动态加载脚本');
    script = node;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  delete sdkWindow.initAliyunCaptcha;
  delete sdkWindow.AliyunCaptchaConfig;
});

describe('阿里云 SDK 加载', () => {
  it('在加载官方脚本前设置身份标和区域，并合并并发加载', async () => {
    const first = loadAliyunCaptcha(config);
    const second = loadAliyunCaptcha(config);
    expect(sdkWindow.AliyunCaptchaConfig).toEqual({
      prefix: 'test-prefix',
      region: 'cn',
    });
    expect(document.head.append).toHaveBeenCalledOnce();
    expect(script?.src).toBe(
      'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js',
    );
    const initialize = vi.fn();
    sdkWindow.initAliyunCaptcha = initialize;
    script?.dispatchEvent(new Event('load'));
    expect(await first).toBe(initialize);
    expect(await second).toBe(initialize);
  });
  it('脚本加载失败后允许重新加载，而不是永远复用失败任务', async () => {
    const first = loadAliyunCaptcha(config);
    script?.dispatchEvent(new Event('error'));
    await expect(first).rejects.toThrow('验证码脚本加载失败');
    const second = loadAliyunCaptcha(config);
    sdkWindow.initAliyunCaptcha = vi.fn();
    script?.dispatchEvent(new Event('load'));
    await second;
    expect(document.head.append).toHaveBeenCalledTimes(2);
  });
});
