import type { RouteRecordRaw } from 'vue-router';

import type { LaunchTask, LaunchTaskPageParams } from '#/api';

import { computed } from 'vue';

import { useAccessStore, useUserStore } from '@vben/stores';

import { getLaunchTaskPageApi } from '#/api';

import {
  canAccessDrawingNode,
  canConfigureDrawing,
  getDrawingNode,
  isDrawingManager,
} from './nodes';

export interface DrawingTaskScope {
  flowNodeKey: string;
  currentAssigneeId?: string;
}
export function matchesDrawingScope(task: LaunchTask, scope: DrawingTaskScope) {
  return (
    task.currentNodeKey === scope.flowNodeKey &&
    (!scope.currentAssigneeId ||
      String(task.currentNodeAssigneeId ?? '') === scope.currentAssigneeId)
  );
}
export function useDrawingAccess() {
  const access = useAccessStore();
  const user = useUserStore();
  const manager = computed(() => isDrawingManager(access.accessCodes));
  const userId = computed(() =>
    user.userInfo?.userId ? String(user.userInfo.userId) : undefined,
  );
  const canVisit = (key: unknown) => {
    const node = getDrawingNode(key);
    return Boolean(node && canAccessDrawingNode(access.accessCodes, node.key));
  };
  function scopeFor(key: string): DrawingTaskScope {
    if (!canVisit(key) || (!manager.value && !userId.value))
      throw new Error('没有该制图环节的访问权限');
    return {
      flowNodeKey: key,
      currentAssigneeId: manager.value ? undefined : userId.value,
    };
  }
  return { manager, userId, canVisit, scopeFor };
}
export function filterDrawingRoutes(
  routes: RouteRecordRaw[],
  codes: string[],
): RouteRecordRaw[] {
  return routes.flatMap((route) => {
    if (route.meta?.drawingPermissionAdmin && !canConfigureDrawing(codes))
      return [];
    if (route.path === '/launch' && !isDrawingManager(codes)) return [];
    const node = getDrawingNode(route.meta?.drawingNodeKey);
    if (
      route.meta?.drawingNodeKey !== undefined &&
      (!node || !canAccessDrawingNode(codes, node.key))
    )
      return [];
    const children = route.children
      ? filterDrawingRoutes(route.children, codes)
      : undefined;
    if (route.path === '/drawing' && !children?.length) return [];
    return [{ ...route, ...(children ? { children } : {}) } as RouteRecordRaw];
  });
}
export async function getDrawingTaskPage(
  params: LaunchTaskPageParams,
  scope: DrawingTaskScope,
) {
  const enforcedScope = {
    ...scope,
    currentAssigneeId: scope.currentAssigneeId ?? params.currentAssigneeId,
  };
  const data = await getLaunchTaskPageApi({ ...params, ...enforcedScope });
  // Fail closed if the backend ignores either filter. Never display another employee's task.
  if (
    !data ||
    !Array.isArray(data.list) ||
    data.list.some(
      (task) =>
        !matchesDrawingScope(task, enforcedScope) ||
        ![1, 2, 4].includes(task.flowStatus),
    )
  )
    throw new Error('任务筛选结果异常，请刷新后重试');
  return data;
}
