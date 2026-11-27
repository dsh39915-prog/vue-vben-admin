import { shallowRef } from 'vue';

/** 保留失败目标供用户重载；错误视图不依赖任何懒加载业务组件。 */
export const navigationFailure = shallowRef<{ fullPath: string }>();

export function clearNavigationFailure() {
  navigationFailure.value = undefined;
}
