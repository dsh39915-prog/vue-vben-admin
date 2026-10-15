import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    captchaVerification?: string;
    password?: string;
    socialCode?: string;
    socialState?: string;
    socialType?: number;
    username?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
    expiresTime: string;
    refreshToken: string;
    userId: number;
  }

  export interface PermissionInfo {
    menus: unknown[];
    permissions: string[];
    roles: string[];
    user: {
      avatar?: string;
      id: number;
      nickname: string;
      username: string;
    };
  }

  export interface RegisterParams {
    captchaVerification?: string;
    password: string;
    username: string;
  }

  export interface ResetPasswordParams {
    code: string;
    mobile: string;
    password: string;
  }

  export interface SmsCodeParams {
    mobile: string;
    scene: number;
  }

  export interface SmsLoginParams {
    code: string;
    mobile: string;
  }

  export interface SocialLoginParams {
    code: string;
    state: string;
    type: number;
  }

  export interface CommonResult<T> {
    code: number;
    data: T;
    msg: string;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/system/auth/login', data);
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi(refreshToken: string) {
  const response = await baseRequestClient.post<{
    data: AuthApi.CommonResult<AuthApi.LoginResult>;
  }>(
    '/system/auth/refresh-token',
    undefined,
    {
      params: { refreshToken },
    },
  );
  if (response.data.code !== 0) {
    throw new Error(response.data.msg || '刷新令牌失败');
  }
  return response.data.data;
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return requestClient.post('/system/auth/logout');
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  const result = await getPermissionInfoApi();
  return result.permissions;
}

/** 获取登录用户、角色、权限码与菜单树 */
export async function getPermissionInfoApi() {
  return requestClient.get<AuthApi.PermissionInfo>(
    '/system/auth/get-permission-info',
  );
}

export async function registerApi(data: AuthApi.RegisterParams) {
  return requestClient.post<AuthApi.LoginResult>('/system/auth/register', data);
}

export async function resetPasswordApi(data: AuthApi.ResetPasswordParams) {
  return requestClient.post<boolean>('/system/auth/reset-password', data);
}

export async function sendSmsCodeApi(data: AuthApi.SmsCodeParams) {
  return requestClient.post<boolean>('/system/auth/send-sms-code', data);
}

export async function smsLoginApi(data: AuthApi.SmsLoginParams) {
  return requestClient.post<AuthApi.LoginResult>(
    '/system/auth/sms-login',
    data,
  );
}

export async function socialLoginApi(data: AuthApi.SocialLoginParams) {
  return requestClient.post<AuthApi.LoginResult>(
    '/system/auth/social-login',
    data,
  );
}

export async function getSocialAuthRedirectApi(
  type: number,
  redirectUri: string,
) {
  return requestClient.get<string>('/system/auth/social-auth-redirect', {
    params: { redirectUri, type },
  });
}
