<script lang="ts" setup>
import { computed, watch } from 'vue';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import { BasicLayout, LockScreen, UserDropdown } from '@vben/layouts';
import {
  preferences,
  updatePreferences,
  usePreferences,
} from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

import { useModuleNavigation } from '#/composables/use-module-navigation';
import { useAuthStore } from '#/store';
import LoginForm from '#/views/_core/authentication/login.vue';

import ModuleNavigation from './module-navigation.vue';

const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const { destroyWatermark, updateWatermark } = useWatermark();
const { isDark } = usePreferences();
const moduleNavigation = useModuleNavigation();
// 使用模块导航布局，同时保留用户已有主题等其他偏好。
updatePreferences({
  app: { layout: 'mixed-nav' },
  navigation: { split: true },
});
const avatar = computed(
  () => userStore.userInfo?.avatar ?? preferences.app.defaultAvatar,
);
async function handleLogout() {
  await authStore.logout(false);
}

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
    isDark: isDark.value,
  }),
  async ({ enable, content, isDark: isDarkValue }) => {
    if (enable) {
      const color = isDarkValue
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.12)';
      await updateWatermark({
        advancedStyle: {
          colorStops: [
            { color, offset: 0 },
            { color, offset: 1 },
          ],
          type: 'linear',
        },
        content:
          content ||
          `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
      });
    } else destroyWatermark();
  },
  { immediate: true },
);
</script>

<template>
  <BasicLayout
    :sidebar-menus="moduleNavigation.sidebarMenus.value"
    @clear-preferences-and-logout="handleLogout"
  >
    <template #header-menu>
      <ModuleNavigation
        :groups="moduleNavigation.groups.value"
        :selected="moduleNavigation.selected.value"
        :loading="moduleNavigation.loading.value"
        :failed="moduleNavigation.failed.value"
        @select="moduleNavigation.select"
        @retry="moduleNavigation.reloadModules"
      />
    </template>
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :text="userStore.userInfo?.realName"
        :description="userStore.userInfo?.username"
        @logout="handleLogout"
        @clear-preferences-and-logout="handleLogout"
      />
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>
