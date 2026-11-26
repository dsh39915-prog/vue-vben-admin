import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPeculiarAppMsgDetailsApi,
  getPeculiarAppMsgListApi,
  getPeculiarAppMsgOptionsApi,
  removePeculiarAppMsgApi,
  savePeculiarAppMsgApi,
} from './peculiar-app-msg';

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('#/api/request', () => ({ configInfoRequestClient: client }));
beforeEach(() => vi.resetAllMocks());

describe('特殊应用提示接口契约', () => {
  it('应用编辑下拉加载全部分页，包含无效记录，不截断为第一页', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      title: `提示${index + 1}`,
      status: 1,
    }));
    const last = { id: 101, title: '末页提示', status: 0 };
    client.post
      .mockResolvedValueOnce({ records: firstPage, total: 101 })
      .mockResolvedValueOnce({ records: [last], total: 101 });
    const options = await getPeculiarAppMsgOptionsApi();
    expect(options).toHaveLength(101);
    expect(options.at(-1)).toEqual(last);
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/peculiarAppMsg/findPeculiarAppMsgByParam',
      { status: -1, page: 1, pageSize: 100 },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/peculiarAppMsg/findPeculiarAppMsgByParam',
      { status: -1, page: 2, pageSize: 100 },
    );
  });
  it('提示列表为空时结束分页，避免循环请求', async () => {
    client.post.mockResolvedValueOnce({ records: [], total: 5 });
    expect(await getPeculiarAppMsgOptionsApi()).toEqual([]);
    expect(client.post).toHaveBeenCalledTimes(1);
  });
  it('列表以数字状态筛选，详情和逻辑删除使用文档中的GET路径', async () => {
    const query = { status: 0 as const, page: 2, pageSize: 20 };
    await getPeculiarAppMsgListApi(query);
    expect(client.post).toHaveBeenLastCalledWith(
      '/peculiarAppMsg/findPeculiarAppMsgByParam',
      query,
    );
    await getPeculiarAppMsgDetailsApi(2);
    expect(client.get).toHaveBeenLastCalledWith(
      '/peculiarAppMsg/getPeculiarAppMsgById/2',
    );
    await removePeculiarAppMsgApi(2);
    expect(client.get).toHaveBeenLastCalledWith(
      '/peculiarAppMsg/removePeculiarAppMsg/2',
    );
  });
  it('新增不传id，修改传原id，保留状态0、弹窗类型和完整内容', async () => {
    const data = {
      title: '安装提示',
      info: '  提示内容\n第二行  ',
      status: 0 as const,
      popupType: 4 as const,
    };
    await savePeculiarAppMsgApi(data);
    expect(client.post).toHaveBeenLastCalledWith(
      '/peculiarAppMsg/addOrModifyPeculiarAppMsg',
      data,
    );
    await savePeculiarAppMsgApi({ ...data, id: 2 });
    expect(client.post).toHaveBeenLastCalledWith(
      '/peculiarAppMsg/addOrModifyPeculiarAppMsg',
      { ...data, id: 2 },
    );
  });
});
