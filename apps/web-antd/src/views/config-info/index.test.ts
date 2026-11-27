import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ConfigInfoPage from './index.vue';

const api = vi.hoisted(() => ({
  addConfigInfoApi: vi.fn(),
  getConfigInfoDetailsApi: vi.fn(),
  getConfigInfoListApi: vi.fn(),
  updateConfigInfoApi: vi.fn(),
}));

vi.mock('#/api', () => api);
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));

const record = {
  configClientVersion: '220',
  configCode: 'paperscreen_4',
  configCondition: '',
  configInfo: '<paperscreen>\n  <name>main</name>\n</paperscreen>',
  configInfoFormat: 'xml',
  configName: '壁纸预览图',
  configNote: '配置说明',
  createTime: '2014-12-03T18:00:16',
  id: 5,
  status: 1,
  updateTime: '2026-11-17T11:16:58',
  userName: null,
};

let app: App;

function button(label: string) {
  const result = [...document.querySelectorAll('button')].find(
    (element) => element.textContent?.replaceAll(/\s/g, '') === label,
  );
  if (!result) throw new Error(`找不到按钮：${label}`);
  return result;
}

function field(name: string) {
  const result = document.querySelector(`#form_item_${name}`);
  if (
    !(
      result instanceof HTMLInputElement ||
      result instanceof HTMLTextAreaElement
    )
  ) {
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
  app = createApp(ConfigInfoPage);
  app.mount(container);
  await vi.waitFor(() =>
    expect(document.body.textContent).toContain(record.configName),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  api.getConfigInfoListApi.mockImplementation(async ({ page, pageSize }) => ({
    current: page,
    pages: 3,
    records: [record],
    size: pageSize,
    total: 55,
  }));
  api.getConfigInfoDetailsApi.mockResolvedValue(record);
  api.addConfigInfoApi.mockResolvedValue(null);
  api.updateConfigInfoApi.mockResolvedValue(null);
});

afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('配置管理页面', { timeout: 15_000 }, () => {
  it('加载分页数据，并将下一页传给接口', async () => {
    await mountPage();
    expect(api.getConfigInfoListApi).toHaveBeenCalledWith(
      {
        page: 1,
        pageSize: 20,
      },
      expect.any(AbortSignal),
    );
    expect(document.body.textContent).toContain('2014-12-03 18:00:16');
    const nextPage = document.querySelector<HTMLLIElement>(
      '.ant-pagination-next',
    );
    expect(nextPage).not.toBeNull();
    nextPage?.click();
    await vi.waitFor(() =>
      expect(api.getConfigInfoListApi).toHaveBeenCalledWith(
        {
          page: 2,
          pageSize: 20,
        },
        expect.any(AbortSignal),
      ),
    );
  });

  it('必填校验失败时不提交新增请求', async () => {
    await mountPage();
    button('新增配置').click();
    await nextTick();
    button('保存').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('请填写此项'),
    );
    expect(api.addConfigInfoApi).not.toHaveBeenCalled();
  });

  it('新增时保留配置内容原文，提交后刷新列表', async () => {
    await mountPage();
    button('新增配置').click();
    await nextTick();
    await input('configName', ' 新配置 ');
    await input('configCode', ' new_config ');
    const content = '  <config>\n    <value>test</value>\n  </config>  ';
    await input('configInfo', content);
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.addConfigInfoApi).toHaveBeenCalledWith(
        expect.objectContaining({
          configCode: 'new_config',
          configInfo: content,
          configName: '新配置',
          status: 1,
          userName: null,
        }),
      ),
    );
    await vi.waitFor(() =>
      expect(api.getConfigInfoListApi).toHaveBeenCalledTimes(2),
    );
  });

  it('详情为只读，且不提供保存操作', async () => {
    await mountPage();
    button('详情').click();
    await vi.waitFor(() =>
      expect(field('configInfo').value).toBe(record.configInfo),
    );
    expect(api.getConfigInfoDetailsApi).toHaveBeenCalledWith(5);
    expect(field('configName').disabled).toBe(true);
    expect(
      [...document.querySelectorAll('button')].some(
        (element) => element.textContent?.replaceAll(/\s/g, '') === '保存',
      ),
    ).toBe(false);
  });

  it('编辑失败保留内容供重试，成功时提交当前配置 ID', async () => {
    api.updateConfigInfoApi.mockRejectedValueOnce(new Error('保存失败'));
    await mountPage();
    button('编辑').click();
    await vi.waitFor(() =>
      expect(field('configInfo').value).toBe(record.configInfo),
    );
    await input('configName', '修改后的配置');
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateConfigInfoApi).toHaveBeenCalledTimes(1),
    );
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(field('configName').value).toBe('修改后的配置');
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateConfigInfoApi).toHaveBeenCalledTimes(2),
    );
    expect(api.updateConfigInfoApi).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 5, configName: '修改后的配置' }),
    );
  });
});
