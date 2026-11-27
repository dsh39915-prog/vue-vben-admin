import { createApp, watchEffect } from 'vue';

import { registerAccessDirective } from '@vben/access';
import { preferences } from '@vben/preferences';
import { initStores, setTimezoneHandler, useTimezoneStore } from '@vben/stores';
import '@vben/styles';
import '@vben/styles/antd';

import { useTitle } from '@vueuse/core';

import { getText } from '#/texts';

import { prepareBackendUI } from './adapter/backend-ui';
import App from './app.vue';
import { router } from './router';

async function bootstrap(namespace: string) {
  const app = createApp(App);

  // 配置 pinia-tore
  await initStores(app, { namespace });

  // 覆盖曾保存的其它时区，确保日期格式化统一使用上海时区。
  setTimezoneHandler({ getTimezone: async () => preferences.app.timezone });
  await useTimezoneStore().setTimezone(preferences.app.timezone);

  // 安装权限指令
  registerAccessDirective(app);

  // 配置路由及路由守卫
  router.beforeResolve(async (to) => {
    if (to.matched.some((record) => record.name === 'Root'))
      await prepareBackendUI(app);
  });
  app.use(router);

  // 动态更新标题
  watchEffect(() => {
    if (preferences.app.dynamicTitle) {
      const routeTitle = router.currentRoute.value.meta?.title;
      const pageTitle =
        (routeTitle ? `${getText(routeTitle)} - ` : '') + preferences.app.name;
      useTitle(pageTitle);
    }
  });

  app.mount('#app');
  try {
    // 首次刷新后台时保留启动提示，直到按需模块和页面准备完成。
    await router.isReady();
  } catch {
    // 路由错误已由独立恢复界面接管，仍需让 main 移除启动遮罩。
  }
}

export { bootstrap };
