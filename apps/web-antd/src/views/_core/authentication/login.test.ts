import type { App } from 'vue';
import type { Router } from 'vue-router';

import type { CaptchaOptions, CaptchaVerifyResult } from './aliyun-captcha-sdk';

import { createApp, nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AuthLayout from '#/layouts/auth.vue';

import ChangePassword from './change-password.vue';
import Login from './login.vue';
const api = vi.hoisted(() => ({
  changeCurrentPasswordApi: vi.fn(),
  getCaptchaConfigApi: vi.fn(),
  resendLoginSmsApi: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  authLogin: vi.fn(),
  authVerifySms: vi.fn(),
  loginLoading: false,
  logout: vi.fn(),
  passwordResetRequired: true,
}));
const sdk = vi.hoisted(() => ({
  load: vi.fn(),
  initialize: vi.fn(),
  result: vi.fn(),
  refresh: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('./aliyun-captcha-sdk', () => ({ loadAliyunCaptcha: sdk.load }));
vi.mock('#/api', () => api);
vi.mock('#/store', () => ({ useAuthStore: () => auth }));
let app: App;
async function input(id: string, value: string) {
  const element = document.querySelector(`#${id}`);
  if (!(element instanceof HTMLInputElement))
    throw new Error(`找不到输入框：${id}`);
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}
function button(label: string) {
  const result = [...document.querySelectorAll('button')].find(
    (element) => element.textContent?.replaceAll(/\s/g, '') === label,
  );
  if (!result) throw new Error(`找不到按钮：${label}`);
  return result;
}
async function mount(router?: Router) {
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp(router ? AuthLayout : Login);
  if (router) app.use(router);
  app.mount(container);
  await nextTick();
  await vi.waitFor(
    () => {
      expect(button('登录').disabled).toBe(false);
      expect(button('登录').classList.contains('ant-btn-loading')).toBe(false);
    },
    {
      timeout: 5000,
    },
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  api.getCaptchaConfigApi.mockResolvedValue({
    enabled: false,
    prefix: '',
    sceneId: '',
  });
  auth.authLogin.mockResolvedValue({ status: 'AUTHENTICATED' });
  sdk.load.mockResolvedValue(sdk.initialize);
  let attempt = 0;
  sdk.initialize.mockImplementation((options: CaptchaOptions) => {
    options.getInstance({ refresh: sdk.refresh, destroyCaptcha: sdk.destroy });
    document.querySelector(options.button)?.addEventListener('click', () => {
      attempt += 1;
      void options
        .captchaVerifyCallback(`test-proof-${attempt}`)
        .then((result: CaptchaVerifyResult) => sdk.result(result));
    });
  });
});
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});
describe('真实登录表单', { timeout: 15_000 }, () => {
  it('滑块开启时经SDK回调携带验证参数登录，验证失败可使用新凭证重试', async () => {
    api.getCaptchaConfigApi.mockResolvedValue({
      enabled: true,
      prefix: 'test-prefix',
      sceneId: 'test-scene',
    });
    auth.authLogin.mockRejectedValueOnce(new Error('滑块验证失败'));
    await mount();
    expect(document.body.textContent).toContain('安全验证');
    await input('system-login_username', 'tester');
    await input('system-login_password', ' untouched password ');
    button('登录').click();
    await vi.waitFor(() =>
      expect(sdk.result).toHaveBeenCalledWith({
        captchaResult: false,
        bizResult: false,
      }),
    );
    expect(auth.authLogin).toHaveBeenCalledWith({
      username: 'tester',
      password: ' untouched password ',
      captchaVerifyParam: 'test-proof-1',
    });
    button('登录').click();
    await vi.waitFor(() =>
      expect(sdk.result).toHaveBeenLastCalledWith({
        captchaResult: true,
        bizResult: true,
      }),
    );
    expect(auth.authLogin).toHaveBeenLastCalledWith({
      username: 'tester',
      password: ' untouched password ',
      captchaVerifyParam: 'test-proof-2',
    });
  });
  it('无痕模式隐藏安全验证区域，登录仍经SDK携带验证参数提交', async () => {
    api.getCaptchaConfigApi.mockResolvedValue({
      enabled: true,
      prefix: 'test-prefix',
      sceneId: 'test-scene',
    });
    const initialize = sdk.initialize.getMockImplementation();
    sdk.initialize.mockImplementationOnce((options: CaptchaOptions) => {
      initialize?.(options);
      return { CaptchaType: 'TRACELESS' };
    });
    await mount();
    expect(document.body.textContent).not.toContain('安全验证');
    expect(document.body.textContent).not.toContain('点击登录时');
    const captcha = document.querySelector('[id^="aliyun-captcha-"]');
    expect(captcha).not.toBeNull();
    expect(
      captcha?.closest('.ant-form-item')?.classList.contains('captcha-silent'),
    ).toBe(true);
    expect(auth.authLogin).not.toHaveBeenCalled();
    await input('system-login_username', 'tester');
    await input('system-login_password', 'test-password');
    button('登录').click();
    await vi.waitFor(() =>
      expect(auth.authLogin).toHaveBeenCalledWith({
        username: 'tester',
        password: 'test-password',
        captchaVerifyParam: 'test-proof-1',
      }),
    );
  });
  it('滑块开启时先校验账号密码，表单不完整不会触发SDK或后端登录', async () => {
    api.getCaptchaConfigApi.mockResolvedValue({
      enabled: true,
      prefix: 'test-prefix',
      sceneId: 'test-scene',
    });
    await mount();
    button('登录').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('请输入密码'),
    );
    expect(auth.authLogin).not.toHaveBeenCalled();
    expect(sdk.result).not.toHaveBeenCalled();
  });
  it('滑块关闭时直接提交登录名及原始密码，不显示演示账号或假验证码', async () => {
    await mount();
    await input('system-login_username', 'tester');
    await input('system-login_password', ' untouched password ');
    button('登录').click();
    await vi.waitFor(() =>
      expect(auth.authLogin).toHaveBeenCalledWith({
        username: 'tester',
        password: ' untouched password ',
      }),
    );
    expect(document.body.textContent).not.toContain('安全验证');
    expect(document.body.textContent).not.toContain('选择账号');
  });
  it('收到 MFA 挑战后展示短信步骤，只有六位验证码才能提交', async () => {
    auth.authLogin.mockResolvedValue({
      status: 'MFA_REQUIRED',
      challengeId: 'challenge',
      maskedMobile: '138****0000',
    });
    await mount();
    await input('system-login_username', 'tester');
    await input('system-login_password', 'password');
    button('登录').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('138****0000'),
    );
    await input('system-sms_code', '123');
    button('验证并登录').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('请输入六位短信验证码'),
    );
    expect(auth.authVerifySms).not.toHaveBeenCalled();
    await input('system-sms_code', '123456');
    button('验证并登录').click();
    await vi.waitFor(() =>
      expect(auth.authVerifySms).toHaveBeenCalledWith('challenge', '123456'),
    );
  });
  it('短信登录后修改密码，返回账号密码表单且不保留旧短信挑战或密码', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/auth/login', component: Login },
        { path: '/auth/change-password', component: ChangePassword },
      ],
    });
    localStorage.setItem('i4-admin-remembered-username', 'tester');
    auth.authLogin.mockResolvedValueOnce({
      status: 'MFA_REQUIRED',
      challengeId: 'old-challenge',
      maskedMobile: '138****0000',
    });
    auth.authVerifySms.mockImplementationOnce(() =>
      router.push('/auth/change-password'),
    );
    api.changeCurrentPasswordApi.mockResolvedValue(null);
    auth.logout.mockImplementationOnce(() => router.replace('/auth/login'));
    await router.push('/auth/login');
    await mount(router);
    await input('system-login_password', 'old-password');
    button('登录').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('138****0000'),
    );
    await input('system-sms_code', '123456');
    button('验证并登录').click();
    await vi.waitFor(() =>
      expect(router.currentRoute.value.path).toBe('/auth/change-password'),
    );
    await input('change-password_oldPassword', 'old-password');
    await input('change-password_newPassword', 'new-password-123');
    await input('change-password_confirmPassword', 'new-password-123');
    button('修改密码').click();
    await vi.waitFor(() =>
      expect(router.currentRoute.value.path).toBe('/auth/login'),
    );
    expect(api.changeCurrentPasswordApi).toHaveBeenCalledWith({
      oldPassword: 'old-password',
      newPassword: 'new-password-123',
    });
    expect(auth.logout).toHaveBeenCalledWith(false, false);
    expect(document.querySelector('#system-sms_code')).toBeNull();
    expect(
      document.querySelector<HTMLInputElement>('#system-login_username')?.value,
    ).toBe('tester');
    expect(
      document.querySelector<HTMLInputElement>('#system-login_password')?.value,
    ).toBe('');
    await input('system-login_password', 'new-password-123');
    button('登录').click();
    await vi.waitFor(() =>
      expect(auth.authLogin).toHaveBeenLastCalledWith({
        username: 'tester',
        password: 'new-password-123',
      }),
    );
    expect(auth.authVerifySms).toHaveBeenCalledTimes(1);
  });
});
