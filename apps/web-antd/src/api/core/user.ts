import type { SystemUser } from '../system';

import { requestClient } from '#/api/request';

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  return requestClient.get<SystemUser>('/system/auth/me');
}
