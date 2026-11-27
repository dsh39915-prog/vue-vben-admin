import type { App } from 'vue';

const initialized = new WeakMap<App, Promise<void>>();

/** 登录表单使用原生 Ant Design Form，后台适配器仅在进入后台时初始化。 */
export function prepareBackendUI(app: App) {
  const current = initialized.get(app);
  if (current) return current;
  const pending = (async () => {
    const [components, form, loading, tippy, motion] = await Promise.all([
      import('./component'),
      import('./form'),
      import('@vben/common-ui/es/loading'),
      import('@vben/common-ui/es/tippy'),
      import('@vben/plugins/motion'),
    ]);
    await components.initComponentAdapter();
    await form.initSetupVbenForm();
    loading.registerLoadingDirective(app, {
      loading: 'loading',
      spinning: 'spinning',
    });
    tippy.initTippy(app);
    app.use(motion.MotionPlugin);
  })();
  initialized.set(app, pending);
  void pending.catch(() => {
    if (initialized.get(app) === pending) initialized.delete(app);
  });
  return pending;
}
