import type { LaunchTask } from '#/api';
import type { DrawingTaskScope } from '#/features/drawing/access';

import { computed, onUnmounted, ref, watch } from 'vue';
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRoute,
  useRouter,
} from 'vue-router';

import { message } from 'ant-design-vue';

import { getLaunchTaskApi, getLaunchTaskPageApi } from '#/api';
import { getDrawingTaskPage } from '#/features/drawing/access';

import { getWorkflowContext } from './workflow-helpers';

export function useLaunchTask(
  isBusy: () => boolean,
  getScope?: () => DrawingTaskScope,
) {
  const route = useRoute();
  const router = useRouter();
  const task = ref<LaunchTask>();
  const loading = ref(false);
  const failed = ref('');
  const metadataFailed = ref(false);
  const pickerOpen = ref(false);
  let latest = 0;
  const context = computed(() => getWorkflowContext(task.value));
  async function load() {
    const request = ++latest;
    const raw = route.query.taskId;
    task.value = undefined;
    failed.value = '';
    metadataFailed.value = false;
    loading.value = false;
    if (raw === undefined) return;
    const id = typeof raw === 'string' ? Number(raw) : Number.NaN;
    if (!Number.isSafeInteger(id) || id <= 0) {
      failed.value = '任务 ID 不正确，请重新选择任务';
      return;
    }
    loading.value = true;
    try {
      let flow: LaunchTask | undefined;
      let data: LaunchTask | null;
      if (getScope) {
        const scope = getScope();
        let pageNo = 1;
        let hasMore = true;
        while (!flow && hasMore) {
          const page = await getDrawingTaskPage(
            { pageNo, pageSize: 200 },
            scope,
          );
          if (request !== latest) return;
          flow = page.list.find((item) => item.id === id);
          hasMore = page.list.length > 0 && pageNo * 200 < page.total;
          pageNo += 1;
        }
        if (!flow) {
          failed.value =
            '任务已流转、未分配给你或不属于当前环节，请返回任务列表刷新';
          return;
        }
        // Verify node and assignee before requesting details or loading any task attachments.
        data = await getLaunchTaskApi(id);
      } else {
        data = await getLaunchTaskApi(id);
        if (request !== latest) return;
        if (data?.styleNo) {
          try {
            let pageNo = 1;
            let hasMore = true;
            while (!flow && hasMore) {
              const page = await getLaunchTaskPageApi({
                pageNo,
                pageSize: 200,
                styleNo: data.styleNo,
              });
              if (request !== latest) return;
              flow = page.list.find((item) => item.id === id);
              hasMore = page.list.length > 0 && pageNo * 200 < page.total;
              pageNo += 1;
            }
          } catch {
            if (request === latest) metadataFailed.value = true;
          }
        }
        if (!flow && request === latest) metadataFailed.value = true;
      }
      if (request !== latest) return;
      if (!data) {
        failed.value = '任务不存在，请重新选择任务';
        return;
      }
      task.value = { ...data, ...flow };
    } catch (error) {
      if (request === latest) {
        failed.value =
          getScope && error instanceof Error
            ? error.message
            : '任务加载失败，请重试';
        task.value = undefined;
      }
    } finally {
      if (request === latest) loading.value = false;
    }
  }
  function choose(selected: LaunchTask) {
    pickerOpen.value = false;
    return router.replace({
      query: { ...route.query, taskId: String(selected.id) },
    });
  }
  function guard() {
    if (isBusy()) {
      message.warning('正在处理请求，请完成后再切换任务');
      return false;
    }
    return true;
  }
  onBeforeRouteLeave(guard);
  onBeforeRouteUpdate(guard);
  watch(
    () => [route.query.taskId, route.meta.drawingNodeKey],
    () => {
      void load();
    },
    { immediate: true },
  );
  onUnmounted(() => {
    latest += 1;
  });
  return {
    task,
    context,
    loading,
    failed,
    metadataFailed,
    pickerOpen,
    load,
    choose,
    router,
  };
}
