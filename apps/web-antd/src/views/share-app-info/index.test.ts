import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ShareAppInfoPage from './index.vue';

const api = vi.hoisted(() => ({
  getAppCategoryListApi: vi.fn(),
  getShareAppInfoListApi: vi.fn(),
  updateShareAppInfoVisibilityApi: vi.fn(),
}));
vi.mock('#/api', () => api);
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));

const record = {
  id: 94_320,
  appId: 282_352,
  itemId: '1590032260',
  sourceId: 'com.test.kapi.camera',
  appName: 'Kapi相机',
  sort: 1,
  platform: 103,
  typeName: '摄像',
  status: 1,
  downloadCount: 0,
  downloadBase: 0,
  orderNum: 0,
  version: '4.46.0',
  path: '/ipa/test.ipa',
  plist: '/config/test.plist',
};
let app: App;

function button(label: string, root: ParentNode = document) {
  const result = [...root.querySelectorAll('button')].find(
    (element) => element.textContent?.replaceAll(/\s/g, '') === label,
  );
  if (!result) throw new Error(`找不到按钮：${label}`);
  return result;
}

async function select(id: string, label: string) {
  const selector = document
    .querySelector(`#${id}`)
    ?.closest('.ant-select')
    ?.querySelector('.ant-select-selector');
  if (!selector) throw new Error(`找不到选择框：${id}`);
  selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await nextTick();
  const query = `.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${label}"]`;
  await vi.waitFor(() => expect(document.querySelector(query)).not.toBeNull());
  document.querySelector<HTMLElement>(query)?.click();
  await nextTick();
}

async function input(value: string) {
  const element = document.querySelector<HTMLInputElement>(
    '#share-filters_appName',
  );
  if (!element) throw new Error('搜索输入框不存在');
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}

async function mountPage() {
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp(ShareAppInfoPage);
  app.mount(container);
  await vi.waitFor(() =>
    expect(document.body.textContent).toContain(record.appName),
  );
}

async function prompt(label: string) {
  button(label).click();
  const query = '.ant-popover:not(.ant-popover-hidden)';
  await vi.waitFor(() => expect(document.querySelector(query)).not.toBeNull());
  const result = document.querySelector(query);
  if (!result) throw new Error('确认框不存在');
  return result;
}

beforeEach(() => {
  vi.resetAllMocks();
  api.getShareAppInfoListApi.mockImplementation(async ({ page, pageSize }) => ({
    current: page,
    pages: Math.ceil(21 / pageSize),
    records: [record],
    size: pageSize,
    total: 21,
  }));
  api.getAppCategoryListApi.mockImplementation(async (sort) => [
    { id: -1, name: '全部', sort: null },
    sort === 1
      ? { id: 109, name: '摄像', sort }
      : { id: 200, name: '动作', sort },
  ]);
  api.updateShareAppInfoVisibilityApi.mockResolvedValue(null);
});

afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('分享包管理', { timeout: 15_000 }, () => {
  it('默认每页20条，展示分享包ID、应用ID、iTunes ID与包ID并分页', async () => {
    await mountPage();
    expect(api.getShareAppInfoListApi).toHaveBeenCalledWith({
      sort: -1,
      type: -1,
      platform: -1,
      status: -1,
      appName: '',
      searchType: 1,
      page: 1,
      pageSize: 20,
    });
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      '94320',
    );
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      '282352',
    );
    expect(document.querySelector('.ant-table-thead')?.textContent).toContain(
      'iTunes ID',
    );
    expect(document.querySelector('.ant-table-thead')?.textContent).toContain(
      '包 ID',
    );
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      record.itemId,
    );
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      record.sourceId,
    );
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      'iPhone & iPad',
    );
    expect(
      [...document.querySelectorAll('.ant-table-tbody a')].map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual([
      'https://d-app6.i4.cn/soft/ipa/test.ipa',
      'https://dl.i4.cn/sslplist/config/test.plist',
    ]);
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getShareAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, pageSize: 20 }),
      ),
    );
  });

  it('筛选以数字提交，分类联动，分页保留查询条件，重置回到第一页', async () => {
    await mountPage();
    await select('share-filters_sort', '软件');
    await select('share-filters_type', '摄像');
    await select('share-filters_platform', 'iPhone & iPad');
    await select('share-filters_status', '无效');
    await select('share-filters_searchType', '应用 ID（AppId）');
    await input(' 282352 ');
    button('查询').click();
    await vi.waitFor(() =>
      expect(api.getShareAppInfoListApi).toHaveBeenLastCalledWith({
        sort: 1,
        type: 109,
        platform: 103,
        status: 0,
        searchType: 2,
        appName: '282352',
        page: 1,
        pageSize: 20,
      }),
    );
    await input('未查询内容');
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getShareAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, appName: '282352' }),
      ),
    );
    await select('share-filters_sort', '游戏');
    expect(
      document.querySelector('#share-filters_type')?.closest('.ant-select')
        ?.textContent,
    ).not.toContain('摄像');
    button('查询').click();
    await vi.waitFor(() =>
      expect(api.getShareAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, sort: 2, type: -1 }),
      ),
    );
    button('重置').click();
    await vi.waitFor(() =>
      expect(api.getShareAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          sort: -1,
          type: -1,
          status: -1,
          appName: '',
        }),
      ),
    );
  });

  it('取消不修改，确认隐藏提交分享包主键及操作类型 1，空页返回上一页', async () => {
    await mountPage();
    const cancelled = await prompt('隐藏');
    expect(api.updateShareAppInfoVisibilityApi).not.toHaveBeenCalled();
    button('取消', cancelled).click();
    await nextTick();
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getShareAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    );
    api.getShareAppInfoListApi.mockImplementation(
      async ({ page, pageSize }) => ({
        current: page,
        pages: 1,
        records: page === 2 ? [] : [{ ...record, id: 94_321 }],
        size: pageSize,
        total: 20,
      }),
    );
    const confirmed = await prompt('隐藏');
    button('隐藏', confirmed).click();
    await vi.waitFor(() =>
      expect(api.updateShareAppInfoVisibilityApi).toHaveBeenCalledWith({
        id: 94_320,
        type: 1,
      }),
    );
    await vi.waitFor(() =>
      expect(api.getShareAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1 }),
      ),
    );
    expect(api.updateShareAppInfoVisibilityApi).toHaveBeenCalledTimes(1);
  });

  it.each([0, -2])('状态 %s 的分享包显示时提交操作类型 3', async (status) => {
    api.getShareAppInfoListApi.mockResolvedValue({
      current: 1,
      pages: 1,
      records: [{ ...record, status }],
      size: 20,
      total: 1,
    });
    await mountPage();
    const confirmation = await prompt('显示');
    button('显示', confirmation).click();
    await vi.waitFor(() =>
      expect(api.updateShareAppInfoVisibilityApi).toHaveBeenCalledWith({
        id: 94_320,
        type: 3,
      }),
    );
  });

  it('修改失败保留列表，允许重新操作', async () => {
    api.updateShareAppInfoVisibilityApi.mockRejectedValueOnce(
      new Error('修改失败'),
    );
    await mountPage();
    const confirmation = await prompt('隐藏');
    button('隐藏', confirmation).click();
    await vi.waitFor(() =>
      expect(api.updateShareAppInfoVisibilityApi).toHaveBeenCalledTimes(1),
    );
    await vi.waitFor(() => expect(button('隐藏').disabled).toBe(false));
    expect(api.getShareAppInfoListApi).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      record.appName,
    );
  });

  it('分类失败支持重试，列表请求失败后可以刷新恢复', async () => {
    api.getAppCategoryListApi.mockRejectedValueOnce(new Error('分类失败'));
    await mountPage();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('部分应用分类加载失败'),
    );
    button('重试分类').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).not.toContain('部分应用分类加载失败'),
    );
    api.getShareAppInfoListApi.mockRejectedValueOnce(new Error('列表失败'));
    button('刷新').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('分享包列表加载失败'),
    );
    button('刷新').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).not.toContain('分享包列表加载失败'),
    );
  });
});
