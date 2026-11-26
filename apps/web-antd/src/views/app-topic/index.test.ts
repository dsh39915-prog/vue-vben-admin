import type { App, Component } from 'vue';

import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CandidateAppsPanel from './candidate-apps-panel.vue';
import TopicPage from './index.vue';
import TopicAppsModal from './topic-apps-modal.vue';

const api = vi.hoisted(() => ({
  addAppTopicAppsApi: vi.fn(),
  getAppCategoryListApi: vi.fn(),
  getAppTopicAppsApi: vi.fn(),
  getAppTopicCandidatesApi: vi.fn(),
  getAppTopicListApi: vi.fn(),
  removeAppTopicAppsApi: vi.fn(),
  removeAppTopicsApi: vi.fn(),
  saveAppTopicApi: vi.fn(),
  updateAppTopicAppApi: vi.fn(),
}));
vi.mock('#/api', () => api);
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
vi.mock('#/composables/use-menu-title', () => ({
  useMenuTitle: () => '接口专题菜单',
}));
const topic = {
  id: 25,
  name: '测试专题',
  title: '专题标题',
  remd: 3,
  site: 0,
  platform: 103,
  isShowName: 1,
  onLineTime: '2026-11-25',
  offLineTime: '2028-12-31',
  status: 0,
  appIdStr: '445,446',
  appName: '前五个应用',
  createTime: '2026-01-01 00:00:00',
  updateTime: '2026-11-25 00:00:00',
};
const secondTopic = { ...topic, id: 38, name: '第二专题' };
const member = { id: 5941, sid: 25, appId: 445, appName: '关联应用', remd: 0 };
const secondMember = {
  ...member,
  id: 5942,
  appId: 446,
  appName: '第二关联应用',
  remd: 2,
};
const candidate = {
  id: 9101,
  appId: 445,
  appName: '候选应用',
  sort: 1,
  type: '107',
  typeName: '工具',
  channelId: 0,
  downloadCount: 0,
  downloadBase: 0,
  appPriceFlag: 0,
  appStorePrice: 0,
  appStoreStatus: 1,
  status: 1,
  isAdded: 0,
  version: '1.2.3',
};
const added = {
  ...candidate,
  id: 9102,
  appId: 446,
  appName: '已添加应用',
  isAdded: 1,
};
const other = { ...candidate, id: 9103, appId: 447, appName: '另一候选应用' };
const defaults = {
  status: -1,
  isShowName: -1,
  remd: -1,
  platform: -1,
  name: '',
  page: 1,
  pageSize: 20,
};
let app: App;
function container() {
  const root = document.createElement('div');
  document.body.append(root);
  return root;
}
function button(label: string, root: ParentNode = document) {
  const found = [...root.querySelectorAll('button')].find(
    (item) => item.textContent?.replaceAll(/\s/g, '') === label,
  );
  if (!found) throw new Error(`找不到按钮：${label}`);
  return found;
}
function modal(title: string) {
  const found = [...document.querySelectorAll('.ant-modal-content')].find(
    (item) => item.querySelector('.ant-modal-title')?.textContent === title,
  );
  if (!found) throw new Error(`找不到弹窗：${title}`);
  return found;
}
function candidates() {
  const root = document.querySelector('section[aria-label="可添加应用"]');
  if (!root) throw new Error('可添加应用面板未加载');
  return root;
}
function main() {
  const root = document.querySelector('main');
  if (!root) throw new Error('页面未挂载');
  return root;
}
async function mount(
  component: Component = TopicPage,
  props: Record<string, unknown> = {},
) {
  app = createApp(component, props);
  app.mount(container());
  let expected = topic.name;
  if (component === TopicAppsModal) expected = member.appName;
  if (component === CandidateAppsPanel) expected = candidate.appName;
  await vi.waitFor(() =>
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      expected,
    ),
  );
  await nextTick();
}
async function input(id: string, value: string) {
  const field = document.querySelector<HTMLInputElement>(`#${id}`);
  if (!field) throw new Error(`找不到字段：${id}`);
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}
async function date(id: string, value: string) {
  const field = document.querySelector<HTMLInputElement>(`#${id}`);
  if (!field) throw new Error(`找不到日期字段：${id}`);
  field.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  field.focus();
  await nextTick();
  await input(id, value);
  const panel = () =>
    [
      ...document.querySelectorAll(
        '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)',
      ),
    ].at(-1);
  await vi.waitFor(() => expect(panel()).toBeTruthy());
  for (let step = 0; step < 24; step += 1) {
    const cell = panel()?.querySelector<HTMLElement>(
      `td[title="${value}"] .ant-picker-cell-inner`,
    );
    if (cell) {
      cell.click();
      await nextTick();
      return;
    }
    const first =
      panel()
        ?.querySelector('.ant-picker-cell-in-view')
        ?.getAttribute('title') ?? '';
    const direction = value < first ? 'prev' : 'next';
    panel()
      ?.querySelector<HTMLElement>(`.ant-picker-header-${direction}-btn`)
      ?.click();
    await nextTick();
  }
  throw new Error(`找不到日期：${value}`);
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
async function check(id: number, root: ParentNode) {
  const box = root.querySelector<HTMLInputElement>(
    `tr[data-row-key="${id}"] input[type="checkbox"]`,
  );
  if (!box) throw new Error(`找不到行：${id}`);
  box.click();
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
async function confirm(label: string) {
  const query = '.ant-popover:not(.ant-popover-hidden)';
  await vi.waitFor(() => expect(document.querySelector(query)).not.toBeNull());
  const prompt = document.querySelector(query);
  if (!prompt) throw new Error('确认框未打开');
  button(label, prompt).click();
}
beforeEach(() => {
  vi.resetAllMocks();
  api.getAppTopicListApi.mockImplementation(async ({ page, pageSize }) => ({
    records: [topic, secondTopic],
    current: page,
    size: pageSize,
    total: 22,
    pages: 2,
  }));
  api.getAppTopicAppsApi.mockImplementation(async ({ page, pageSize }) => ({
    records: [member, secondMember],
    current: page,
    size: pageSize,
    total: 22,
    pages: 2,
  }));
  api.getAppTopicCandidatesApi.mockImplementation(
    async ({ page, pageSize }) => ({
      records: [candidate, added, other],
      current: page,
      size: pageSize,
      total: 23,
      pages: 2,
    }),
  );
  api.getAppCategoryListApi.mockImplementation(async (sort) => [
    { id: sort === 1 ? 107 : 203, name: sort === 1 ? '工具' : '动作', sort },
  ]);
  api.addAppTopicAppsApi.mockResolvedValue(true);
  api.removeAppTopicAppsApi.mockResolvedValue(true);
  api.removeAppTopicsApi.mockResolvedValue(true);
  api.saveAppTopicApi.mockResolvedValue('success');
  api.updateAppTopicAppApi.mockResolvedValue(true);
});
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('应用列表专题', { timeout: 20_000 }, () => {
  it.each([
    { label: '下载统计', sort1: 'downloadCount' },
    { label: '价格（元）', sort1: 'appStorePrice' },
  ])(
    '候选$label列通过sort1升降序排序，不覆盖应用类型sort，翻页保留且可取消',
    async ({ label, sort1 }) => {
      await mount(CandidateAppsPanel, { open: true, topic });
      await select('app-topic-candidates_sort', '游戏');
      button('查询', candidates()).click();
      const query = {
        sort: '2',
        type: -1,
        platform: 103,
        searchKeyType: 2,
        searchKeyText: '',
        sid: 25,
        page: 1,
        pageSize: 20,
      };
      await vi.waitFor(() =>
        expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith(query),
      );
      await clickCandidateSort(label);
      await vi.waitFor(() =>
        expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith({
          ...query,
          sort1,
          order: 'asc',
        }),
      );
      await vi.waitFor(() =>
        expect(button('添加', candidates()).disabled).toBe(false),
      );
      await check(445, candidates());
      candidates()
        .querySelector<HTMLElement>('.ant-pagination-item-2')
        ?.click();
      await vi.waitFor(() =>
        expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith({
          ...query,
          sort1,
          order: 'asc',
          page: 2,
        }),
      );
      expect(button('添加选中（0）', candidates()).disabled).toBe(true);
      await clickCandidateSort(label);
      await vi.waitFor(() =>
        expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith({
          ...query,
          sort1,
          order: 'desc',
        }),
      );
      await clickCandidateSort(label);
      await vi.waitFor(() =>
        expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith(query),
      );
    },
  );

  it('候选查询、刷新和添加后保留排序，重置清空排序及表头', async () => {
    await mount(CandidateAppsPanel, { open: true, topic });
    await clickCandidateSort('价格（元）');
    await vi.waitFor(() =>
      expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort1: 'appStorePrice', order: 'asc' }),
      ),
    );
    await input('app-topic-candidates_searchKeyText', '应用');
    button('查询', candidates()).click();
    const query = {
      sort: '1',
      sort1: 'appStorePrice',
      order: 'asc',
      type: -1,
      platform: 103,
      searchKeyType: 2,
      searchKeyText: '应用',
      sid: 25,
      page: 1,
      pageSize: 20,
    };
    await vi.waitFor(() =>
      expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith(query),
    );
    await vi.waitFor(() =>
      expect(button('添加', candidates()).disabled).toBe(false),
    );
    await input('app-topic-candidates_searchKeyText', '未查询');
    const count = api.getAppTopicCandidatesApi.mock.calls.length;
    button('刷新候选', candidates()).click();
    await vi.waitFor(() =>
      expect(api.getAppTopicCandidatesApi).toHaveBeenCalledTimes(count + 1),
    );
    expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith(query);
    await vi.waitFor(() =>
      expect(button('添加', candidates()).disabled).toBe(false),
    );
    button('添加', candidates()).click();
    await vi.waitFor(() =>
      expect(api.getAppTopicCandidatesApi).toHaveBeenCalledTimes(count + 2),
    );
    expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith(query);
    await vi.waitFor(() =>
      expect(button('添加', candidates()).disabled).toBe(false),
    );
    button('重置', candidates()).click();
    await vi.waitFor(() =>
      expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith({
        sort: '1',
        type: -1,
        platform: 103,
        searchKeyType: 2,
        searchKeyText: '',
        sid: 25,
        page: 1,
        pageSize: 20,
      }),
    );
    expect(candidates().querySelector('th.ant-table-column-sort')).toBeNull();
  });

  it('候选切换专题及重新打开时清空上一专题的排序', async () => {
    const scope = ref(topic);
    const open = ref(true);
    app = createApp(() =>
      h(CandidateAppsPanel, { open: open.value, topic: scope.value }),
    );
    app.mount(container());
    await vi.waitFor(() =>
      expect(candidates().textContent).toContain(candidate.appName),
    );
    await clickCandidateSort('下载统计');
    await vi.waitFor(() =>
      expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sid: 25,
          sort1: 'downloadCount',
          order: 'asc',
        }),
      ),
    );
    scope.value = secondTopic;
    await vi.waitFor(() => {
      const [query] = api.getAppTopicCandidatesApi.mock.lastCall ?? [];
      expect(query).toEqual(expect.objectContaining({ sid: 38, page: 1 }));
      expect(query).not.toHaveProperty('sort1');
      expect(query).not.toHaveProperty('order');
    });
    await clickCandidateSort('价格（元）');
    await vi.waitFor(() =>
      expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ sid: 38, sort1: 'appStorePrice' }),
      ),
    );
    open.value = false;
    await nextTick();
    open.value = true;
    await vi.waitFor(() => {
      const [query] = api.getAppTopicCandidatesApi.mock.lastCall ?? [];
      expect(query).toEqual(expect.objectContaining({ sid: 38, page: 1 }));
      expect(query).not.toHaveProperty('sort1');
      expect(query).not.toHaveProperty('order');
    });
  });
  it('默认20条，类型3为游戏推荐，数字0和全部字段正常展示', async () => {
    await mount();
    expect(api.getAppTopicListApi).toHaveBeenCalledWith(defaults);
    expect(main().textContent).toContain('游戏推荐');
    expect(main().textContent).toContain('无效');
    expect(main().textContent).toContain('445,446');
    expect(main().textContent).toContain('前五个应用');
    expect(
      [...main().querySelectorAll('td')].some(
        (cell) => cell.textContent === '0',
      ),
    ).toBe(true);
  });
  it('数字0筛选、查询后分页、草稿隔离和重置', async () => {
    await mount();
    await select('app-topic-filters_status', '无效');
    await select('app-topic-filters_isShowName', '不显示');
    await select('app-topic-filters_remd', '游戏推荐');
    await select('app-topic-filters_platform', 'iPadOS');
    await input('app-topic-filters_name', ' 游戏 ');
    button('查询', main()).click();
    const query = {
      ...defaults,
      status: 0,
      isShowName: 2,
      remd: 3,
      platform: 102,
      name: '游戏',
    };
    await vi.waitFor(() =>
      expect(api.getAppTopicListApi).toHaveBeenLastCalledWith(query),
    );
    await vi.waitFor(() => expect(button('编辑', main()).disabled).toBe(false));
    await input('app-topic-filters_name', '未提交');
    main().querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getAppTopicListApi).toHaveBeenLastCalledWith({
        ...query,
        page: 2,
      }),
    );
    button('重置', main()).click();
    await vi.waitFor(() =>
      expect(api.getAppTopicListApi).toHaveBeenLastCalledWith(defaults),
    );
  });
  it('编辑只提交允许字段，保留排序0和日期，失败保留输入', async () => {
    api.saveAppTopicApi.mockRejectedValueOnce(new Error('保存失败'));
    await mount();
    button('编辑', main()).click();
    await vi.waitFor(() =>
      expect(document.querySelector('#app-topic-editor_name')).not.toBeNull(),
    );
    await input('app-topic-editor_name', ' 修改后专题 ');
    button('保存', modal('编辑专题')).click();
    const expected = {
      id: 25,
      name: '修改后专题',
      title: '专题标题',
      remd: 3,
      site: 0,
      platform: 103,
      isShowName: 1,
      onLineTime: '2026-11-25',
      offLineTime: '2028-12-31',
    };
    await vi.waitFor(() =>
      expect(api.saveAppTopicApi).toHaveBeenCalledWith(expected),
    );
    await vi.waitFor(() =>
      expect(button('保存', modal('编辑专题')).disabled).toBe(false),
    );
    expect(
      document.querySelector<HTMLInputElement>('#app-topic-editor_name')?.value,
    ).toBe(' 修改后专题 ');
    button('保存', modal('编辑专题')).click();
    await vi.waitFor(() =>
      expect(api.getAppTopicListApi).toHaveBeenCalledTimes(2),
    );
  });
  it('新增校验日期先后，不传id与状态，支持排序0', async () => {
    await mount();
    button('新增专题', main()).click();
    await vi.waitFor(() =>
      expect(document.querySelector('#app-topic-editor_name')).not.toBeNull(),
    );
    await input('app-topic-editor_name', '新专题');
    await input('app-topic-editor_title', '新标题');
    await date('app-topic-editor_onLineTime', '2026-11-25');
    await date('app-topic-editor_offLineTime', '2026-11-24');
    button('保存', modal('新增专题')).click();
    await vi.waitFor(
      () =>
        expect(modal('新增专题').textContent).toContain(
          '下线日期不能早于上线日期',
        ),
      { timeout: 5000 },
    );
    expect(api.saveAppTopicApi).not.toHaveBeenCalled();
    await date('app-topic-editor_offLineTime', '2026-12-31');
    button('保存', modal('新增专题')).click();
    await vi.waitFor(() =>
      expect(api.saveAppTopicApi).toHaveBeenCalledWith({
        name: '新专题',
        title: '新标题',
        remd: 1,
        site: 0,
        platform: 101,
        isShowName: 1,
        onLineTime: '2026-11-25',
        offLineTime: '2026-12-31',
      }),
    );
  });
  it('批量删除须确认，使用专题id，末页清空后回退', async () => {
    await mount();
    main().querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getAppTopicListApi).toHaveBeenCalledTimes(2),
    );
    await vi.waitFor(() => expect(button('编辑', main()).disabled).toBe(false));
    await check(25, main());
    await check(38, main());
    button('删除选中（2）', main()).click();
    expect(api.removeAppTopicsApi).not.toHaveBeenCalled();
    api.getAppTopicListApi.mockResolvedValueOnce({
      records: [],
      current: 2,
      size: 20,
      total: 20,
      pages: 1,
    });
    await confirm('删除');
    await vi.waitFor(() =>
      expect(api.removeAppTopicsApi).toHaveBeenCalledWith([25, 38]),
    );
    await vi.waitFor(() =>
      expect(api.getAppTopicListApi).toHaveBeenCalledTimes(4),
    );
    expect(api.getAppTopicListApi).toHaveBeenLastCalledWith(defaults);
  });
  it('专题内编辑使用关联id修改名称和排序0，false响应保留表单', async () => {
    api.updateAppTopicAppApi.mockResolvedValueOnce(false);
    await mount(TopicAppsModal, { open: true, topic });
    const root = modal('专题应用：测试专题');
    expect(api.getAppTopicAppsApi).toHaveBeenCalledWith({
      sid: 25,
      page: 1,
      pageSize: 20,
    });
    button('编辑应用', root).click();
    await vi.waitFor(() =>
      expect(
        document.querySelector('#app-topic-member-editor_appName'),
      ).not.toBeNull(),
    );
    await input('app-topic-member-editor_appName', ' 新名称 ');
    button('保存应用', modal('编辑专题应用')).click();
    await vi.waitFor(() =>
      expect(api.updateAppTopicAppApi).toHaveBeenCalledWith({
        id: 5941,
        appName: '新名称',
        remd: 0,
      }),
    );
    await vi.waitFor(() =>
      expect(button('保存应用', modal('编辑专题应用')).disabled).toBe(false),
    );
    button('保存应用', modal('编辑专题应用')).click();
    await vi.waitFor(() =>
      expect(api.getAppTopicAppsApi).toHaveBeenCalledTimes(2),
    );
  });
  it('移除专题应用用关联id数组，不能误用应用id或专题id', async () => {
    await mount(TopicAppsModal, { open: true, topic });
    const root = modal('专题应用：测试专题');
    await check(5941, root);
    await check(5942, root);
    button('移除选中（2）', root).click();
    expect(api.removeAppTopicAppsApi).not.toHaveBeenCalled();
    await confirm('移除');
    await vi.waitFor(() =>
      expect(api.removeAppTopicAppsApi).toHaveBeenCalledWith([5941, 5942]),
    );
  });
  it('同一窗口直接添加候选，添加期间禁止左侧写入，成功刷新左右列表', async () => {
    let resolveAdd!: (value: boolean) => void;
    api.addAppTopicAppsApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAdd = resolve;
        }),
    );
    await mount(TopicAppsModal, { open: true, topic });
    const root = modal('专题应用：测试专题');
    const left = root.querySelector('section[aria-label="当前专题应用"]');
    if (!left) throw new Error('左侧当前专题应用未加载');
    const right = candidates();
    await vi.waitFor(() =>
      expect(right.querySelector('tr[data-row-key="447"]')).not.toBeNull(),
    );
    const row = right.querySelector('tr[data-row-key="447"]');
    if (!row) throw new Error('候选应用未加载');
    await vi.waitFor(() => expect(button('添加', row).disabled).toBe(false));
    expect(document.querySelectorAll('.ant-modal-content')).toHaveLength(1);
    button('添加', row).click();
    await vi.waitFor(() =>
      expect(api.addAppTopicAppsApi).toHaveBeenCalledWith({
        sid: 25,
        ids: [447],
      }),
    );
    await nextTick();
    expect(button('编辑应用', left).disabled).toBe(true);
    expect(button('移除', left).disabled).toBe(true);
    expect(button('关闭', root).disabled).toBe(true);
    api.getAppTopicAppsApi.mockResolvedValueOnce({
      records: [
        member,
        secondMember,
        { id: 5943, sid: 25, appId: 447, appName: other.appName, remd: 3 },
      ],
      current: 1,
      size: 20,
      total: 23,
      pages: 2,
    });
    api.getAppTopicCandidatesApi.mockResolvedValueOnce({
      records: [candidate, added, { ...other, isAdded: 1 }],
      current: 1,
      size: 20,
      total: 23,
      pages: 2,
    });
    resolveAdd(true);
    await vi.waitFor(() =>
      expect(api.getAppTopicAppsApi).toHaveBeenCalledTimes(2),
    );
    await vi.waitFor(() =>
      expect(api.getAppTopicCandidatesApi).toHaveBeenCalledTimes(2),
    );
    await vi.waitFor(() => expect(left.textContent).toContain(other.appName));
    expect(
      right.querySelector<HTMLInputElement>(
        'tr[data-row-key="447"] input[type="checkbox"]',
      )?.disabled,
    ).toBe(true);
    expect(document.querySelectorAll('.ant-modal-content')).toHaveLength(1);
  });
  it('移除后刷新右侧添加状态，保留右侧已提交筛选与分页，可重新添加', async () => {
    api.getAppTopicCandidatesApi.mockImplementation(
      async ({ page, pageSize }) => ({
        records: [{ ...candidate, isAdded: 1 }, added, other],
        current: page,
        size: pageSize,
        total: 23,
        pages: 2,
      }),
    );
    await mount(TopicAppsModal, { open: true, topic });
    const root = modal('专题应用：测试专题');
    const left = root.querySelector('section[aria-label="当前专题应用"]');
    if (!left) throw new Error('左侧当前专题应用未加载');
    const right = candidates();
    await vi.waitFor(() =>
      expect(
        right.querySelector<HTMLInputElement>(
          'tr[data-row-key="445"] input[type="checkbox"]',
        )?.disabled,
      ).toBe(true),
    );
    await input('app-topic-candidates_searchKeyText', '445');
    button('查询', root).click();
    await vi.waitFor(() =>
      expect(api.getAppTopicCandidatesApi).toHaveBeenCalledTimes(2),
    );
    await vi.waitFor(() =>
      expect(
        button('添加', right.querySelector('tr[data-row-key="447"]') ?? right)
          .disabled,
      ).toBe(false),
    );
    right.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, searchKeyText: '445' }),
      ),
    );
    api.getAppTopicCandidatesApi.mockResolvedValueOnce({
      records: [candidate, added, other],
      current: 2,
      size: 20,
      total: 23,
      pages: 2,
    });
    api.getAppTopicAppsApi.mockResolvedValueOnce({
      records: [secondMember],
      current: 1,
      size: 20,
      total: 21,
      pages: 2,
    });
    button('移除', left).click();
    await confirm('移除');
    await vi.waitFor(() =>
      expect(api.removeAppTopicAppsApi).toHaveBeenCalledWith([5941]),
    );
    await vi.waitFor(() =>
      expect(api.getAppTopicCandidatesApi).toHaveBeenCalledTimes(4),
    );
    expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith({
      sort: '1',
      type: -1,
      platform: 103,
      searchKeyType: 2,
      searchKeyText: '445',
      sid: 25,
      page: 2,
      pageSize: 20,
    });
    await vi.waitFor(() =>
      expect(
        right.querySelector<HTMLInputElement>(
          'tr[data-row-key="445"] input[type="checkbox"]',
        )?.disabled,
      ).toBe(false),
    );
  });
  it('候选筛选按软件类型联动分类，搜索类型1为应用ID，每次请求携带当前sid', async () => {
    await mount(CandidateAppsPanel, { open: true, topic });
    const root = candidates();
    expect(api.getAppTopicCandidatesApi).toHaveBeenCalledWith({
      sort: '1',
      type: -1,
      platform: 103,
      searchKeyType: 2,
      searchKeyText: '',
      sid: 25,
      page: 1,
      pageSize: 20,
    });
    expect(root.textContent).toContain('0(0)');
    await select('app-topic-candidates_sort', '游戏');
    await vi.waitFor(() =>
      expect(api.getAppCategoryListApi).toHaveBeenLastCalledWith(2),
    );
    await select('app-topic-candidates_type', '动作');
    await select('app-topic-candidates_searchKeyType', '应用 ID');
    await select('app-topic-candidates_platform', '全部');
    await input('app-topic-candidates_searchKeyText', ' 447 ');
    button('查询', root).click();
    await vi.waitFor(() =>
      expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith({
        sort: '2',
        type: 203,
        platform: -1,
        searchKeyType: 1,
        searchKeyText: '447',
        sid: 25,
        page: 1,
        pageSize: 20,
      }),
    );
  });
  it('候选禁止重复添加，批量添加传appId数组和sid，失败可重试', async () => {
    api.addAppTopicAppsApi.mockResolvedValueOnce(false);
    await mount(CandidateAppsPanel, { open: true, topic });
    const root = candidates();
    expect(
      root.querySelector<HTMLInputElement>(
        'tr[data-row-key="446"] input[type="checkbox"]',
      )?.disabled,
    ).toBe(true);
    await check(445, root);
    await check(447, root);
    button('添加选中（2）', root).click();
    await vi.waitFor(() =>
      expect(api.addAppTopicAppsApi).toHaveBeenCalledWith({
        sid: 25,
        ids: [445, 447],
      }),
    );
    await vi.waitFor(() =>
      expect(button('添加选中（2）', root).disabled).toBe(false),
    );
    button('添加选中（2）', root).click();
    await vi.waitFor(() =>
      expect(api.getAppTopicCandidatesApi).toHaveBeenCalledTimes(2),
    );
    expect(button('添加选中（0）', root).disabled).toBe(true);
  });
  it('切换专题后旧请求晚返回不能覆盖当前候选或混用sid', async () => {
    let resolveOld!: (value: unknown) => void;
    api.getAppTopicCandidatesApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const scope = ref(topic);
    app = createApp({
      setup: () => () =>
        h(CandidateAppsPanel, { open: true, topic: scope.value }),
    });
    app.mount(container());
    await vi.waitFor(() =>
      expect(api.getAppTopicCandidatesApi).toHaveBeenCalledTimes(1),
    );
    scope.value = secondTopic;
    await vi.waitFor(() =>
      expect(api.getAppTopicCandidatesApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ sid: 38 }),
      ),
    );
    await vi.waitFor(() =>
      expect(candidates().textContent).toContain(candidate.appName),
    );
    resolveOld({
      records: [{ ...candidate, appName: '过期应用' }],
      current: 1,
      size: 20,
      total: 1,
      pages: 1,
    });
    await nextTick();
    expect(candidates().textContent).not.toContain('过期应用');
    button('添加', candidates()).click();
    await vi.waitFor(() =>
      expect(api.addAppTopicAppsApi).toHaveBeenCalledWith({
        sid: 38,
        ids: [445],
      }),
    );
  });
});
