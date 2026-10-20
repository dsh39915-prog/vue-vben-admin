import type { Recordable, UserInfo } from '@vben/types';

import type { AuthApi } from '#/api/core/auth';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import { getPermissionInfoApi, loginApi, logoutApi } from '#/api';
import {
  drawingHomePath,
  resolveDrawingAccessCodes,
} from '#/features/drawing/nodes';
import { $t } from '#/locales';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
    authenticate?: () => Promise<AuthApi.LoginResult>,
  ) {
    // 异步处理用户登录操作并获取 accessToken
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;
      const { accessToken, refreshToken } = await (authenticate
        ? authenticate()
        : loginApi(params));

      // 如果成功获取到 accessToken
      if (accessToken) {
        accessStore.setAccessToken(accessToken);
        accessStore.setRefreshToken(refreshToken);

        // 一次获取用户、角色和权限码，避免重复请求权限接口
        const permissionInfo = await getPermissionInfoApi();
        const accessCodes = resolveDrawingAccessCodes(
          permissionInfo.permissions,
          permissionInfo.roles,
        );
        userInfo = {
          avatar: permissionInfo.user.avatar || '',
          desc: '',
          homePath:
            drawingHomePath(accessCodes) || preferences.app.defaultHomePath,
          realName: permissionInfo.user.nickname,
          roles: permissionInfo.roles,
          token: accessToken,
          userId: String(permissionInfo.user.id),
          username: permissionInfo.user.username,
        };

        userStore.setUserInfo(userInfo);
        accessStore.setAccessCodes(accessCodes);

        if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
        } else {
          onSuccess
            ? await onSuccess?.()
            : await router.push(
                userInfo.homePath || preferences.app.defaultHomePath,
              );
        }

        if (userInfo?.realName) {
          notification.success({
            description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
            duration: 3,
            message: $t('authentication.loginSuccess'),
          });
        }
      }
    } catch (error) {
      accessStore.setAccessToken(null);
      accessStore.setRefreshToken(null);
      accessStore.setAccessCodes([]);
      userStore.setUserInfo(null);
      throw error;
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function logout(redirect: boolean = true) {
    try {
      await logoutApi();
    } catch {
      // 不做任何处理
    }
    resetAllStores();
    accessStore.setLoginExpired(false);

    // 已经在登录页时不能再带 redirect：此时 currentRoute.fullPath 就是登录页本身，
    // 再编码一层会得到「登录页?redirect=编码后的登录页」，下一次又在这个基础上再包一层，
    // 反复登出会让 URL 逐跳变长，且没有上限。
    // On the login page the current route is the login page itself, so carrying it as
    // `redirect` would nest one more encoded layer on every repeat.
    const currentRoute = router.currentRoute.value;
    const alreadyOnLogin = currentRoute.path === LOGIN_PATH;

    // 回登录页带上当前路由地址
    await router.replace({
      path: LOGIN_PATH,
      query:
        redirect && !alreadyOnLogin
          ? { redirect: encodeURIComponent(currentRoute.fullPath) }
          : {},
    });
  }

  async function fetchUserInfo() {
    const { user, roles, permissions } = await getPermissionInfoApi();
    const accessCodes = resolveDrawingAccessCodes(permissions, roles);
    const userInfo: UserInfo = {
      avatar: user.avatar || '',
      desc: '',
      homePath: drawingHomePath(accessCodes) || preferences.app.defaultHomePath,
      realName: user.nickname,
      roles,
      token: '',
      userId: String(user.id),
      username: user.username,
    };
    userStore.setUserInfo(userInfo);
    accessStore.setAccessCodes(accessCodes);
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    fetchUserInfo,
    loginLoading,
    logout,
  };
});
