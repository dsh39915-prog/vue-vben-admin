import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PeculiarAppMsgPage from './index.vue';

const api = vi.hoisted(() => ({
  getPeculiarAppMsgDetailsApi: vi.fn(),
  getPeculiarAppMsgListApi: vi.fn(),
  removePeculiarAppMsgApi: vi.fn(),
  savePeculiarAppMsgApi: vi.fn(),
}));
vi.mock('#/api', () => api);
vi.mock('@vben/common-ui', () => ({
  Page: {
    props: ['title'],
    template: '<main><h1>{{ title }}</h1><slot /></main>',
  },
}));
vi.mock('#/composables/use-menu-title', () => ({
  useMenuTitle: () => '接口特殊应用提示标题',
}));
const record = {
  id: 2,
  title: '安装按钮弹网页',
  info: 'https://www.i4.cn',
  status: 0,
  popupType: 2,
  createTime: '2017-10-19 17:33:58',
  updateTime: '2017-10-19 17:33:58',
};
let app: App;
function button(label: string, root: ParentNode = document) {
  const found = [...root.querySelectorAll('button')].find(
    (item) => item.textContent?.replaceAll(/\s/g, '') === label,
  );
  if (!found) throw new Error(`找不到按钮：${label}`);
  return found;
}
async function mountPage() {
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp(PeculiarAppMsgPage);
  app.mount(container);
  await vi.waitFor(() =>
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      record.title,
    ),
  );
  await vi.waitFor(() => expect(button('编辑').disabled).toBe(false));
}
async function input(name: string, value: string) {
  const field = document.querySelector<HTMLInputElement>(
    `#peculiar-app-msg-editor_${name}`,
  );
  if (!field) throw new Error(`找不到字段：${name}`);
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}
async function select(id: string, label: string) {
  const selector = document
    .querySelector(`#${id}`)
    ?.closest('.ant-select')
    ?.querySelector('.ant-select-selector');
  if (!selector) throw new Error(`找不到下拉框：${id}`);
  selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await nextTick();
  const query = `.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${label}"]`;
  await vi.waitFor(() => expect(document.querySelector(query)).not.toBeNull());
  document.querySelector<HTMLElement>(query)?.click();
  await nextTick();
}
beforeEach(() => {
  vi.resetAllMocks();
  api.getPeculiarAppMsgListApi.mockImplementation(
    async ({ page, pageSize }) => ({
      records: [record],
      current: page,
      size: pageSize,
      total: 21,
      pages: 2,
    }),
  );
  api.getPeculiarAppMsgDetailsApi.mockResolvedValue({
    ...record,
    title: '来自详情接口的标题',
    info: '  第一行\n第二行  ',
    popupType: 4,
  });
  api.savePeculiarAppMsgApi.mockResolvedValue(true);
  api.removePeculiarAppMsgApi.mockResolvedValue(true);
});
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('特殊应用提示', { timeout: 20_000 }, () => {
  it('默认20条，展示全部字段，状态筛选保留数字0，分页沿用已提交条件，重置回首页', async () => {
    await mountPage();
    expect(document.body.textContent).toContain('接口特殊应用提示标题');
    expect(api.getPeculiarAppMsgListApi).toHaveBeenCalledWith({
      status: -1,
      page: 1,
      pageSize: 20,
    });
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      '无效',
    );
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      '安装弹网页',
    );
    await select('peculiar-app-msg-filters_status', '无效');
    button('查询').click();
    await vi.waitFor(() =>
      expect(api.getPeculiarAppMsgListApi).toHaveBeenLastCalledWith({
        status: 0,
        page: 1,
        pageSize: 20,
      }),
    );
    await vi.waitFor(() => expect(button('编辑').disabled).toBe(false));
    await select('peculiar-app-msg-filters_status', '有效');
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getPeculiarAppMsgListApi).toHaveBeenLastCalledWith({
        status: 0,
        page: 2,
        pageSize: 20,
      }),
    );
    button('重置').click();
    await vi.waitFor(() =>
      expect(api.getPeculiarAppMsgListApi).toHaveBeenLastCalledWith({
        status: -1,
        page: 1,
        pageSize: 20,
      }),
    );
  });
  it('新增校验必填，失败保留内容，重试不传id且避免重复提交', async () => {
    api.savePeculiarAppMsgApi.mockResolvedValueOnce(false);
    await mountPage();
    button('新增提示').click();
    await nextTick();
    button('保存').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('请填写此项'),
    );
    expect(api.savePeculiarAppMsgApi).not.toHaveBeenCalled();
    await input('title', ' 新提示 ');
    await input('info', '  第一行\n第二行  ');
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.savePeculiarAppMsgApi).toHaveBeenCalledTimes(1),
    );
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(
      document.querySelector<HTMLInputElement>('#peculiar-app-msg-editor_title')
        ?.value,
    ).toBe(' 新提示 ');
    button('保存').click();
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.savePeculiarAppMsgApi).toHaveBeenCalledTimes(2),
    );
    expect(api.savePeculiarAppMsgApi).toHaveBeenLastCalledWith({
      title: '新提示',
      info: '  第一行\n第二行  ',
      status: 1,
      popupType: 1,
    });
    await vi.waitFor(() =>
      expect(api.getPeculiarAppMsgListApi).toHaveBeenCalledTimes(2),
    );
  });
  it('编辑先读取最新详情，提交原id、状态0、完整详情和弹窗类型', async () => {
    await mountPage();
    button('编辑').click();
    await vi.waitFor(() =>
      expect(
        document.querySelector<HTMLInputElement>(
          '#peculiar-app-msg-editor_title',
        )?.value,
      ).toBe('来自详情接口的标题'),
    );
    expect(api.getPeculiarAppMsgDetailsApi).toHaveBeenCalledWith(2);
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.savePeculiarAppMsgApi).toHaveBeenCalledWith({
        id: 2,
        title: '来自详情接口的标题',
        info: '  第一行\n第二行  ',
        status: 0,
        popupType: 4,
      }),
    );
    await vi.waitFor(() =>
      expect(api.getPeculiarAppMsgListApi).toHaveBeenCalledTimes(2),
    );
  });
  it('详情加载失败禁用保存并支持重试，查看详情只读且没有保存按钮', async () => {
    api.getPeculiarAppMsgDetailsApi.mockRejectedValueOnce(
      new Error('详情失败'),
    );
    await mountPage();
    button('编辑').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('特殊应用提示详情加载失败'),
    );
    expect(button('保存').disabled).toBe(true);
    button('重试').click();
    await vi.waitFor(() =>
      expect(
        document.querySelector<HTMLInputElement>(
          '#peculiar-app-msg-editor_title',
        )?.value,
      ).toBe('来自详情接口的标题'),
    );
    button('取消').click();
    await nextTick();
    button('详情').click();
    await vi.waitFor(() => expect(button('关闭')).toBeDefined());
    await vi.waitFor(() =>
      expect(
        document.querySelector<HTMLInputElement>(
          '#peculiar-app-msg-editor_title',
        )?.disabled,
      ).toBe(true),
    );
    const modal = document.querySelector('.ant-modal-content');
    expect(modal?.textContent).not.toContain('保存');
    expect(api.savePeculiarAppMsgApi).not.toHaveBeenCalled();
  });
  it('逻辑删除需确认，末页删除后回退到有效页码', async () => {
    await mountPage();
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getPeculiarAppMsgListApi).toHaveBeenCalledTimes(2),
    );
    await vi.waitFor(() => expect(button('删除').disabled).toBe(false));
    button('删除').click();
    const query = '.ant-popover:not(.ant-popover-hidden)';
    await vi.waitFor(() =>
      expect(document.querySelector(query)).not.toBeNull(),
    );
    expect(api.removePeculiarAppMsgApi).not.toHaveBeenCalled();
    api.getPeculiarAppMsgListApi.mockResolvedValueOnce({
      records: [],
      current: 2,
      size: 20,
      total: 20,
      pages: 1,
    });
    const prompt = document.querySelector(query);
    if (!prompt) throw new Error('删除确认框未打开');
    button('删除', prompt).click();
    await vi.waitFor(() =>
      expect(api.removePeculiarAppMsgApi).toHaveBeenCalledWith(2),
    );
    await vi.waitFor(() =>
      expect(api.getPeculiarAppMsgListApi).toHaveBeenCalledTimes(4),
    );
    expect(api.getPeculiarAppMsgListApi).toHaveBeenLastCalledWith({
      status: -1,
      page: 1,
      pageSize: 20,
    });
  });
  it('列表失败时禁止编辑删除，可刷新重试', async () => {
    await mountPage();
    api.getPeculiarAppMsgListApi.mockRejectedValueOnce(new Error('加载失败'));
    button('刷新').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('特殊应用提示加载失败'),
    );
    expect(button('编辑').disabled).toBe(true);
    expect(button('删除').disabled).toBe(true);
    button('刷新').click();
    await vi.waitFor(() => expect(button('编辑').disabled).toBe(false));
  });
});
