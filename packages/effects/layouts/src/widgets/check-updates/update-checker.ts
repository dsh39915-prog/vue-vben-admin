interface UpdateCheckerOptions {
  buildId: string | undefined;
  intervalMinutes: number;
  onUpdate: () => void;
  url: string;
}

/** 启动检查并返回清理函数；每次检查结束后才安排下一次。 */
export function startUpdateChecker(options: UpdateCheckerOptions): () => void {
  if (
    !options.buildId ||
    !Number.isFinite(options.intervalMinutes) ||
    options.intervalMinutes <= 0 ||
    ['127.0.0.1', 'localhost'].includes(location.hostname)
  ) {
    return () => {};
  }

  let disposed = false;
  let notified = false;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function canCheck() {
    return !disposed && !notified && !document.hidden;
  }

  function stop() {
    clearTimeout(timer);
    timer = undefined;
    controller?.abort();
    controller = undefined;
  }

  async function check() {
    if (!canCheck() || controller) {
      return;
    }

    const requestController = new AbortController();
    controller = requestController;
    const timeout = setTimeout(() => requestController.abort(), 10_000);
    requestController.signal.addEventListener(
      'abort',
      () => clearTimeout(timeout),
      { once: true },
    );

    try {
      const response = await fetch(options.url, {
        cache: 'no-store',
        redirect: 'error',
        signal: requestController.signal,
      });
      if (!response.ok) {
        return;
      }

      const version: unknown = await response.json();
      if (
        !canCheck() ||
        requestController.signal.aborted ||
        !version ||
        typeof version !== 'object' ||
        !('buildId' in version) ||
        typeof version.buildId !== 'string' ||
        !version.buildId.trim()
      ) {
        return;
      }

      if (version.buildId !== options.buildId) {
        notified = true;
        options.onUpdate();
      }
    } catch {
      // 网络异常、取消或无效版本文件不提示更新，下一周期重试。
    } finally {
      clearTimeout(timeout);
      // 旧请求结束后不能覆盖切回页面时创建的新请求，也不能恢复已停止的轮询。
      if (controller === requestController) {
        controller = undefined;
        if (canCheck()) {
          timer = setTimeout(
            () => void check(),
            options.intervalMinutes * 60_000,
          );
        }
      }
    }
  }

  function handleVisibilityChange() {
    stop();
    if (canCheck()) {
      void check();
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  void check();

  return () => {
    disposed = true;
    stop();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
