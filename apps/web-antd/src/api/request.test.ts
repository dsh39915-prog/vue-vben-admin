import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getConfigInfoListApi } from './config-info';
import { logoutApi } from './core/auth';
import { reloadMobileCacheApi } from './mobile-cache';
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
afterEach(() => vi.restoreAllMocks());
describe('真实服务响应和会话失效', () => {
  it('服务端退出固定使用旧令牌，不读取新会话，也不提示旧退出请求的错误', async () => {
    const showError = vi.spyOn(message, 'error');
    useAccessStore().setAccessToken('new-session');
    const adapter = vi.fn(async (config) => {
      throw Object.assign(new Error('old session expired'), {
        config,
        response: { status: 401, data: { message: '旧令牌失效' } },
      });
    });
    baseRequestClient.instance.defaults.adapter = adapter;
    await expect(logoutApi('old-session')).rejects.toThrow('旧令牌失效');
    expect(adapter.mock.calls[0]?.[0].headers.Authorization).toBe(
      'Bearer old-session',
    );
    expect(useAccessStore().accessToken).toBe('new-session');
    expect(logout).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });
  it('列表将取消信号交给 HTTP 客户端，已取消的请求不发送也不提示错误', async () => {
    const showError = vi.spyOn(message, 'error');
    const controller = new AbortController();
    const adapter = vi.fn(async (config) => ({
      config,
      data: { code: 200, data: null },
      status: 200,
      statusText: 'OK',
      headers: {},
    }));
    configInfoRequestClient.instance.defaults.adapter = adapter;
    await getConfigInfoListApi({ page: 1, pageSize: 20 }, controller.signal);
    expect(adapter.mock.calls[0]?.[0].signal).toBe(controller.signal);
    expect(JSON.parse(adapter.mock.calls[0]?.[0].data)).toEqual({
      page: 1,
      pageSize: 20,
    });
    controller.abort();
    await expect(
      getConfigInfoListApi({ page: 2, pageSize: 20 }, controller.signal),
    ).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(showError).not.toHaveBeenCalled();
  });
  it.each([
    { status: 200, data: { code: 202, data: null } },
    { status: 202, data: { code: 202, data: null } },
    { status: 202, data: '' },
    { status: 200, data: { code: 200, data: null } },
  ])('缓存刷新接受异步提交和原有成功响应：%j', async ({ status, data }) => {
    const showError = vi.spyOn(message, 'error');
    useAccessStore().setAccessToken('test-token');
    const adapter = vi.fn(async (config) => ({
      status,
      data,
      statusText: 'Accepted',
      headers: {},
      config,
    }));
    configInfoRequestClient.instance.defaults.adapter = adapter;
    await reloadMobileCacheApi(20);
    expect(adapter.mock.calls[0]?.[0].headers.Authorization).toBe(
      'Bearer test-token',
    );
    expect(showError).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });
  it.each([
    { url: '/mobileCache/reload/20', status: 202, code: 500 },
    { url: '/appInfo/list', status: 200, code: 202 },
    { url: '/mobileCache/reload/20', status: 500, code: 202 },
  ])(
    '异步成功规则不放过业务错误或影响其它接口：%j',
    async ({ url, status, code }) => {
      configInfoRequestClient.instance.defaults.adapter = async (config) => ({
        status,
        data: { code, message: '接口错误' },
        statusText: 'Error',
        headers: {},
        config,
      });
      await expect(configInfoRequestClient.get(url)).rejects.toBeDefined();
    },
  );
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
