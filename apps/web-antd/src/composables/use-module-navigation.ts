import type { SystemModule } from '#/api';

import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useAccessStore, useUserStore } from '@vben/stores';

import { getSystemResourceListApi } from '#/api';
import { findMenuModule, groupModuleMenus } from '#/layouts/module-menus';
import { useAuthStore } from '#/store';

import { useSystemAccess } from './use-system-access';

export function useModuleNavigation() {
  const route = useRoute();
  const access = useAccessStore();
  const users = useUserStore();
  const auth = useAuthStore();
  const { can } = useSystemAccess();
  const modules = ref<SystemModule[]>([]);
  const loading = ref(false);
  const failed = ref(false);
  const selected = ref<null | number>();
  let request = 0;
  const groups = computed(() => {
    const result = groupModuleMenus(
      access.accessMenus,
      auth.menuTree,
      modules.value,
    );
    if (users.userInfo?.superAdmin === true) return result;
    return result.filter(
      (group) => group.id === null || auth.moduleIds.includes(group.id),
    );
  });
  const sidebarMenus = computed(
    () =>
      groups.value.find((group) => group.id === selected.value)?.menus ?? [],
  );
  function select(id: null | number) {
    if (groups.value.some((group) => group.id === id)) selected.value = id;
  }
  function syncRoute() {
    const group = findMenuModule(
      groups.value,
      (route.meta.activePath as string) || route.path,
    );
    if (group) selected.value = group.id;
    else if (!groups.value.some((item) => item.id === selected.value))
      selected.value = groups.value[0]?.id;
  }
  watch(() => route.fullPath, syncRoute, { immediate: true });
  watch(
    groups,
    () => {
      if (!groups.value.some((group) => group.id === selected.value))
        syncRoute();
    },
    { immediate: true },
  );
  async function reloadModules() {
    const current = ++request;
    const token = access.accessToken;
    failed.value = false;
    if (!token || !can('modules', 'read')) {
      loading.value = false;
      return;
    }
    loading.value = true;
    try {
      const data = await getSystemResourceListApi('modules');
      if (current !== request || token !== access.accessToken) return;
      modules.value = Array.isArray(data) ? data : data.records;
    } catch {
      if (current === request) failed.value = true;
    } finally {
      if (current === request) loading.value = false;
    }
  }
  watch(
    [
      () => access.accessToken,
      () => can('modules', 'read'),
      () => auth.accessRevision,
    ],
    ([token], [oldToken]) => {
      if (token !== oldToken) {
        modules.value = [];
        selected.value = undefined;
        syncRoute();
      }
      void reloadModules();
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    ++request;
  });
  return {
    failed,
    groups,
    loading,
    reloadModules,
    select,
    selected,
    sidebarMenus,
  };
}
