import { describe, expect, it, vi } from 'vitest';

import { getSystemLogsApi } from './system-logs';

const client = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: client }));

describe('日志接口契约', () => {
  it.each(['login-logs', 'operation-logs'] as const)(
    '读取 %s 并保留失败筛选条件',
    async (kind) => {
      const params = {
        page: 2,
        pageSize: 20,
        succeeded: false,
        username: 'reader',
        startTime: '2026-11-01T00:00:00',
        endTime: '2026-11-24T23:59:59',
      };
      await getSystemLogsApi(kind, params);
      expect(client.get).toHaveBeenLastCalledWith(`/system/${kind}`, {
        params,
      });
    },
  );
});
