/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { useAuthStore } from '#/store';

import { refreshTokenApi } from './core';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

// Download endpoints may return business errors as JSON even with responseType=blob.
async function decodeJsonBlob(data: unknown): Promise<unknown> {
  if (!(data instanceof Blob)) return data;
  const prefix = await data.slice(0, 64).text();
  if (!/json/i.test(data.type) && !/^[\s\uFEFF]*[\[{]/.test(prefix))
    return data;
  try {
    return JSON.parse(await data.text());
  } catch {
    return data;
  }
}

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
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
      await authStore.logout();
    }
  }

  /**
   * 刷新token逻辑
   */
  async function doRefreshToken() {
    const accessStore = useAccessStore();
    if (!accessStore.refreshToken) {
      throw new Error('Refresh token is missing');
    }
    const result = await refreshTokenApi(accessStore.refreshToken);
    accessStore.setAccessToken(result.accessToken);
    accessStore.setRefreshToken(result.refreshToken);
    return result.accessToken;
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = preferences.app.locale;
      return config;
    },
  });

  // 芋道接口使用 HTTP 200 + 业务码 401 表示登录失效，转换为标准 401
  // 以复用现有的刷新 Token 和重新登录逻辑。
  client.addResponseInterceptor({
    fulfilled: async (response) => {
      response.data = await decodeJsonBlob(response.data);
      const responseData = response.data as { code?: number; msg?: string };
      const requestUrl = String(response.config.url || '');

      if (
        responseData?.code === 401 &&
        !requestUrl.includes('/system/auth/logout')
      ) {
        const authError = Object.assign(
          new Error(responseData.msg || '账号未登录'),
          { config: response.config, response: { ...response, status: 401 } },
        );
        return Promise.reject(authError);
      }
      if (
        response.config.responseType === 'blob' &&
        typeof responseData?.code === 'number' &&
        responseData.code !== 0
      ) {
        throw Object.assign(new Error(responseData.msg || '下载失败'), {
          config: response.config,
          response,
        });
      }
      return response;
    },
    rejected: async (error) => {
      if (error.response) {
        error.response.data = await decodeJsonBlob(error.response.data);
      }
      throw error;
    },
  });

  // 处理返回的响应数据格式
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'data',
      successCode: 0,
    }),
  );

  // token过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      // 这里可以根据业务进行定制,你可以拿到 error 内的信息进行定制化处理，根据不同的 code 做不同的提示，而不是直接使用 message.error 提示 msg
      // 兼容接口返回的不同错误字段。
      const responseData = error?.response?.data ?? {};
      const errorMessage =
        responseData?.msg ?? responseData?.error ?? responseData?.message ?? '';
      // 如果没有错误信息，则会根据状态码进行提示
      message.error(errorMessage || msg);
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const baseRequestClient = new RequestClient({ baseURL: apiURL });
