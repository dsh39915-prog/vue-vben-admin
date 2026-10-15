import type { UserInfo } from '@vben/types';

import { getPermissionInfoApi } from './auth';

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  const { roles, user } = await getPermissionInfoApi();
  return {
    avatar: user.avatar || '',
    desc: '',
    homePath: '/dashboard/overview',
    realName: user.nickname,
    roles,
    token: '',
    userId: String(user.id),
    username: user.username,
  } satisfies UserInfo;
}
