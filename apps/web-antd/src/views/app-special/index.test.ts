import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AppSpecialPage from './index.vue';

const api = vi.hoisted(() => ({
  addAppSpecialAppsApi: vi.fn(),
  getAppSpecialCandidateListApi: vi.fn(),
  getAppSpecialCategoriesApi: vi.fn(),
  getAppSpecialListApi: vi.fn(),
  removeAppSpecialAppsApi: vi.fn(),
  updateAppSpecialOrderApi: vi.fn(),
}));
vi.mock('#/api', () => api);
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
vi.mock('#/composables/use-menu-title', () => ({
  useMenuTitle: () => '接口一级专题标题',
}));
const record = {
  id: 2818,
  appId: 283_472,
  appName: '专题测试应用',
  menuId: 302,
  orderNum: 0,
  sort: 1,
  status: 0,
  appStorePrice: 0,
  appStoreStatus: 0,
  appPriceFlag: 0,
};
const second = {
  ...record,
  id: 2816,
  appId: 280_649,
  appName: '第二专题应用',
  orderNum: 2,
};
const candidate = {
  id: 9001,
  appId: 165_776,
  appName: '待添加应用',
  typeName: '社交',
  type: '103',
  channelId: 0,
  sort: 1,
  downloadCount: 0,
  downloadBase: 0,
  appStorePrice: 0,
  appStoreStatus: 1,
  appPriceFlag: 0,
  status: 1,
  isAdded: 0,
};
const otherCandidate = {
  ...candidate,
  id: 9002,
  appId: 151_375,
  appName: '第二待添加应用',
};
const addedCandidate = {
  ...candidate,
  id: 9003,
  appId: 123_456,
  appName: '已经添加的应用',
  isAdded: 1,
};
const candidateDefaults = {
  page: 1,
  pageSize: 20,
  type: -1,
  searchKeyType: '',
  searchKeyText: '',
  isFree: '-1',
};
let app: App;
function button(label: string, root: ParentNode = document) {
  const found = [...root.querySelectorAll('button')].find(
    (item) => item.textContent?.replaceAll(/\s/g, '') === label,
  );
  if (!found) throw new Error(`找不到按钮：${label}`);
  return found;
}
function modal() {
  const root = document.querySelector(
    '.ant-modal:not([style*="display: none"]) .ant-modal-content',
  );
  if (!root) throw new Error('弹窗未打开');
  return root;
}
async function mountPage() {
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp(AppSpecialPage);
  app.mount(container);
  await vi.waitFor(() =>
    expect(
      document.querySelector('main .ant-table-tbody')?.textContent,
    ).toContain(record.appName),
  );
  await vi.waitFor(() => expect(button('修改排序').disabled).toBe(false));
}
function candidates() {
  const root = document.querySelector('section[aria-label="可添加应用"]');
  if (!root) throw new Error('可添加应用面板未显示');
  return root;
}
async function waitCandidates() {
  await vi.waitFor(() =>
    expect(candidates().textContent).toContain(candidate.appName),
  );
  await vi.waitFor(() =>
    expect(button('添加', candidates()).disabled).toBe(false),
  );
}
async function input(id: string, value: string) {
  const field = document.querySelector<HTMLInputElement>(`#${id}`);
  if (!field) throw new Error(`找不到字段：${id}`);
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}
async function select(id: string, label: string) {
  const field = document.querySelector<HTMLInputElement>(`#${id}`);
  await vi.waitFor(() => expect(field?.disabled).toBe(false));
  const selector = field
    ?.closest('.ant-select')
    ?.querySelector('.ant-select-selector');
  if (!selector) throw new Error(`找不到选择框：${id}`);
  selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await nextTick();
  const dropdown = document
    .querySelector(`[id="${field?.getAttribute('aria-controls')}"]`)
    ?.closest('.ant-select-dropdown');
  if (!dropdown) throw new Error(`找不到下拉列表：${id}`);
  const query = `.ant-select-item-option[title="${label}"]`;
  await vi.waitFor(() => expect(dropdown.querySelector(query)).not.toBeNull());
  dropdown.querySelector<HTMLElement>(query)?.click();
  await nextTick();
}
async function checkRow(id: number, root: ParentNode = document) {
  const checkbox = root.querySelector<HTMLInputElement>(
    `tr[data-row-key="${id}"] input[type="checkbox"]`,
  );
  if (!checkbox) throw new Error(`找不到行：${id}`);
  checkbox.click();
  await nextTick();
}
async function clickCandidateSort(label: string) {
  const header = [...candidates().querySelectorAll('th')].find(
    (item) =>
      item.querySelector('.ant-table-column-title')?.textContent === label,
  );
  if (!header) throw new Error(`找不到候选排序列：${label}`);
  header.click();
  await nextTick();
}
beforeEach(() => {
  vi.resetAllMocks();
  api.getAppSpecialListApi.mockImplementation(async ({ page, pageSize }) => ({
    records: [record, second],
    current: page,
    size: pageSize,
    total: 22,
    pages: 2,
  }));
  api.getAppSpecialCandidateListApi.mockImplementation(
    async ({ page, pageSize }) => ({
      records: [candidate, otherCandidate, addedCandidate],
      current: page,
      size: pageSize,
      total: 23,
      pages: 2,
    }),
  );
  api.getAppSpecialCategoriesApi.mockResolvedValue([
    { id: -1, name: '全部' },
    { id: 103, name: '社交' },
  ]);
  api.addAppSpecialAppsApi.mockResolvedValue(null);
  api.removeAppSpecialAppsApi.mockResolvedValue(null);
  api.updateAppSpecialOrderApi.mockResolvedValue(null);
});
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('一级专题', { timeout: 20_000 }, () => {
  it.each([
    { label: '应用 ID', sort: 'appId' },
    { label: '应用主表 ID', sort: 'mainId' },
    { label: '分类', sort: 'category' },
    { label: '渠道 ID', sort: 'channelId' },
    { label: '下载统计', sort: 'downloadCount' },
    { label: '价格（元）', sort: 'price' },
  ])(
    '候选$label列传sort=$sort，升降序及取消均使用服务端排序',
    async ({ label, sort }) => {
      await mountPage();
      await waitCandidates();
      candidates()
        .querySelector<HTMLElement>('.ant-pagination-item-2')
        ?.click();
      await vi.waitFor(() =>
        expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
          {
            ...candidateDefaults,
            page: 2,
          },
          expect.any(AbortSignal),
        ),
      );
      await vi.waitFor(() =>
        expect(button('添加', candidates()).disabled).toBe(false),
      );
      await checkRow(candidate.appId, candidates());
      await clickCandidateSort(label);
      await vi.waitFor(() =>
        expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
          {
            ...candidateDefaults,
            sort,
            order: 'asc',
          },
          expect.any(AbortSignal),
        ),
      );
      expect(button('添加选中（0）', candidates()).disabled).toBe(true);
      await clickCandidateSort(label);
      await vi.waitFor(() =>
        expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
          {
            ...candidateDefaults,
            sort,
            order: 'desc',
          },
          expect.any(AbortSignal),
        ),
      );
      await clickCandidateSort(label);
      await vi.waitFor(() =>
        expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
          candidateDefaults,
          expect.any(AbortSignal),
        ),
      );
      expect(api.getAppSpecialListApi).toHaveBeenCalledTimes(1);
    },
  );

  it('候选排序沿用已提交筛选，分页、刷新与添加后保留，重置恢复默认排序及表头', async () => {
    await mountPage();
    await waitCandidates();
    await select('app-special-filters_searchKeyType', '应用名称');
    await input('app-special-filters_searchKeyText', '应用');
    button('查询').click();
    const query = {
      ...candidateDefaults,
      searchKeyType: '1',
      searchKeyText: '应用',
    };
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
        query,
        expect.any(AbortSignal),
      ),
    );
    await clickCandidateSort('价格（元）');
    const sortedQuery = { ...query, sort: 'price', order: 'asc' };
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
        sortedQuery,
        expect.any(AbortSignal),
      ),
    );
    await vi.waitFor(() =>
      expect(button('添加', candidates()).disabled).toBe(false),
    );
    await input('app-special-filters_searchKeyText', '未查询');
    candidates().querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    const pagedQuery = { ...sortedQuery, page: 2 };
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
        pagedQuery,
        expect.any(AbortSignal),
      ),
    );
    await vi.waitFor(() =>
      expect(button('添加', candidates()).disabled).toBe(false),
    );
    const count = api.getAppSpecialCandidateListApi.mock.calls.length;
    button('刷新候选').click();
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenCalledTimes(
        count + 1,
      ),
    );
    expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
      pagedQuery,
      expect.any(AbortSignal),
    );
    await vi.waitFor(() =>
      expect(button('添加', candidates()).disabled).toBe(false),
    );
    button('添加', candidates()).click();
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenCalledTimes(
        count + 2,
      ),
    );
    expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
      pagedQuery,
      expect.any(AbortSignal),
    );
    await vi.waitFor(() =>
      expect(button('添加', candidates()).disabled).toBe(false),
    );
    button('重置').click();
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
        candidateDefaults,
        expect.any(AbortSignal),
      ),
    );
    expect(candidates().querySelector('th.ant-table-column-sort')).toBeNull();
  });
  it('默认20条，区分专题id和应用id，保留0价格和未排序状态，分页清空选择', async () => {
    await mountPage();
    expect(api.getAppSpecialListApi).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    });
    const body = document.querySelector('main .ant-table-tbody');
    expect(body?.textContent).toContain('2818');
    expect(body?.textContent).toContain('283472');
    expect(body?.textContent).toContain('0（未排序）');
    expect(body?.textContent).toContain('无效');
    expect(body?.textContent).toContain('免费');
    await checkRow(record.id);
    expect(button('移除选中（1）').disabled).toBe(false);
    document.querySelector<HTMLElement>('main .ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getAppSpecialListApi).toHaveBeenLastCalledWith({
        page: 2,
        pageSize: 20,
      }),
    );
    expect(button('移除选中（0）').disabled).toBe(true);
  });
  it('批量移除需确认且使用专题id，末页清空后回退', async () => {
    await mountPage();
    document.querySelector<HTMLElement>('main .ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getAppSpecialListApi).toHaveBeenCalledTimes(2),
    );
    await vi.waitFor(() => expect(button('修改排序').disabled).toBe(false));
    await checkRow(record.id);
    await checkRow(second.id);
    button('移除选中（2）').click();
    const query = '.ant-popover:not(.ant-popover-hidden)';
    await vi.waitFor(() =>
      expect(document.querySelector(query)).not.toBeNull(),
    );
    expect(api.removeAppSpecialAppsApi).not.toHaveBeenCalled();
    api.getAppSpecialListApi.mockResolvedValueOnce({
      records: [],
      current: 2,
      size: 20,
      total: 20,
      pages: 1,
    });
    const prompt = document.querySelector(query);
    if (!prompt) throw new Error('确认框未打开');
    button('移除', prompt).click();
    await vi.waitFor(() =>
      expect(api.removeAppSpecialAppsApi).toHaveBeenCalledWith([2818, 2816]),
    );
    await vi.waitFor(() =>
      expect(api.getAppSpecialListApi).toHaveBeenCalledTimes(4),
    );
    expect(api.getAppSpecialListApi).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
    });
  });
  it('排序校验非负整数，缺少排序值时不提交', async () => {
    await mountPage();
    button('修改排序').click();
    await vi.waitFor(() =>
      expect(document.querySelector('#app-special-order_order')).not.toBeNull(),
    );
    await input('app-special-order_order', '');
    button('保存', modal()).click();
    await vi.waitFor(() =>
      expect(modal().textContent).toContain('请输入有效的非负整数排序号'),
    );
    expect(api.updateAppSpecialOrderApi).not.toHaveBeenCalled();
  });
  it('排序保存0传专题id，失败保留输入并支持重试及防止重复提交', async () => {
    api.updateAppSpecialOrderApi.mockRejectedValueOnce(new Error('排序失败'));
    await mountPage();
    button('修改排序').click();
    await vi.waitFor(() =>
      expect(document.querySelector('#app-special-order_order')).not.toBeNull(),
    );
    await input('app-special-order_order', '0');
    button('保存', modal()).click();
    await vi.waitFor(() =>
      expect(api.updateAppSpecialOrderApi).toHaveBeenCalledWith({
        id: 2818,
        order: 0,
      }),
    );
    await vi.waitFor(() =>
      expect(button('保存', modal()).disabled).toBe(false),
    );
    expect(
      document.querySelector<HTMLInputElement>('#app-special-order_order')
        ?.value,
    ).toBe('0');
    button('保存', modal()).click();
    button('保存', modal()).click();
    await vi.waitFor(() =>
      expect(api.updateAppSpecialOrderApi).toHaveBeenCalledTimes(2),
    );
    await vi.waitFor(() =>
      expect(api.getAppSpecialListApi).toHaveBeenCalledTimes(2),
    );
  });
  it('候选分类使用专用sort0接口，筛选保留类型与字符串价格0，分页沿用已提交条件，重置清空', async () => {
    await mountPage();
    await waitCandidates();
    expect(api.getAppSpecialCategoriesApi).toHaveBeenCalledTimes(1);
    expect(api.getAppSpecialCandidateListApi).toHaveBeenCalledWith(
      candidateDefaults,
      expect.any(AbortSignal),
    );
    expect(candidates().textContent).toContain('0(0)');
    await select('app-special-filters_type', '社交');
    await select('app-special-filters_searchKeyType', '应用 ID');
    await select('app-special-filters_prices', '免费');
    await input('app-special-filters_searchKeyText', ' 165776 ');
    button('查询').click();
    const query = {
      ...candidateDefaults,
      type: 103,
      searchKeyType: '2',
      searchKeyText: '165776',
      isFree: '0',
    };
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
        query,
        expect.any(AbortSignal),
      ),
    );
    await vi.waitFor(() =>
      expect(button('添加', candidates()).disabled).toBe(false),
    );
    await input('app-special-filters_searchKeyText', '未提交');
    candidates().querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
        {
          ...query,
          page: 2,
        },
        expect.any(AbortSignal),
      ),
    );
    button('重置').click();
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
        candidateDefaults,
        expect.any(AbortSignal),
      ),
    );
  });
  it('批量添加用appId，不允许重复选择已添加应用，失败保留选择，成功刷新两份列表', async () => {
    api.addAppSpecialAppsApi.mockRejectedValueOnce(new Error('添加失败'));
    await mountPage();
    await waitCandidates();
    const disabled = candidates().querySelector<HTMLInputElement>(
      `tr[data-row-key="${addedCandidate.appId}"] input[type="checkbox"]`,
    );
    expect(disabled?.disabled).toBe(true);
    await checkRow(candidate.appId, candidates());
    await checkRow(otherCandidate.appId, candidates());
    button('添加选中（2）', candidates()).click();
    await vi.waitFor(() =>
      expect(api.addAppSpecialAppsApi).toHaveBeenCalledWith([165_776, 151_375]),
    );
    await vi.waitFor(() =>
      expect(button('添加选中（2）', candidates()).disabled).toBe(false),
    );
    button('添加选中（2）', candidates()).click();
    button('添加选中（2）', candidates()).click();
    await vi.waitFor(() =>
      expect(api.addAppSpecialAppsApi).toHaveBeenCalledTimes(2),
    );
    await vi.waitFor(() =>
      expect(api.getAppSpecialListApi).toHaveBeenCalledTimes(2),
    );
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenCalledTimes(2),
    );
    expect(button('添加选中（0）', candidates()).disabled).toBe(true);
  });
  it('候选分页清空选择；列表或分类失败可独立重试，候选失败时禁止写入', async () => {
    api.getAppSpecialCategoriesApi.mockRejectedValueOnce(new Error('分类失败'));
    await mountPage();
    await waitCandidates();
    await checkRow(candidate.appId, candidates());
    candidates().querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenCalledTimes(2),
    );
    expect(button('添加选中（0）', candidates()).disabled).toBe(true);
    expect(document.body.textContent).toContain('应用分类加载失败');
    button('重试分类').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).not.toContain('应用分类加载失败'),
    );
    api.getAppSpecialCandidateListApi.mockRejectedValueOnce(
      new Error('候选失败'),
    );
    button('查询').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('可添加应用加载失败'),
    );
    expect(button('添加', candidates()).disabled).toBe(true);
    button('重试列表').click();
    await vi.waitFor(() =>
      expect(button('添加', candidates()).disabled).toBe(false),
    );
    button('添加', candidates()).click();
    await vi.waitFor(() =>
      expect(api.addAppSpecialAppsApi).toHaveBeenCalledWith([candidate.appId]),
    );
  });
  it('主列表失败时禁止移除与排序，刷新后恢复', async () => {
    await mountPage();
    api.getAppSpecialListApi.mockRejectedValueOnce(new Error('列表失败'));
    button('刷新').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('专题应用加载失败'),
    );
    expect(button('修改排序').disabled).toBe(true);
    expect(button('移除').disabled).toBe(true);
    button('刷新').click();
    await vi.waitFor(() => expect(button('修改排序').disabled).toBe(false));
  });
  it('右侧添加期间禁止左侧写入，完成后同步刷新且无需弹窗', async () => {
    let finish: (() => void) | undefined;
    api.addAppSpecialAppsApi.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await mountPage();
    await waitCandidates();
    button('添加', candidates()).click();
    await vi.waitFor(() => expect(button('修改排序').disabled).toBe(true));
    expect(button('移除').disabled).toBe(true);
    expect(document.querySelector('.ant-modal-content')).toBeNull();
    finish?.();
    await vi.waitFor(() =>
      expect(api.getAppSpecialListApi).toHaveBeenCalledTimes(2),
    );
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenCalledTimes(2),
    );
    await vi.waitFor(() => expect(button('修改排序').disabled).toBe(false));
  });
  it('左侧移除后右侧沿用已提交筛选和页码刷新，恢复可添加状态', async () => {
    await mountPage();
    await waitCandidates();
    await select('app-special-filters_searchKeyType', '应用名称');
    await input('app-special-filters_searchKeyText', '已添加');
    button('查询').click();
    const applied = {
      ...candidateDefaults,
      searchKeyType: '1',
      searchKeyText: '已添加',
    };
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
        applied,
        expect.any(AbortSignal),
      ),
    );
    await vi.waitFor(() =>
      expect(button('添加', candidates()).disabled).toBe(false),
    );
    await clickCandidateSort('渠道 ID');
    const sortedQuery = { ...applied, sort: 'channelId', order: 'asc' };
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
        sortedQuery,
        expect.any(AbortSignal),
      ),
    );
    await vi.waitFor(() =>
      expect(button('添加', candidates()).disabled).toBe(false),
    );
    candidates().querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
        {
          ...sortedQuery,
          page: 2,
        },
        expect.any(AbortSignal),
      ),
    );
    await vi.waitFor(() =>
      expect(button('添加', candidates()).disabled).toBe(false),
    );
    await input('app-special-filters_searchKeyText', '尚未查询');
    api.getAppSpecialCandidateListApi.mockResolvedValueOnce({
      records: [{ ...addedCandidate, isAdded: 0 }],
      current: 2,
      size: 20,
      total: 23,
      pages: 2,
    });
    button('移除').click();
    const query = '.ant-popover:not(.ant-popover-hidden)';
    await vi.waitFor(() =>
      expect(document.querySelector(query)).not.toBeNull(),
    );
    const prompt = document.querySelector(query);
    if (!prompt) throw new Error('确认框未打开');
    const candidateCalls = api.getAppSpecialCandidateListApi.mock.calls.length;
    button('移除', prompt).click();
    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenCalledTimes(
        candidateCalls + 1,
      ),
    );

    await vi.waitFor(() =>
      expect(api.getAppSpecialCandidateListApi).toHaveBeenLastCalledWith(
        {
          ...sortedQuery,
          page: 2,
        },
        expect.any(AbortSignal),
      ),
    );
    await vi.waitFor(() =>
      expect(button('添加', candidates()).disabled).toBe(false),
    );
    expect(
      candidates().querySelector<HTMLInputElement>(
        `tr[data-row-key="${addedCandidate.appId}"] input[type="checkbox"]`,
      )?.disabled,
    ).toBe(false);
  });
});
