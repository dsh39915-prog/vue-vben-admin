import { useAccessStore } from '@vben/stores';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authRequestClient,
  baseRequestClient,
  configInfoRequestClient,
  requestClient,
} from './request';

const logout = vi.hoisted(() => vi.fn());
vi.mock('#/store', () => ({ useAuthStore: () => ({ logout }) }));
vi.mock('@vben/hooks', () => ({
  useAppConfig: () => ({ apiURL: 'https://qq.i4.cn/' }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
});
describe('真实服务响应和会话失效', () => {
  it('系统与业务请求并发返回401，只退出一次', async () => {
    useAccessStore().setAccessToken('expired-session');
    const adapter: NonNullable<
      typeof requestClient.instance.defaults.adapter
    > = async (config) => {
      throw Object.assign(new Error('Unauthorized'), {
        config,
        response: { status: 401, data: { code: 401 } },
      });
    };
    requestClient.instance.defaults.adapter = adapter;
    configInfoRequestClient.instance.defaults.adapter = adapter;
    await Promise.allSettled([
      requestClient.get('/system/auth/me'),
      configInfoRequestClient.get('/appInfo/list'),
    ]);
    expect(logout).toHaveBeenCalledOnce();
    expect(useAccessStore().accessToken).toBeNull();
  });
  it('旧请求迟到的401不能清除新登录令牌', async () => {
    useAccessStore().setAccessToken('old-session');
    let rejectRequest: (() => void) | undefined;
    requestClient.instance.defaults.adapter = (config) =>
      new Promise((_resolve, reject) => {
        rejectRequest = () =>
          reject(
            Object.assign(new Error('Unauthorized'), {
              config,
              response: { status: 401, data: { code: 401 } },
            }),
          );
      });
    const pending = requestClient.get('/system/auth/me');
    await vi.waitFor(() => expect(rejectRequest).toBeTypeOf('function'));
    useAccessStore().setAccessToken('new-session');
    rejectRequest?.();
    await expect(pending).rejects.toBeDefined();
    expect(useAccessStore().accessToken).toBe('new-session');
    expect(logout).not.toHaveBeenCalled();
  });
  it('直接使用配置的服务域名，系统接口保留真实 /api 路径，业务接口使用根路径', () => {
    for (const client of [
      authRequestClient,
      requestClient,
      baseRequestClient,
    ]) {
      expect(client.instance.getUri({ url: '/system/auth/me' })).toBe(
        'https://qq.i4.cn/api/system/auth/me',
      );
    }
    expect(
      configInfoRequestClient.instance.getUri({ url: '/appInfo/list' }),
    ).toBe('https://qq.i4.cn/appInfo/list');
  });
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
