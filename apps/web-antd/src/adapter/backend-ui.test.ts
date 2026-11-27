import { createApp } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prepareBackendUI } from './backend-ui';

const setup = vi.hoisted(() => ({
  components: vi.fn(),
  form: vi.fn(),
  loading: vi.fn(),
  tippy: vi.fn(),
  motion: { install: vi.fn() },
}));
vi.mock('./component', () => ({ initComponentAdapter: setup.components }));
vi.mock('./form', () => ({ initSetupVbenForm: setup.form }));
vi.mock('@vben/common-ui/es/loading', () => ({
  registerLoadingDirective: setup.loading,
}));
vi.mock('@vben/common-ui/es/tippy', () => ({ initTippy: setup.tippy }));
vi.mock('@vben/plugins/motion', () => ({ MotionPlugin: setup.motion }));
beforeEach(() => vi.resetAllMocks());
function createTestApp() {
  return createApp({});
}
describe('后台 UI 按需初始化', () => {
  it('并发导航仅初始化一次，组件和表单配置完成后才允许进入后台', async () => {
    const app = createTestApp();
    let finish: (() => void) | undefined;
    setup.components.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const first = prepareBackendUI(app);
    const second = prepareBackendUI(app);
    expect(second).toBe(first);
    await vi.waitFor(() => expect(setup.components).toHaveBeenCalledOnce());
    expect(setup.form).not.toHaveBeenCalled();
    finish?.();
    await Promise.all([first, second]);
    await prepareBackendUI(app);
    expect(setup.form).toHaveBeenCalledOnce();
    expect(setup.loading).toHaveBeenCalledExactlyOnceWith(app, {
      loading: 'loading',
      spinning: 'spinning',
    });
    expect(setup.tippy).toHaveBeenCalledExactlyOnceWith(app);
    expect(setup.motion.install).toHaveBeenCalledOnce();
  });
  it('初始化失败可重试，并且不同应用实例相互独立', async () => {
    const app = createTestApp();
    setup.components.mockRejectedValueOnce(new Error('offline'));
    await expect(prepareBackendUI(app)).rejects.toThrow('offline');
    await prepareBackendUI(app);
    await prepareBackendUI(createTestApp());
    expect(setup.components).toHaveBeenCalledTimes(3);
    expect(setup.form).toHaveBeenCalledTimes(2);
  });
});
