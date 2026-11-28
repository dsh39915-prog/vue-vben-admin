import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startUpdateChecker } from './update-checker';

describe('页面更新检查', () => {
  const fetchVersion = vi.fn<typeof fetch>();
  const onUpdate = vi.fn();
  let dispose: (() => void) | undefined;
  let hidden = false;

  function response(buildId = 'build-A', status = 200) {
    return Response.json({ buildId }, { status });
  }

  function start(intervalMinutes = 1, buildId: string | undefined = 'build-A') {
    dispose = startUpdateChecker({
      buildId,
      intervalMinutes,
      onUpdate,
      url: '/app-version.json',
    });
  }

  function visibility(value: boolean) {
    hidden = value;
    document.dispatchEvent(new Event('visibilitychange'));
  }

  function pendingRequest() {
    let resolve!: (value: Response) => void;
    const promise = new Promise<Response>((finish) => {
      resolve = finish;
    });
    return { promise, resolve };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    hidden = false;
    vi.stubGlobal('location', { hostname: 'qq.i4.cn' });
    vi.stubGlobal('fetch', fetchVersion);
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    fetchVersion.mockImplementation(async () => response());
  });

  afterEach(() => {
    dispose?.();
    dispose = undefined;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it('立即比较页面构建版本，首次请求已是新版也提示且只提示一次', async () => {
    fetchVersion.mockImplementation(async () => response('build-B'));
    start();
    expect(fetchVersion).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(0);
    expect(onUpdate).toHaveBeenCalledOnce();
    visibility(true);
    visibility(false);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(fetchVersion).toHaveBeenCalledOnce();
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('同版不提示，下一分钟检测到新版时提示，不依赖 ETag', async () => {
    start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(fetchVersion).toHaveBeenCalledWith('/app-version.json', {
      cache: 'no-store',
      redirect: 'error',
      signal: expect.any(AbortSignal),
    });
    fetchVersion.mockImplementation(async () => response('build-B'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchVersion).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it.each([401, 404, 503])(
    '响应 HTTP %i 即使携带新版标识也不提示，恢复后继续检查',
    async (status) => {
      fetchVersion.mockImplementationOnce(async () =>
        response('error-page', status),
      );
      start();
      await vi.advanceTimersByTimeAsync(0);
      expect(onUpdate).not.toHaveBeenCalled();
      fetchVersion.mockImplementation(async () => response('build-B'));
      await vi.advanceTimersByTimeAsync(60_000);
      expect(onUpdate).toHaveBeenCalledOnce();
    },
  );

  it.each([
    '<html>fallback</html>',
    '{}',
    'null',
    '{"buildId":1}',
    '{"buildId":" "}',
  ])('忽略无效版本文件 %s，随后能够重试', async (body) => {
    fetchVersion.mockResolvedValueOnce(new Response(body));
    start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onUpdate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchVersion).toHaveBeenCalledTimes(2);
  });

  it('网络异常后不会误报，下一周期重试', async () => {
    fetchVersion.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onUpdate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchVersion).toHaveBeenCalledTimes(2);
  });

  it('检查超时会取消请求，且不会与下一次请求重叠', async () => {
    let aborted = false;
    fetchVersion.mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    start();
    await vi.advanceTimersByTimeAsync(9999);
    expect(aborted).toBe(false);
    expect(fetchVersion).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(aborted).toBe(true);
    expect(onUpdate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetchVersion).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchVersion).toHaveBeenCalledTimes(2);
  });

  it('慢请求未完成时不会周期性堆积新请求', async () => {
    const pending = pendingRequest();
    fetchVersion.mockReturnValueOnce(pending.promise);
    start();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(fetchVersion).toHaveBeenCalledOnce();
    pending.resolve(response('build-B'));
    await vi.advanceTimersByTimeAsync(0);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('卸载时取消请求，迟到的响应不能提示或重新启动轮询', async () => {
    const pending = pendingRequest();
    fetchVersion.mockReturnValueOnce(pending.promise);
    start();
    const signal = fetchVersion.mock.calls[0]?.[1]?.signal;
    dispose?.();
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    pending.resolve(response('build-B'));
    visibility(false);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(fetchVersion).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('隐藏后忽略旧响应且保持暂停，切回立即检查', async () => {
    const pending = pendingRequest();
    fetchVersion.mockReturnValueOnce(pending.promise);
    start();
    const signal = fetchVersion.mock.calls[0]?.[1]?.signal;
    visibility(true);
    expect(signal?.aborted).toBe(true);
    pending.resolve(response('build-B'));
    await vi.advanceTimersByTimeAsync(180_000);
    expect(fetchVersion).toHaveBeenCalledOnce();
    expect(onUpdate).not.toHaveBeenCalled();
    visibility(false);
    expect(fetchVersion).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchVersion).toHaveBeenCalledTimes(3);
  });

  it('切回后的新请求不会被迟到的旧请求覆盖或额外创建定时器', async () => {
    const oldRequest = pendingRequest();
    const newRequest = pendingRequest();
    fetchVersion
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    start();
    visibility(true);
    visibility(false);
    oldRequest.resolve(response('build-B'));
    await vi.advanceTimersByTimeAsync(0);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    newRequest.resolve(response());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchVersion).toHaveBeenCalledTimes(3);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('初始为隐藏状态时不检查，首次切回立即检查', async () => {
    hidden = true;
    start();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(fetchVersion).not.toHaveBeenCalled();
    visibility(false);
    expect(fetchVersion).toHaveBeenCalledOnce();
  });

  it.each(['localhost', '127.0.0.1'])('本地地址 %s 不检查', (hostname) => {
    vi.stubGlobal('location', { hostname });
    start();
    visibility(false);
    expect(fetchVersion).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([0, -1])('检测间隔 %i 时不检查', (interval) => {
    start(interval);
    visibility(false);
    expect(fetchVersion).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('未内置构建标识时不以服务器版本建立错误的基线', () => {
    dispose = startUpdateChecker({
      buildId: undefined,
      intervalMinutes: 1,
      onUpdate,
      url: '/app-version.json',
    });
    expect(fetchVersion).not.toHaveBeenCalled();
  });
});
