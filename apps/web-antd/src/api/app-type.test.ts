import { describe, expect, it, vi } from 'vitest';

import { getAppTypeListApi, updateAppTypeOrderApi } from './app-type';

const client = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('#/api/request', () => ({ configInfoRequestClient: client }));

describe('应用分类接口契约', () => {
  it('列表保留字符串筛选值、Sort字段大小写及服务端排序方向', async () => {
    const params = {
      sort1: '2' as const,
      appName: '动作',
      status: '0' as const,
      page: 2,
      pageSize: 20,
      sort: 'Sort' as const,
      order: 'desc' as const,
    };
    await getAppTypeListApi(params);
    expect(client.post).toHaveBeenLastCalledWith('/appType/getAppType', params);
  });
  it('修改排序仅提交id、记录类型、原序号和新序号，保留数字0', async () => {
    const input = { id: 137, sort: 2, oldOrder: 1, newOrder: 0 };
    await updateAppTypeOrderApi(input);
    expect(client.post).toHaveBeenLastCalledWith(
      '/appType/modifyAppTypeOrderNum',
      input,
    );
  });
});
