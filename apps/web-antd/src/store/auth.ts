import type { UserInfo } from '@vben/types';

import type { AuthApi, SystemMenu } from '#/api';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import {
  getAllMenusApi,
  getCurrentAccessApi,
  getUserInfoApi,
  loginApi,
  logoutApi,
  verifyLoginSmsApi,
} from '#/api';
import { resetRoutes } from '#/router';
import {
  buildAuthorizedRoutes,
  firstAuthorizedPath,
} from '#/router/menu-adapter';
import { getText } from '#/texts';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);
  const menuTree = ref<SystemMenu[]>([]);
  const passwordResetRequired = computed(() =>
    Boolean(userStore.userInfo?.passwordResetRequired),
  );

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   */
  async function authLogin(
    params: AuthApi.LoginParams,
    onSuccess?: () => Promise<void> | void,
  ) {
    try {
      loginLoading.value = true;
      const result = await loginApi(params);
      if (result.status === 'AUTHENTICATED')
        await finishLogin(result, onSuccess);
      return result;
    } finally {
      loginLoading.value = false;
    }
  }

  async function authVerifySms(challengeId: string, code: string) {
    loginLoading.value = true;
    try {
      const result = await verifyLoginSmsApi(challengeId, code);
      await finishLogin(result);
      return result;
    } finally {
      loginLoading.value = false;
    }
  }

  async function finishLogin(
    result: AuthApi.LoginResult,
    onSuccess?: () => Promise<void> | void,
  ) {
    if (result.status !== 'AUTHENTICATED' || !result.accessToken)
      throw new Error('登录响应缺少访问令牌');
    resetAllStores();
    resetRoutes();
    loginLoading.value = true;
    accessStore.setAccessToken(result.accessToken);
    try {
      const userInfo = await fetchUserInfo();
      accessStore.setLoginExpired(false);
      if (passwordResetRequired.value) {
        await router.replace('/auth/change-password');
      } else if (onSuccess) {
        await onSuccess();
      } else {
        await router.push(userInfo.homePath);
      }
      notification.success({
        description: `${getText('authentication.loginSuccessDesc')}:${userInfo.realName}`,
        duration: 3,
        message: getText('authentication.loginSuccess'),
      });
    } catch (error) {
      accessStore.setAccessToken(null);
      accessStore.setAccessCodes([]);
      userStore.setUserInfo(null);
      menuTree.value = [];
      throw error;
    }
  }

  async function logout(redirect: boolean = true, notifyServer = true) {
    try {
      if (notifyServer) await logoutApi();
    } catch {
      // 不做任何处理
    }
    resetAllStores();
    resetRoutes();
    accessStore.setLoginExpired(false);

    // 回登录页带上当前路由地址
    await router.replace({
      path: LOGIN_PATH,
      query: redirect
        ? {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath),
          }
        : {},
    });
  }

  async function fetchUserInfo() {
    const token = accessStore.accessToken;
    const [user, access] = await Promise.all([
      getUserInfoApi(),
      getCurrentAccessApi(),
    ]);
    const menus = user.passwordResetRequired ? [] : await getAllMenusApi();
    if (token !== accessStore.accessToken)
      throw new Error('登录状态已变化，请重新登录');
    menuTree.value = menus;
    const userInfo: UserInfo & {
      passwordResetRequired: boolean;
      superAdmin: boolean;
    } = {
      ...user,
      avatar: user.avatarUrl || preferences.app.defaultAvatar,
      desc: user.nickname || '',
      homePath:
        firstAuthorizedPath(buildAuthorizedRoutes(menuTree.value)) ||
        '/access-empty',
      realName: user.realName || user.nickname || user.username,
      roles: access.roleCodes,
      superAdmin: access.superAdmin,
      token: accessStore.accessToken || '',
      userId: String(user.id),
    };
    accessStore.setAccessCodes(access.permissionCodes);
    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
    menuTree.value = [];
  }

  return {
    $reset,
    authLogin,
    authVerifySms,
    fetchUserInfo,
    loginLoading,
    logout,
    menuTree,
    passwordResetRequired,
  };
});
