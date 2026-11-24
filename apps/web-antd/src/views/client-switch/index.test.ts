import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ClientSwitchPage from './index.vue';

const api = vi.hoisted(() => ({
  addClientSwitchApi: vi.fn(),
  deleteClientSwitchApi: vi.fn(),
  getClientSwitchDetailsApi: vi.fn(),
  getClientSwitchListApi: vi.fn(),
  updateClientSwitchApi: vi.fn(),
}));

vi.mock('#/api', () => api);
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));

const record = {
  clientVersion: '213',
  createTime: '2018-01-24 14:55:11',
  createUser: '小飞',
  id: 8,
  status: 1,
  switchType: 1,
  updateTime: '2018-03-09 14:46:02',
};

let app: App;

function button(label: string, root: ParentNode = document) {
  const result = [...root.querySelectorAll('button')].find(
    (element) => element.textContent?.replaceAll(/\s/g, '') === label,
  );
  if (!result) throw new Error(`找不到按钮：${label}`);
  return result;
}

function field(name: string) {
  const result = document.querySelector(`#form_item_${name}`);
  if (!(result instanceof HTMLInputElement)) {
    throw new TypeError(`找不到表单字段：${name}`);
  }
  return result;
}

async function input(name: string, value: string) {
  await vi.waitFor(() => expect(field(name)).toBeDefined());
  const element = field(name);
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}

async function mountPage() {
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp(ClientSwitchPage);
  app.mount(container);
  await vi.waitFor(() =>
    expect(document.body.textContent).toContain(record.createUser),
  );
}

async function deletionPrompt() {
  button('删除').click();
  await vi.waitFor(() =>
    expect(
      document.querySelector('.ant-popover:not(.ant-popover-hidden)'),
    ).not.toBeNull(),
  );
  const prompt = document.querySelector(
    '.ant-popover:not(.ant-popover-hidden)',
  );
  if (!prompt) throw new Error('删除确认框未打开');
  return prompt;
}

beforeEach(() => {
  vi.resetAllMocks();
  api.getClientSwitchListApi.mockImplementation(async ({ page, pageSize }) => ({
    current: page,
    pages: 2,
    records: [record],
    size: pageSize,
    total: 21,
  }));
  api.getClientSwitchDetailsApi.mockResolvedValue(record);
  api.addClientSwitchApi.mockResolvedValue(null);
  api.updateClientSwitchApi.mockResolvedValue(null);
  api.deleteClientSwitchApi.mockResolvedValue(null);
});

afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('客户端壳开关页面', { timeout: 15_000 }, () => {
  it('展示列表和开关含义，并请求下一页', async () => {
    await mountPage();
    expect(api.getClientSwitchListApi).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    });
    expect(document.body.textContent).toContain('开启');
    expect(document.body.textContent).toContain('正常');
    document.querySelector<HTMLLIElement>('.ant-pagination-next')?.click();
    await vi.waitFor(() =>
      expect(api.getClientSwitchListApi).toHaveBeenCalledWith({
        page: 2,
        pageSize: 20,
      }),
    );
  });

  it('未填写版本和创建人时阻止提交', async () => {
    await mountPage();
    button('新增开关').click();
    await nextTick();
    button('保存').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('请填写此项'),
    );
    expect(api.addClientSwitchApi).not.toHaveBeenCalled();
  });

  it('新增保留版本字符串，关闭开关以数字 0 提交，记录状态为正常', async () => {
    await mountPage();
    button('新增开关').click();
    await nextTick();
    await input('clientVersion', ' 0213 ');
    await input('createUser', ' 测试用户 ');
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.addClientSwitchApi).toHaveBeenCalledWith({
        clientVersion: '0213',
        createTime: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
        ),
        createUser: '测试用户',
        status: 1,
        switchType: 0,
        updateTime: expect.any(String),
      }),
    );
    await vi.waitFor(() =>
      expect(api.getClientSwitchListApi).toHaveBeenCalledTimes(2),
    );
  });

  it('详情只读，加载失败时只能重试或关闭', async () => {
    api.getClientSwitchDetailsApi.mockRejectedValueOnce(new Error('详情失败'));
    await mountPage();
    button('详情').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('详情加载失败'),
    );
    expect(
      [...document.querySelectorAll('button')].some(
        (element) => element.textContent?.replaceAll(/\s/g, '') === '保存',
      ),
    ).toBe(false);
    button('重试').click();
    await vi.waitFor(() => expect(field('clientVersion').value).toBe('213'));
    expect(field('clientVersion').disabled).toBe(true);
    expect(api.getClientSwitchDetailsApi).toHaveBeenLastCalledWith(8);
  });

  it('编辑保留创建时间及状态，失败后可重试', async () => {
    api.updateClientSwitchApi.mockRejectedValueOnce(new Error('修改失败'));
    await mountPage();
    button('编辑').click();
    await vi.waitFor(() => expect(field('clientVersion').value).toBe('213'));
    await input('clientVersion', '216');
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateClientSwitchApi).toHaveBeenCalledTimes(1),
    );
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(field('clientVersion').value).toBe('216');
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateClientSwitchApi).toHaveBeenCalledTimes(2),
    );
    expect(api.updateClientSwitchApi).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clientVersion: '216',
        createTime: record.createTime,
        id: 8,
        status: 1,
        switchType: 1,
      }),
    );
  });

  it('取消删除不调用接口，确认后删除并在当前页空时返回上一页', async () => {
    await mountPage();
    const cancelledPrompt = await deletionPrompt();
    expect(api.deleteClientSwitchApi).not.toHaveBeenCalled();
    button('取消', cancelledPrompt).click();
    await nextTick();
    expect(api.deleteClientSwitchApi).not.toHaveBeenCalled();
    document.querySelector<HTMLLIElement>('.ant-pagination-next')?.click();
    await vi.waitFor(() =>
      expect(api.getClientSwitchListApi).toHaveBeenCalledWith({
        page: 2,
        pageSize: 20,
      }),
    );
    api.getClientSwitchListApi.mockImplementation(
      async ({ page, pageSize }) => ({
        current: page,
        pages: 1,
        records: page === 2 ? [] : [{ ...record, id: 9 }],
        size: pageSize,
        total: 20,
      }),
    );
    const confirmedPrompt = await deletionPrompt();
    button('删除', confirmedPrompt).click();
    await vi.waitFor(() =>
      expect(api.deleteClientSwitchApi).toHaveBeenCalledWith(8),
    );
    await vi.waitFor(() =>
      expect(api.getClientSwitchListApi).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 20,
      }),
    );
  });

  it('删除失败保留列表供再次操作', async () => {
    api.deleteClientSwitchApi.mockRejectedValueOnce(new Error('删除失败'));
    await mountPage();
    const prompt = await deletionPrompt();
    button('删除', prompt).click();
    await vi.waitFor(() =>
      expect(api.deleteClientSwitchApi).toHaveBeenCalledTimes(1),
    );
    await vi.waitFor(() => expect(button('删除').disabled).toBe(false));
    expect(document.body.textContent).toContain(record.createUser);
    expect(api.getClientSwitchListApi).toHaveBeenCalledTimes(1);
  });
});
