import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Login from './login.vue';
const api = vi.hoisted(() => ({
  getCaptchaConfigApi: vi.fn(),
  resendLoginSmsApi: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  authLogin: vi.fn(),
  authVerifySms: vi.fn(),
  loginLoading: false,
}));
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
async function mount() {
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp(Login);
  app.mount(container);
  await vi.waitFor(() => expect(button('登录').disabled).toBe(false));
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
});
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});
describe('真实登录表单', { timeout: 15_000 }, () => {
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
    expect(document.body.textContent).not.toContain('滑块验证');
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
});
