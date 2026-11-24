import { useAccessStore } from '@vben/stores';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authRequestClient, requestClient } from './request';

const logout = vi.hoisted(() => vi.fn());
vi.mock('#/store', () => ({ useAuthStore: () => ({ logout }) }));
vi.mock('@vben/hooks', () => ({ useAppConfig: () => ({ apiURL: '/api' }) }));
beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
});
describe('真实服务响应和会话失效', () => {
  it('创建接口 HTTP 201、业务码 200 正常解包，并发送 Bearer 令牌', async () => {
    useAccessStore().setAccessToken('test-token');
    const adapter = vi.fn(async (config) => ({
      data: { code: 200, data: { id: 5 } },
      status: 201,
      statusText: 'Created',
      headers: {},
      config,
    }));
    requestClient.instance.defaults.adapter = adapter;
    expect(await requestClient.post('/system/users', {})).toEqual({ id: 5 });
    expect(adapter.mock.calls[0]?.[0].headers.Authorization).toBe(
      'Bearer test-token',
    );
  });
  it('登录错误 401 不触发退出请求，避免重复重定向和循环请求', async () => {
    authRequestClient.instance.defaults.adapter = async (config) => {
      throw Object.assign(new Error('Unauthorized'), {
        config,
        response: {
          status: 401,
          data: { code: 401, message: '账号或密码错误' },
        },
      });
    };
    await expect(
      authRequestClient.post('/system/auth/login', {}),
    ).rejects.toBeDefined();
    expect(logout).not.toHaveBeenCalled();
  });
  it('受保护接口返回 401 时清理令牌并重新登录，不调用不存在的刷新接口', async () => {
    useAccessStore().setAccessToken('expired-token');
    requestClient.instance.defaults.adapter = async (config) => {
      throw Object.assign(new Error('Unauthorized'), {
        config,
        response: { status: 401, data: { code: 401, message: '会话已失效' } },
      });
    };
    await expect(requestClient.get('/system/auth/me')).rejects.toBeDefined();
    expect(useAccessStore().accessToken).toBeNull();
    expect(logout).toHaveBeenCalledOnce();
    expect(logout).toHaveBeenCalledWith(true, false);
  });
});
