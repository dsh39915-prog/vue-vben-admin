import { describe, expect, it, vi } from 'vitest';

import {
  getPeculiarAppMsgDetailsApi,
  getPeculiarAppMsgListApi,
  removePeculiarAppMsgApi,
  savePeculiarAppMsgApi,
} from './peculiar-app-msg';

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('#/api/request', () => ({ configInfoRequestClient: client }));

describe('特殊应用提示接口契约', () => {
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
