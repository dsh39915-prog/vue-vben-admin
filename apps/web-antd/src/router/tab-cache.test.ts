import type { App } from 'vue';

import type { SystemMenu } from '#/api';

import { createApp, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';

import { generateAccessible } from '@vben/access';
import { useTabbarStore } from '@vben/stores';

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LayoutContent from '../../../../packages/effects/layouts/src/basic/content/content.vue';
import { buildAuthorizedRoutes } from './menu-adapter';

function serverMenu(id: number, path: string, name: string): SystemMenu {
  return {
    id,
    path,
    name,
    enabled: true,
    hidden: false,
    icon: '',
    menuType: 2,
    moduleId: null,
    parentId: null,
    permissionCode: '',
    remark: '',
    sortOrder: id,
  };
}

const api = vi.hoisted(() => ({
  addClientSwitchApi: vi.fn(),
  addConfigInfoApi: vi.fn(),
  deleteClientSwitchApi: vi.fn(),
  getClientSwitchDetailsApi: vi.fn(),
  getClientSwitchListApi: vi.fn(),
  getConfigInfoDetailsApi: vi.fn(),
  getConfigInfoListApi: vi.fn(),
  updateClientSwitchApi: vi.fn(),
  updateConfigInfoApi: vi.fn(),
}));

vi.mock('#/api', () => api);
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));

let app: App;

beforeEach(() => {
  vi.resetAllMocks();
  api.getConfigInfoListApi.mockImplementation(async ({ page, pageSize }) => ({
    current: page,
    pages: 3,
    records: [{ id: 5, configName: '缓存测试配置', status: 1 }],
    size: pageSize,
    total: 55,
  }));
  api.getClientSwitchListApi.mockImplementation(async ({ page, pageSize }) => ({
    current: page,
    pages: 3,
    records: [
      {
        id: 8,
        clientVersion: '213',
        createUser: '缓存测试创建人',
        status: 1,
        switchType: 1,
      },
    ],
    size: pageSize,
    total: 55,
  }));
});

afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

async function mountPages() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const tabbar = useTabbarStore(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'Root', component: LayoutContent, children: [] },
    ],
  });
  await generateAccessible('frontend', {
    router,
    roles: [],
    routes: buildAuthorizedRoutes([
      serverMenu(1, '/config-info', '配置管理'),
      serverMenu(2, '/client-switch', '客户端壳开关'),
    ]),
  });
  router.afterEach((route) => tabbar.addTab(route));
  await router.push('/config-info');
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp({ render: () => h(RouterView) });
  app.use(pinia);
  app.use(router);
  app.mount(container);
  await vi.waitFor(() =>
    expect(document.body.textContent).toContain('缓存测试配置'),
  );
  return { router, tabbar };
}

function currentPage() {
  return document
    .querySelector('.ant-pagination-item-active')
    ?.getAttribute('title');
}

async function goToThirdPage() {
  const page = document.querySelector<HTMLElement>('.ant-pagination-item-3');
  expect(page).not.toBeNull();
  page?.click();
  await vi.waitFor(() => expect(currentPage()).toBe('3'));
}

describe('业务标签页缓存', { timeout: 20_000 }, () => {
  it('两个页面在第 3 页相互切换后保留页码和组件，不重新请求列表', async () => {
    const { router, tabbar } = await mountPages();
    await goToThirdPage();
    await router.push('/client-switch');
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('缓存测试创建人'),
    );
    await goToThirdPage();
    await router.push('/config-info');
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('缓存测试配置'),
    );
    expect(currentPage()).toBe('3');
    expect(api.getConfigInfoListApi).toHaveBeenCalledTimes(2);
    await router.push('/client-switch');
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('缓存测试创建人'),
    );
    expect(currentPage()).toBe('3');
    expect(api.getClientSwitchListApi).toHaveBeenCalledTimes(2);
    expect(tabbar.getCachedTabs).toEqual(
      expect.arrayContaining(['menu:1', 'menu:2']),
    );
  });

  it('主动刷新及关闭标签后重新打开，仍能清理页面缓存', async () => {
    const { router, tabbar } = await mountPages();
    await goToThirdPage();
    await tabbar.refresh(router);
    await vi.waitFor(() => expect(currentPage()).toBe('1'));
    expect(api.getConfigInfoListApi).toHaveBeenCalledTimes(3);
    await goToThirdPage();
    await router.push('/client-switch');
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('缓存测试创建人'),
    );
    await tabbar.closeTabByKey('/config-info', router);
    await nextTick();
    expect(tabbar.getCachedTabs).not.toContain('menu:1');
    await router.push('/config-info');
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('缓存测试配置'),
    );
    expect(currentPage()).toBe('1');
    expect(api.getConfigInfoListApi).toHaveBeenCalledTimes(5);
  });
});
