import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addAppRecommendationApi } from './app-info';

const client = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('#/api/request', () => ({ configInfoRequestClient: client }));
beforeEach(() => vi.resetAllMocks());

describe('添加应用推荐接口', () => {
  it('使用POST，平台、类型、分类及14.5版本均按数字提交，接受null成功结果', async () => {
    client.post.mockResolvedValue(null);
    const data = {
      id: 67_964,
      column: 3 as const,
      platform: 102 as const,
      sort: 2 as const,
      type: 203,
      iosVersion: 1 as const,
    };
    const result = await addAppRecommendationApi(data);
    expect(result).toBeNull();
    expect(client.post).toHaveBeenCalledExactlyOnceWith(
      '/appInfo/addAppRemd',
      data,
    );
  });
  it('普通推荐保留iosVersion=-1及type=0，不转换成栏目或软件类型', async () => {
    const data = {
      id: 67_964,
      column: 1 as const,
      platform: 101 as const,
      sort: 1 as const,
      type: 0,
      iosVersion: -1 as const,
    };
    await addAppRecommendationApi(data);
    expect(client.post).toHaveBeenCalledWith('/appInfo/addAppRemd', data);
  });
});
