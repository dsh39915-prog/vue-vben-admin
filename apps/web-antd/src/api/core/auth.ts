import type { SystemAccess } from '../system';

import { authRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    captchaVerifyParam?: string;
    password: string;
    username: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken?: string;
    challengeId?: string;
    expiresAt?: string;
    maskedMobile?: string;
    passwordResetRequired?: boolean;
    status: 'AUTHENTICATED' | 'MFA_REQUIRED';
    tokenType?: string;
    userId?: number;
    username?: string;
  }
  export interface CaptchaConfig {
    enabled: boolean;
    prefix: string;
    region?: 'cn' | 'sgp';
    sceneId: string;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return authRequestClient.post<AuthApi.LoginResult>(
    '/system/auth/login',
    data,
  );
}

/**
 * 完成短信二次验证
 */
export function verifyLoginSmsApi(challengeId: string, code: string) {
  return authRequestClient.post<AuthApi.LoginResult>(
    '/system/auth/sms/verify',
    { challengeId, code },
  );
}
export function resendLoginSmsApi(challengeId: string) {
  return authRequestClient.post<null>(
    `/system/auth/challenges/${encodeURIComponent(challengeId)}/sms`,
  );
}
export function getCaptchaConfigApi() {
  return authRequestClient.get<AuthApi.CaptchaConfig>('/system/auth/captcha');
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return authRequestClient.post<null>('/system/auth/logout');
}

/**
 * 获取用户权限码
 */
export function getCurrentAccessApi() {
  return requestClient.get<SystemAccess>('/system/auth/access');
}
export async function getAccessCodesApi() {
  const access = await getCurrentAccessApi();
  return access.permissionCodes;
}
export function changeCurrentPasswordApi(data: {
  newPassword: string;
  oldPassword: string;
}) {
  return requestClient.put<null>('/system/auth/password', data);
}
