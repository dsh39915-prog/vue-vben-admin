import type { UserInfo } from '@vben/types';

import type { AuthApi, SystemMenu } from '#/api';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import {
  getTabKey,
  resetAllStores,
  useAccessStore,
  useTabbarStore,
  useUserStore,
} from '@vben/stores';

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
import { generateAccess } from '#/router/access';
import { authenticatedDestination } from '#/router/access-redirect';
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
  const moduleIds = ref<number[]>([]);
  const accessRefreshFailed = ref(false);
  const accessRefreshing = ref(false);
  const accessRevision = ref(0);
  let refreshId = 0;
  let refreshPromise: Promise<boolean> | undefined;
  let initializationId = 0;
  let sessionId = 0;
  let initializedToken: null | string = null;
  let initialization: undefined | { promise: Promise<UserInfo>; token: string };
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
    const session = sessionId;
    const redirect = router.currentRoute.value.query?.redirect;
    try {
      const userInfo = await initializeAccess();
      accessStore.setLoginExpired(false);
      if (passwordResetRequired.value) {
        await router.replace('/auth/change-password');
      } else if (onSuccess) {
        await onSuccess();
      } else {
        await router.push(
          authenticatedDestination(router, redirect, userInfo.homePath),
        );
      }
      notification.success({
        description: `${getText('authentication.loginSuccessDesc')}:${userInfo.realName}`,
        duration: 3,
        message: getText('authentication.loginSuccess'),
      });
    } catch (error) {
      if (
        session === sessionId &&
        result.accessToken === accessStore.accessToken
      ) {
        accessStore.setAccessToken(null);
        accessStore.setAccessCodes([]);
        userStore.setUserInfo(null);
        menuTree.value = [];
        moduleIds.value = [];
      }
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
    const session = sessionId;
    const [user, access] = await Promise.all([
      getUserInfoApi(),
      getCurrentAccessApi(),
    ]);
    const menus = user.passwordResetRequired ? [] : await getAllMenusApi();
    if (token !== accessStore.accessToken || session !== sessionId)
      throw new Error('登录状态已变化，请重新登录');
    menuTree.value = menus;
    moduleIds.value = [...(access.moduleIds ?? [])];
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

  /** 登录与路由守卫共享初始化：资料、菜单、路由全部就绪后才允许跳转。 */
  function initializeAccess(force = false): Promise<UserInfo> {
    const token = accessStore.accessToken;
    if (!token) return Promise.reject(new Error('请先登录'));
    if (initialization?.token === token) {
      if (force)
        return initialization.promise.then(() => initializeAccess(true));
      return initialization.promise;
    }
    const currentUser = userStore.userInfo;
    if (
      !force &&
      initializedToken === token &&
      currentUser &&
      (accessStore.isAccessChecked || passwordResetRequired.value)
    )
      return Promise.resolve(currentUser as UserInfo);
    const request = ++initializationId;
    function assertCurrent() {
      if (request !== initializationId || token !== accessStore.accessToken)
        throw new Error('登录状态已变化，请重新登录');
    }
    const pending = (async () => {
      try {
        const user = await fetchUserInfo();
        assertCurrent();
        if (force) resetRoutes();
        accessStore.setIsAccessChecked(false);
        if (user.passwordResetRequired) {
          accessStore.setAccessMenus([]);
          accessStore.setAccessRoutes([]);
        } else {
          const { accessibleMenus, accessibleRoutes } = await generateAccess({
            router,
            routes: [],
            roles: user.roles,
          });
          assertCurrent();
          accessStore.setAccessMenus(accessibleMenus);
          accessStore.setAccessRoutes(accessibleRoutes);
          const tabs = useTabbarStore();
          const removed = tabs.tabs.filter(
            (tab) => !tab.name || !router.hasRoute(tab.name),
          );
          if (removed.length > 0)
            await tabs._bulkCloseByKeys(removed.map((tab) => getTabKey(tab)));
          assertCurrent();
          accessStore.setIsAccessChecked(true);
        }
        initializedToken = token;
        accessRevision.value += 1;
        return user;
      } finally {
        if (request === initializationId) initialization = undefined;
      }
    })();
    initialization = { promise: pending, token };
    return pending;
  }

  /** 菜单和授权变更后重新取接口数据，替换路由并清理失效标签。 */
  function refreshAccess(): Promise<boolean> {
    if (refreshPromise) return refreshPromise;
    const token = accessStore.accessToken;
    if (!token) return Promise.resolve(false);
    const request = ++refreshId;
    const currentPath = router.currentRoute.value.fullPath;
    accessRefreshing.value = true;
    const pending = (async () => {
      try {
        const user = await initializeAccess(true);
        if (token !== accessStore.accessToken) return false;
        let destination = authenticatedDestination(
          router,
          currentPath,
          user.homePath,
        );
        if (passwordResetRequired.value) destination = '/auth/change-password';
        await router.replace(destination);
        accessRefreshFailed.value = false;
        return true;
      } catch {
        // 保存已经成功；阻止使用旧授权继续操作，并提供独立重试，避免重复提交。
        if (token === accessStore.accessToken) accessRefreshFailed.value = true;
        return false;
      } finally {
        if (token === accessStore.accessToken) accessRefreshing.value = false;
        if (request === refreshId) refreshPromise = undefined;
      }
    })();
    refreshPromise = pending;
    return pending;
  }

  function $reset() {
    loginLoading.value = false;
    menuTree.value = [];
    moduleIds.value = [];
    accessRefreshFailed.value = false;
    accessRefreshing.value = false;
    accessRevision.value = 0;
    refreshPromise = undefined;
    ++refreshId;
    ++initializationId;
    ++sessionId;
    initialization = undefined;
    initializedToken = null;
  }

  return {
    $reset,
    accessRefreshFailed,
    accessRefreshing,
    accessRevision,
    refreshAccess,
    authLogin,
    authVerifySms,
    fetchUserInfo,
    initializeAccess,
    loginLoading,
    logout,
    menuTree,
    moduleIds,
    passwordResetRequired,
  };
});
