import type { App } from 'vue';

import { createApp, nextTick, reactive } from 'vue';

import { useAccessStore } from '@vben/stores';

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useModuleNavigation } from './use-module-navigation';

const api = vi.hoisted(() => ({ getSystemResourceListApi: vi.fn() }));
const permission = vi.hoisted(() => ({ can: vi.fn() }));
const raw = vi.hoisted(() => ({
  moduleIds: [17, 31],
  menuTree: [
    { id: 1, path: '/custom/users', moduleId: 17, children: [] },
    { id: 2, path: '/custom/apps', moduleId: 31, children: [] },
  ],
}));
vi.mock('#/api', () => api);
const authState = reactive(raw);
vi.mock('#/store', () => ({ useAuthStore: () => authState }));
vi.mock('./use-system-access', () => ({ useSystemAccess: () => permission }));
const route = reactive({
  path: '/custom/apps',
  fullPath: '/custom/apps',
  meta: {},
});
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRoute: () => route,
}));
let app: App;
async function mountNavigation() {
  const container = document.createElement('div');
  document.body.append(container);
  let navigation: ReturnType<typeof useModuleNavigation> | undefined;
  app = createApp({
    setup() {
      navigation = useModuleNavigation();
      return () => null;
    },
  });
  const pinia = createPinia();
  setActivePinia(pinia);
  app.use(pinia);
  const access = useAccessStore(pinia);
  access.setAccessToken('test-session');
  access.setAccessMenus([
    { name: '接口系统入口', path: '/custom/users' },
    { name: '接口业务入口', path: '/custom/apps' },
  ]);
  app.mount(container);
  await nextTick();
  if (!navigation) throw new Error('模块导航未初始化');
  return { access, navigation };
}
beforeEach(() => {
  vi.resetAllMocks();
  authState.moduleIds = [17, 31];
  permission.can.mockReturnValue(true);
  route.path = '/custom/apps';
  route.fullPath = '/custom/apps';
  route.meta = {};
  api.getSystemResourceListApi.mockResolvedValue([
    { id: 17, name: '接口系统模块', enabled: true, sortOrder: 1 },
    { id: 31, name: '接口业务模块', enabled: true, sortOrder: 2 },
  ]);
});
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('模块导航状态', () => {
  it('深链初始化对应模块，手动切换仅更新左栏，切换页面和返回历史时同步模块', async () => {
    const { navigation, access } = await mountNavigation();
    await vi.waitFor(() =>
      expect(navigation.groups.value[0]?.name).toBe('接口系统模块'),
    );
    expect(navigation.selected.value).toBe(31);
    navigation.select(17);
    await nextTick();
    expect(navigation.sidebarMenus.value.map((item) => item.path)).toEqual([
      '/custom/users',
    ]);
    expect(route.path).toBe('/custom/apps');
    route.path = '/custom/users';
    route.fullPath = '/custom/users';
    await nextTick();
    expect(navigation.selected.value).toBe(17);
    route.path = '/custom/apps';
    route.fullPath = '/custom/apps';
    await nextTick();
    expect(navigation.selected.value).toBe(31);
    expect(access.accessMenus).toHaveLength(2);
  });
  it('模块读取失败仍能按接口ID切换菜单，并支持重试恢复名称', async () => {
    api.getSystemResourceListApi.mockRejectedValueOnce(new Error('offline'));
    const { navigation } = await mountNavigation();
    await vi.waitFor(() => expect(navigation.failed.value).toBe(true));
    navigation.select(17);
    expect(navigation.sidebarMenus.value[0]?.path).toBe('/custom/users');
    await navigation.reloadModules();
    expect(navigation.failed.value).toBe(false);
    expect(navigation.selected.value).toBe(17);
    expect(navigation.groups.value[0]?.name).toBe('接口系统模块');
  });
  it('没有模块管理读取权限时不请求管理接口，保留授权菜单分组', async () => {
    permission.can.mockReturnValue(false);
    const { navigation } = await mountNavigation();
    expect(api.getSystemResourceListApi).not.toHaveBeenCalled();
    expect(navigation.groups.value).toHaveLength(2);
    expect(navigation.sidebarMenus.value[0]?.path).toBe('/custom/apps');
  });
  it('只显示接口授权的模块，权限变化后重新选择可见模块', async () => {
    const { navigation } = await mountNavigation();
    authState.moduleIds = [17];
    await nextTick();
    expect(navigation.groups.value.map((group) => group.id)).toEqual([17]);
    expect(navigation.selected.value).toBe(17);
    expect(navigation.sidebarMenus.value[0]?.path).toBe('/custom/users');
  });
  it('退出后丢弃尚未返回的模块信息', async () => {
    let finish: ((value: unknown) => void) | undefined;
    api.getSystemResourceListApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { navigation, access } = await mountNavigation();
    access.setAccessToken(null);
    access.setAccessMenus([]);
    await nextTick();
    finish?.([{ id: 17, name: '旧账号模块', enabled: true, sortOrder: 1 }]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(navigation.groups.value).toEqual([]);
    expect(navigation.sidebarMenus.value).toEqual([]);
    expect(navigation.loading.value).toBe(false);
  });
});
