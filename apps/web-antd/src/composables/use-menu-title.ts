import { computed, inject } from 'vue';
import { routeLocationKey } from 'vue-router';

/** 页面标题与接口生成的菜单元数据保持一致。 */
export function useMenuTitle() {
  const route = inject(routeLocationKey, undefined);
  return computed(() => String(route?.meta.title ?? ''));
}
