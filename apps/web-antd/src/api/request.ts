/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { useAuthStore } from '#/store';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const serviceURL = apiURL.replace(/\/+$/, '');
const systemApiURL = `${serviceURL}/api`;

function createRequestClient(
  baseURL: string,
  options?: RequestClientOptions,
  successCode = 200,
  authenticate = true,
) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });

  /**
   * 重新认证逻辑
   */
  async function doReAuthenticate() {
    console.warn('Access token or refresh token is invalid or expired. ');
    const accessStore = useAccessStore();
    const authStore = useAuthStore();
    accessStore.setAccessToken(null);
    if (
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked
    ) {
      accessStore.setLoginExpired(true);
    } else {
      await authStore.logout(true, false);
    }
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = 'zh-CN';
      return config;
    },
  });

  // 处理返回的响应数据格式
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'data',
      successCode,
    }),
  );

  // token过期的处理
  if (authenticate)
    client.addResponseInterceptor({
      rejected: async (error) => {
        if (error?.response?.status === 401) {
          const access = useAccessStore();
          // 首次 await 前清空令牌，跨客户端的并发失效也只退出一次。
          // 旧会话的响应不能撤销刚建立的新会话。
          const authorization = error.config?.headers?.Authorization;
          if (
            access.accessToken &&
            authorization === formatToken(access.accessToken)
          )
            await doReAuthenticate();
        }
        throw error;
      },
    });

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      if (authenticate && error?.response?.status === 401) return;
      // 这里可以根据业务进行定制,你可以拿到 error 内的信息进行定制化处理，根据不同的 code 做不同的提示，而不是直接使用 message.error 提示 msg
      // 展示后端返回的业务错误信息。
      const responseData = error?.response?.data ?? {};
      const errorMessage = responseData?.error ?? responseData?.message ?? '';
      // 如果没有错误信息，则会根据状态码进行提示
      message.error(errorMessage || msg);
    }),
  );

  return client;
}

export const requestClient = createRequestClient(
  systemApiURL,
  { responseReturn: 'data' },
  200,
);

// 登录失败和退出时不触发重新登录，避免 401 引发退出请求循环。
export const authRequestClient = createRequestClient(
  systemApiURL,
  { responseReturn: 'data' },
  200,
  false,
);

export const baseRequestClient = new RequestClient({ baseURL: systemApiURL });

// 系统与业务接口共享环境配置的服务地址，业务接口位于服务根路径。
export const configInfoRequestClient = createRequestClient(
  serviceURL,
  { responseReturn: 'data' },
  200,
);
