import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AppInfoPage from './index.vue';

const api = vi.hoisted(() => ({
  addAppRecommendationApi: vi.fn(),
  getAppCategoryListApi: vi.fn(),
  getAppInfoDetailsApi: vi.fn(),
  getAppInfoListApi: vi.fn(),
  getPeculiarAppMsgOptionsApi: vi.fn(),
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
  await vi.waitFor(() =>
    expect(document.querySelector<HTMLInputElement>(`#${id}`)?.disabled).toBe(
      false,
    ),
  );
  const selector = document
    .querySelector(`#${id}`)
    ?.closest('.ant-select')
    ?.querySelector('.ant-select-selector');
  if (!selector) throw new Error(`找不到选择框：${id}`);
  selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await nextTick();
  const dropdown = () => {
    const listId = document
      .querySelector(`#${id}`)
      ?.getAttribute('aria-controls');
    return listId
      ? document
          .querySelector(`[id="${listId}"]`)
          ?.closest('.ant-select-dropdown')
      : undefined;
  };
  await vi.waitFor(() =>
    expect(
      dropdown()?.querySelector(`.ant-select-item-option[title="${label}"]`),
    ).toBeTruthy(),
  );
  dropdown()
    ?.querySelector<HTMLElement>(`.ant-select-item-option[title="${label}"]`)
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
      document.querySelector('#app-edit_peculiarPopId')?.closest('.ant-select')
        ?.textContent,
    ).toContain('无（不设置特殊弹窗）'),
  );
  await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
}
function recommendationOption(field: string, value: number) {
  return document.querySelector<HTMLInputElement>(
    `[data-recommendation-field="${field}"] input[value="${value}"]`,
  );
}

async function chooseRecommendation(field: string, value: number) {
  await vi.waitFor(() =>
    expect(recommendationOption(field, value)?.disabled).toBe(false),
  );
  recommendationOption(field, value)?.click();
  await nextTick();
}

async function recommend(ready = true) {
  await vi.waitFor(() => expect(button('推荐').disabled).toBe(false));
  button('推荐').click();
  await vi.waitFor(() =>
    expect(
      document.querySelector('[data-recommendation-field="column"]'),
    ).not.toBeNull(),
  );
  if (!ready) return;
  await vi.waitFor(() => expect(button('确认推荐').disabled).toBe(false));
}

async function clickSort(label: string) {
  const header = [...document.querySelectorAll('th')].find(
    (item) =>
      item.querySelector('.ant-table-column-title')?.textContent === label,
  );
  if (!header) throw new Error(`找不到排序列：${label}`);
  header.click();
  await nextTick();
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
  api.getPeculiarAppMsgOptionsApi.mockResolvedValue([
    { id: 2, title: '安装按钮弹网页', status: 1 },
    { id: 3, title: '停用提示', status: 0 },
    { id: 4, title: 'Store安装弹窗', status: 1 },
  ]);
  api.updateAppInfoApi.mockResolvedValue(null);
  api.addAppRecommendationApi.mockResolvedValue(null);
});

afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('应用管理页面', { timeout: 20_000 }, () => {
  it('编辑后记录移出筛选结果时自动回退有效末页，保留筛选与排序', async () => {
    let updated = false;
    api.getAppInfoListApi.mockImplementation(async ({ page, pageSize }) => ({
      current: page,
      size: pageSize,
      total: updated ? 40 : 41,
      pages: updated ? 2 : 3,
      records: updated && page === 3 ? [] : [record],
    }));
    api.updateAppInfoApi.mockImplementation(async () => {
      updated = true;
      return null;
    });
    await mountPage();
    await select('app-filters_sort1', '软件');
    button('查询').click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort1: '1', page: 1 }),
      ),
    );
    await clickSort('下载统计');
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'downloadCount', order: 'asc' }),
      ),
    );
    document.querySelector<HTMLElement>('.ant-pagination-item-3')?.click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 3 }),
      ),
    );
    await vi.waitFor(() =>
      expect(
        document
          .querySelector('.ant-pagination-item-active')
          ?.getAttribute('title'),
      ).toBe('3'),
    );
    await vi.waitFor(() => expect(button('编辑').disabled).toBe(false));
    await edit();
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 2,
          sort1: '1',
          sort: 'downloadCount',
          order: 'asc',
        }),
      ),
    );
    await vi.waitFor(() =>
      expect(
        document
          .querySelector('.ant-pagination-item-active')
          ?.getAttribute('title'),
      ).toBe('2'),
    );
  });
  it('推荐使用当前应用id与普通版本，接受null成功结果，防止重复提交并保留列表排序分页', async () => {
    await mountPage();
    await clickSort('下载统计');
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'downloadCount', order: 'asc' }),
      ),
    );
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    );
    const calls = api.getAppInfoListApi.mock.calls.length;
    await recommend();
    button('确认推荐').click();
    button('确认推荐').click();
    await vi.waitFor(() =>
      expect(api.addAppRecommendationApi).toHaveBeenCalledExactlyOnceWith({
        id: record.id,
        column: 1,
        platform: 101,
        sort: 1,
        type: 0,
        iosVersion: -1,
      }),
    );
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenCalledTimes(calls + 1),
    );
    expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, sort: 'downloadCount', order: 'asc' }),
    );
  });
  it('推荐自动识别游戏，按钮组选择14.5版本、iPad和应用/游戏推荐，失败保留选择供重试', async () => {
    api.getAppInfoListApi.mockResolvedValueOnce({
      current: 1,
      size: 20,
      total: 1,
      pages: 1,
      records: [{ ...record, sort: 2, platform: 102 }],
    });
    api.addAppRecommendationApi.mockRejectedValueOnce(new Error('推荐失败'));
    await mountPage();
    await recommend();
    await chooseRecommendation('iosVersion', 1);
    await chooseRecommendation('column', 3);
    expect(document.querySelector('.ant-modal-body')?.textContent).toContain(
      '应用类型：游戏',
    );
    button('确认推荐').click();
    const data = {
      id: record.id,
      column: 3,
      platform: 102,
      sort: 2,
      type: 0,
      iosVersion: 1,
    };
    await vi.waitFor(() =>
      expect(api.addAppRecommendationApi).toHaveBeenCalledWith(data),
    );
    await vi.waitFor(() => expect(button('确认推荐').disabled).toBe(false));
    expect(recommendationOption('column', 3)?.checked).toBe(true);
    expect(recommendationOption('iosVersion', 1)?.checked).toBe(true);
    expect(recommendationOption('platform', 102)?.checked).toBe(true);
    button('确认推荐').click();
    await vi.waitFor(() =>
      expect(api.addAppRecommendationApi).toHaveBeenCalledTimes(2),
    );
    expect(api.addAppRecommendationApi).toHaveBeenLastCalledWith(data);
  });
  it('推荐自动识别软件，移除分类和类型选择，栏目平铺且平台只提供iPhone和iPad', async () => {
    await mountPage();
    const categoryCalls = api.getAppCategoryListApi.mock.calls.length;
    await recommend();
    expect(api.getAppCategoryListApi).toHaveBeenCalledTimes(categoryCalls);
    expect(api.getAppInfoDetailsApi).not.toHaveBeenCalled();
    expect(document.querySelector('.ant-modal-body .ant-select')).toBeNull();
    expect(document.querySelector('#app-recommendation_type')).toBeNull();
    expect(document.querySelector('#app-recommendation_sort')).toBeNull();
    expect(
      document.querySelectorAll('[data-recommendation-field="column"] input'),
    ).toHaveLength(4);
    expect(
      [
        ...document.querySelectorAll(
          '[data-recommendation-field="column"] label',
        ),
      ].map((option) => ({
        label: option.textContent?.trim(),
        value: Number(option.querySelector('input')?.value),
      })),
    ).toEqual([
      { label: '首页精选', value: 1 },
      { label: '应用/游戏推荐', value: 3 },
      { label: '应用/游戏排行', value: 5 },
      { label: '应用/游戏最新', value: 42 },
    ]);
    expect(
      document.querySelectorAll('[data-recommendation-field="platform"] input'),
    ).toHaveLength(2);
    await chooseRecommendation('platform', 102);
    await chooseRecommendation('column', 42);
    button('确认推荐').click();
    await vi.waitFor(() =>
      expect(api.addAppRecommendationApi).toHaveBeenCalledWith({
        id: record.id,
        column: 42,
        platform: 102,
        sort: 1,
        type: 0,
        iosVersion: -1,
      }),
    );
  });
  it('推荐类型缺失时从详情自动识别，未知平台须选择，校验失败不发请求', async () => {
    api.getAppInfoListApi.mockResolvedValueOnce({
      current: 1,
      size: 20,
      total: 1,
      pages: 1,
      records: [{ ...record, sort: 0, platform: 0 }],
    });
    await mountPage();
    await recommend();
    expect(api.getAppInfoDetailsApi).toHaveBeenCalledExactlyOnceWith(record.id);
    button('确认推荐').click();
    await vi.waitFor(() =>
      expect(
        document.querySelector('.ant-form-item-explain-error')?.textContent,
      ).toContain('请选择'),
    );
    expect(api.addAppRecommendationApi).not.toHaveBeenCalled();
    await chooseRecommendation('platform', 101);
    button('确认推荐').click();
    await vi.waitFor(() =>
      expect(api.addAppRecommendationApi).toHaveBeenCalledWith({
        id: record.id,
        column: 1,
        platform: 101,
        sort: 1,
        type: 0,
        iosVersion: -1,
      }),
    );
  });
  it('推荐类型识别失败时阻止提交，可重新识别后推荐', async () => {
    api.getAppInfoListApi.mockResolvedValueOnce({
      current: 1,
      size: 20,
      total: 1,
      pages: 1,
      records: [{ ...record, sort: 0 }],
    });
    api.getAppInfoDetailsApi.mockRejectedValueOnce(new Error('详情失败'));
    await mountPage();
    await recommend(false);
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('无法识别应用类型'),
    );
    expect(button('确认推荐').disabled).toBe(true);
    expect(api.addAppRecommendationApi).not.toHaveBeenCalled();
    api.getAppInfoDetailsApi.mockResolvedValueOnce({ ...detail, sort: 2 });
    button('重新识别').click();
    await vi.waitFor(() => expect(button('确认推荐').disabled).toBe(false));
    button('确认推荐').click();
    await vi.waitFor(() =>
      expect(api.addAppRecommendationApi).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 2, type: 0 }),
      ),
    );
  });
  it('取消推荐弹窗后重新打开恢复默认值，不沿用上次未提交选择', async () => {
    await mountPage();
    await recommend();
    await chooseRecommendation('iosVersion', 1);
    await chooseRecommendation('column', 5);
    button('取消').click();
    await vi.waitFor(() => expect(button('推荐').disabled).toBe(false));
    await recommend();
    button('确认推荐').click();
    await vi.waitFor(() =>
      expect(api.addAppRecommendationApi).toHaveBeenCalledExactlyOnceWith({
        id: record.id,
        column: 1,
        platform: 101,
        sort: 1,
        type: 0,
        iosVersion: -1,
      }),
    );
  });
  it('推荐取消后重新识别，忽略上次延迟返回的类型', async () => {
    api.getAppInfoListApi.mockResolvedValueOnce({
      current: 1,
      size: 20,
      total: 1,
      pages: 1,
      records: [{ ...record, sort: 0 }],
    });
    let finish: ((value: unknown) => void) | undefined;
    api.getAppInfoDetailsApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await mountPage();
    await recommend(false);
    expect(button('确认推荐').disabled).toBe(true);
    button('取消').click();
    await vi.waitFor(() => expect(button('推荐').disabled).toBe(false));
    api.getAppInfoDetailsApi.mockResolvedValueOnce({ ...detail, sort: 2 });
    await recommend();
    finish?.({ ...detail, sort: 1 });
    await nextTick();
    button('确认推荐').click();
    await vi.waitFor(() =>
      expect(api.addAppRecommendationApi).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 2, type: 0 }),
      ),
    );
  });
  it('价格和下载量使用服务端升降序排序，切换排序回到第一页，分页保留软件类型筛选', async () => {
    await mountPage();
    await select('app-filters_sort1', '软件');
    button('查询').click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort1: '1', page: 1 }),
      ),
    );
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    );
    await clickSort('价格（元）');
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sort: 'appStorePrice',
          order: 'asc',
          sort1: '1',
          page: 1,
        }),
      ),
    );
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sort: 'appStorePrice',
          order: 'asc',
          sort1: '1',
          page: 2,
        }),
      ),
    );
    await clickSort('价格（元）');
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sort: 'appStorePrice',
          order: 'desc',
          page: 1,
        }),
      ),
    );
    await clickSort('下载统计');
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sort: 'downloadCount',
          order: 'asc',
          page: 1,
        }),
      ),
    );
    await clickSort('下载统计');
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sort: 'downloadCount',
          order: 'desc',
          page: 1,
        }),
      ),
    );
    await clickSort('下载统计');
    await vi.waitFor(() => {
      const [query] = api.getAppInfoListApi.mock.lastCall ?? [];
      expect(query).toEqual(expect.objectContaining({ sort1: '1', page: 1 }));
      expect(query).not.toHaveProperty('sort');
      expect(query).not.toHaveProperty('order');
    });
  });

  it('查询和刷新保留当前排序，重置清空排序并同步表头', async () => {
    await mountPage();
    await clickSort('下载统计');
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'downloadCount', order: 'asc' }),
      ),
    );
    await input('app-filters_appName', '安全');
    button('查询').click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({
          appName: '安全',
          sort: 'downloadCount',
          order: 'asc',
        }),
      ),
    );
    const count = api.getAppInfoListApi.mock.calls.length;
    button('刷新').click();
    await vi.waitFor(() =>
      expect(api.getAppInfoListApi).toHaveBeenCalledTimes(count + 1),
    );
    expect(api.getAppInfoListApi).toHaveBeenLastCalledWith(
      expect.objectContaining({
        appName: '安全',
        sort: 'downloadCount',
        order: 'asc',
      }),
    );
    button('重置').click();
    await vi.waitFor(() => {
      const [query] = api.getAppInfoListApi.mock.lastCall ?? [];
      expect(query).toEqual(expect.objectContaining({ appName: '', page: 1 }));
      expect(query).not.toHaveProperty('sort');
      expect(query).not.toHaveProperty('order');
      expect(document.querySelector('th.ant-table-column-sort')).toBeNull();
    });
  });

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
      statusOrShare: -1,
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
    await select('app-filters_statusOrShare', '可在前端显示应用');
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
          statusOrShare: 2,
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
        expect.objectContaining({ page: 2, appName: '宝宝', statusOrShare: 2 }),
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
          statusOrShare: -1,
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

  it('打开编辑后才加载特殊提示，以标题回显原关联，选择后提交数字ID', async () => {
    api.getAppInfoDetailsApi.mockResolvedValueOnce({
      ...detail,
      peculiarPopId: 2,
    });
    await mountPage();
    expect(api.getPeculiarAppMsgOptionsApi).not.toHaveBeenCalled();
    button('编辑').click();
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(api.getPeculiarAppMsgOptionsApi).toHaveBeenCalledTimes(1);
    expect(
      document.querySelector('#app-edit_peculiarPopId')?.closest('.ant-select')
        ?.textContent,
    ).toContain('安装按钮弹网页（ID: 2）');
    await select('app-edit_peculiarPopId', 'Store安装弹窗（ID: 4）');
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateAppInfoApi).toHaveBeenCalledWith({
        ...detail,
        peculiarPopId: 4,
      }),
    );
  });

  it('特殊提示加载失败阻止保存，重试后保留当前关联并恢复选择', async () => {
    api.getPeculiarAppMsgOptionsApi.mockRejectedValueOnce(
      new Error('特殊提示失败'),
    );
    api.getAppInfoDetailsApi.mockResolvedValueOnce({
      ...detail,
      peculiarPopId: 2,
    });
    await mountPage();
    button('编辑').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('特殊应用提示加载失败'),
    );
    expect(button('保存').disabled).toBe(true);
    button('保存').click();
    expect(api.updateAppInfoApi).not.toHaveBeenCalled();
    button('重试特殊提示').click();
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(
      document.querySelector('#app-edit_peculiarPopId')?.closest('.ant-select')
        ?.textContent,
    ).toContain('安装按钮弹网页（ID: 2）');
    expect(api.getPeculiarAppMsgOptionsApi).toHaveBeenCalledTimes(2);
  });

  it('已关联提示未出现在接口列表时保留原ID，不自动改为0', async () => {
    api.getAppInfoDetailsApi.mockResolvedValueOnce({
      ...detail,
      peculiarPopId: 999,
    });
    await mountPage();
    button('编辑').click();
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(
      document.querySelector('#app-edit_peculiarPopId')?.closest('.ant-select')
        ?.textContent,
    ).toContain('特殊应用提示 ID: 999（列表未返回）');
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateAppInfoApi).toHaveBeenCalledWith({
        ...detail,
        peculiarPopId: 999,
      }),
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
