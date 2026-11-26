import { describe, expect, it, vi } from 'vitest';

import { reloadMobileCacheApi } from './mobile-cache';

const client = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('#/api/request', () => ({ configInfoRequestClient: client }));

describe('移动端缓存接口', () => {
  it('通过业务客户端发送GET，所有缓存类型均直接写入路径，不附加推荐筛选参数', async () => {
    client.get.mockResolvedValue(null);
    for (const type of [
      2, 6, 20, 21, 22, 25, 27, 28, 31, 34, 72, 83, 401,
    ] as const) {
      await reloadMobileCacheApi(type);
      expect(client.get).toHaveBeenLastCalledWith(
        `/mobileCache/reload/${type}`,
      );
    }
  });
});
