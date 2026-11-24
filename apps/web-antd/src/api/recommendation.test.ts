import { describe, expect, it, vi } from 'vitest';

import {
  getRecommendationListApi,
  updateRecommendationOrderApi,
  updateRecommendationSlotApi,
} from './recommendation';

const client = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('#/api/request', () => ({ configInfoRequestClient: client }));

describe('推荐管理接口契约', () => {
  it('查询和空位操作保留栏目、分类、字符串平台及版本', async () => {
    const context = {
      column: 71,
      sort: 2 as const,
      type: 203,
      platform: '102' as const,
      iosVersion: 1 as const,
    };
    await getRecommendationListApi({ ...context, page: 2, pageSize: 20 });
    expect(client.post).toHaveBeenLastCalledWith('/appInfo/getRemdList', {
      ...context,
      page: 2,
      pageSize: 20,
    });
    for (const operType of [1, -1] as const) {
      await updateRecommendationSlotApi({ ...context, operType, remdNum: 12 });
      expect(client.post).toHaveBeenLastCalledWith(
        '/appInfo/addOrDelNoneRemdNum',
        { ...context, operType, remdNum: 12 },
      );
    }
  });
  it('取消推荐保留 order=0 和应用分类，不附加查询字段', async () => {
    const input = {
      id: 275_743,
      type: 111,
      platform: '101' as const,
      iosVersion: -1 as const,
      order: 0,
      info: '',
    };
    await updateRecommendationOrderApi(input);
    expect(client.post).toHaveBeenLastCalledWith(
      '/appInfo/updateAppRemd',
      input,
    );
  });
});
