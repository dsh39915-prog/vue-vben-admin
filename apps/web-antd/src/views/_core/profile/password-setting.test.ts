import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, expect, it, vi } from 'vitest';

import PasswordSetting from './password-setting.vue';
const changePassword = vi.hoisted(() => vi.fn());
const logout = vi.hoisted(() => vi.fn());
vi.mock('#/api', () => ({ changeCurrentPasswordApi: changePassword }));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ passwordResetRequired: true, logout }),
}));
let app: App;
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
  vi.resetAllMocks();
});
it('必须改密表单验证确认密码后按原文提交，成功后清理已撤销的会话', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp(PasswordSetting);
  app.mount(container);
  async function input(name: string, value: string) {
    const field = document.querySelector<HTMLInputElement>(
      `#change-password_${name}`,
    );
    if (!field) throw new Error(`找不到字段：${name}`);
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
  }
  const submit = document.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  await input('oldPassword', ' old password ');
  await input('newPassword', ' new password 123 ');
  await input('confirmPassword', 'mismatch');
  submit?.click();
  await vi.waitFor(() =>
    expect(document.body.textContent).toContain('两次输入的密码不一致'),
  );
  expect(changePassword).not.toHaveBeenCalled();
  await input('confirmPassword', ' new password 123 ');
  submit?.click();
  await vi.waitFor(() =>
    expect(changePassword).toHaveBeenCalledWith({
      oldPassword: ' old password ',
      newPassword: ' new password 123 ',
    }),
  );
  expect(logout).toHaveBeenCalledWith(false, false);
});
