import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AppInfoPage from './index.vue';

const api = vi.hoisted(() => ({
  getAppCategoryListApi: vi.fn(),
  getAppInfoDetailsApi: vi.fn(),
  getAppInfoListApi: vi.fn(),
  updateAppInfoApi: vi.fn(),
}));
vi.mock('#/api', () => api);
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));

const record = {
  id: 286_080,
  appName: '宝宝日常安全',
  sort: 1,
  typeName: '教育',
  platform: 103,
  status: 1,
  appStoreStatus: 1,
  isSharePage: 2,
  isRemd: 1,
  coopModel: 0,
  appPriceFlag: 0,
  appStorePrice: '0.0',
  downloadCount: 0,
};
const detail = {
  id: record.id,
  sort: 1,
  type: 119,
  peculiarPopId: 0,
  remdAppstoreIns: 0,
};
let app: App;

function button(label: string) {
  const result = [...document.querySelectorAll('button')].find(
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
  await vi.waitFor(() =>
    expect(
      document.querySelector(
        `.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${label}"]`,
      ),
    ).not.toBeNull(),
  );
  document
    .querySelector<HTMLElement>(
      `.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${label}"]`,
    )
    ?.click();
  await nextTick();
}

async function input(id: string, value: string) {
  const element = document.querySelector(`#${id}`);
  if (!(element instanceof HTMLInputElement))
    throw new Error(`找不到输入框：${id}`);
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}

async function mountPage() {
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp(AppInfoPage);
  app.mount(container);
  await vi.waitFor(() =>
    expect(document.body.textContent).toContain(record.appName),
  );
}

async function edit() {
  button('编辑').click();
  await vi.waitFor(() =>
    expect(
      document.querySelector<HTMLInputElement>('#app-edit_peculiarPopId')
        ?.value,
    ).toBe('0'),
  );
  await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
}

beforeEach(() => {
  vi.resetAllMocks();
  api.getAppInfoListApi.mockImplementation(async ({ page, pageSize }) => ({
    current: page,
    records: [record],
    size: pageSize,
    pages: 3,
    total: 121,
  }));
  api.getAppCategoryListApi.mockImplementation(async (sort) => [
    { id: -1, name: '全部', sort: null },
    sort === 1
      ? { id: 119, name: '教育', sort }
      : { id: 200, name: '动作', sort },
  ]);
  api.getAppInfoDetailsApi.mockResolvedValue(detail);
  api.updateAppInfoApi.mockResolvedValue(null);
});

afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('应用管理页面', { timeout: 15_000 }, () => {
  it('以文档默认条件加载，展示字段含义并分页', async () => {
    await mountPage();
    expect(api.getAppInfoListApi).toHaveBeenCalledWith({
      appName: '',
      appStoreStatus: '-1',
      coopModel: '-1',
      isFree: '',
      isRemd: '-1',
      isSharePage: '-1',
      page: 1,
      pageSize: 20,
      platForm: '-1',
      searchType: 1,
      sort1: '-1',
      status: '-1',
      statusOrShare: '-1',
      timeEt: '',
      timeSt: '',
      type: '',
    });
    expect(api.getAppCategoryListApi).toHaveBeenCalledWith(1);
    expect(api.getAppCategoryListApi).toHaveBeenCalledWith(2);
    const text = document.querySelector('.ant-table-tbody')?.textContent;
    expect(text).toContain('iPhone & iPad');
    expect(text).toContain('普通包');
    expect(text).toContain('免费');
    expect(text).toContain('是');
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, pageSize: 20 }),
      ),
    );
  });

  it('筛选保留数字 0 的字符串，分页使用已查询的条件，重置清空筛选', async () => {
    await mountPage();
    await select('app-filters_status', '不可用');
    await select('app-filters_coopModel', '默认');
    await select('app-filters_sort1', '软件');
    await select('app-filters_type', '教育');
    await input('app-filters_appName', '  宝宝  ');
    button('查询').click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          status: '0',
          coopModel: '0',
          sort1: '1',
          type: '119',
          appName: '宝宝',
        }),
      ),
    );
    await input('app-filters_appName', '未查询的内容');
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, appName: '宝宝' }),
      ),
    );
    await select('app-filters_sort1', '游戏');
    expect(
      document.querySelector('#app-filters_type')?.closest('.ant-select')
        ?.textContent,
    ).not.toContain('教育');
    button('重置').click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          appName: '',
          sort1: '-1',
          status: '-1',
          type: '',
        }),
      ),
    );
  });

  it('编辑只提交五个允许字段并保留 0，保存失败保留表单供重试', async () => {
    api.updateAppInfoApi.mockRejectedValueOnce(new Error('保存失败'));
    await mountPage();
    await edit();
    expect(api.getAppInfoDetailsApi).toHaveBeenCalledWith(record.id);
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateAppInfoApi).toHaveBeenCalledWith(detail),
    );
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateAppInfoApi).toHaveBeenCalledTimes(2),
    );
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenCalledTimes(2),
    );
  });

  it('价格多选以逗号分隔提交，重置后恢复全部', async () => {
    await mountPage();
    await select('app-prices', '免费');
    await select('app-prices', '限免');
    button('查询').click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFree: '0,2' }),
      ),
    );
    button('重置').click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFree: '' }),
      ),
    );
  });

  it('分类失败阻止编辑保存，重试成功后恢复', async () => {
    api.getAppCategoryListApi.mockRejectedValueOnce(new Error('分类失败'));
    await mountPage();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('部分应用分类加载失败'),
    );
    api.getAppCategoryListApi.mockRejectedValueOnce(new Error('分类失败'));
    button('编辑').click();
    await vi.waitFor(() =>
      expect(document.querySelector('.ant-modal-body')?.textContent).toContain(
        '应用分类加载失败',
      ),
    );
    expect(button('保存').disabled).toBe(true);
    document
      .querySelector<HTMLButtonElement>('.ant-modal-body .ant-alert button')
      ?.click();
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
  });

  it('编辑切换软件类型后必须重新选择匹配的分类', async () => {
    await mountPage();
    await edit();
    await select('app-edit_sort', '游戏');
    button('保存').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('请选择此项'),
    );
    expect(api.updateAppInfoApi).not.toHaveBeenCalled();
    await select('app-edit_type', '动作');
    await select('app-edit_remdAppstoreIns', '禁止');
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateAppInfoApi).toHaveBeenCalledWith({
        ...detail,
        sort: 2,
        type: 200,
        remdAppstoreIns: 2,
      }),
    );
  });

  it('详情失败时禁止保存，重试成功后恢复编辑', async () => {
    api.getAppInfoDetailsApi.mockRejectedValueOnce(new Error('详情失败'));
    await mountPage();
    button('编辑').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('应用详情加载失败'),
    );
    expect(button('保存').disabled).toBe(true);
    button('重试详情').click();
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(api.getAppInfoDetailsApi).toHaveBeenCalledTimes(2);
  });

  it('较早查询晚返回时不会覆盖最新查询', async () => {
    await mountPage();
    let resolveOld!: (value: unknown) => void;
    api.getAppInfoListApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    button('刷新').click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenCalledTimes(2),
    );
    api.getAppInfoListApi.mockResolvedValueOnce({
      current: 1,
      records: [{ ...record, appName: '最新结果' }],
      size: 20,
      pages: 1,
      total: 1,
    });
    button('重置').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('最新结果'),
    );
    resolveOld({
      current: 2,
      records: [{ ...record, appName: '过期结果' }],
      size: 20,
      pages: 3,
      total: 121,
    });
    await nextTick();
    expect(document.body.textContent).not.toContain('过期结果');
    expect(document.body.textContent).toContain('最新结果');
  });
});
