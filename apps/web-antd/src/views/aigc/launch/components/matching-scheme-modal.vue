<script setup lang="ts">
import type { LaunchTask } from '#/api';

import { computed, onUnmounted, ref } from 'vue';

import { Alert, Button, Modal, Spin } from 'ant-design-vue';

import { getLaunchTaskApi } from '#/api';
import {
  getDrawingTaskPage,
  useDrawingAccess,
} from '#/features/drawing/access';

import { canHandleTask, getWorkflowContext } from '../workflow-helpers';
import MatchingSchemes from './matching-schemes.vue';

const props = defineProps<{ task: LaunchTask }>();
const emit = defineEmits<{
  close: [];
  changed: [];
  submitted: [];
  busy: [boolean];
}>();
const access = useDrawingAccess();
const loadedTask = ref<LaunchTask>();
const loading = ref(false);
const failed = ref('');
const busy = ref(false);
const context = computed(() => getWorkflowContext(loadedTask.value));
const editable = computed(() =>
  Boolean(loadedTask.value && canHandleTask(loadedTask.value)),
);
let active = true;

async function scopedTask() {
  const scope = access.scopeFor('aiMatchingOutput');
  for (let pageNo = 1; ; pageNo++) {
    const page = await getDrawingTaskPage({ pageNo, pageSize: 200 }, scope);
    const found = page.list.find((row) => row.id === props.task.id);
    if (found) return found;
    if (!page.list.length || pageNo * 200 >= page.total) break;
  }
  throw new Error(
    '任务已流转、未分配给你或不属于当前环节，请关闭窗口并刷新列表',
  );
}
async function load() {
  loading.value = true;
  failed.value = '';
  loadedTask.value = undefined;
  try {
    // Check node/assignee before loading task details or materials.
    const flow = await scopedTask();
    const details = await getLaunchTaskApi(flow.id);
    if (!details) throw new Error('任务不存在，请关闭窗口并刷新列表');
    if (active) loadedTask.value = { ...details, ...flow };
  } catch (error) {
    if (active)
      failed.value =
        error instanceof Error ? error.message : '任务加载失败，请重试';
  } finally {
    if (active) loading.value = false;
  }
}
async function beforeSave() {
  try {
    const current = await scopedTask();
    const next = getWorkflowContext(current);
    const previous = context.value;
    if (
      !active ||
      !previous ||
      !canHandleTask(current) ||
      next?.procInstId !== previous.procInstId ||
      next?.nodeTaskId !== previous.nodeTaskId ||
      next?.nodeKey !== previous.nodeKey
    )
      throw new Error('任务状态或节点已变化，请关闭窗口并刷新列表后重试');
  } catch (error) {
    failed.value =
      error instanceof Error ? error.message : '任务状态核验失败，请重试';
    throw error;
  }
}
function setBusy(value: boolean) {
  busy.value = value;
  emit('busy', value);
}
onUnmounted(() => {
  active = false;
  emit('busy', false);
});
void load();
</script>

<template>
  <Modal
    open
    :title="editable ? 'AI搭配方案提交' : 'AI搭配方案查看'"
    :width="1440"
    :style="{ top: '24px', maxWidth: 'calc(100vw - 32px)' }"
    :body-style="{ maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }"
    :footer="null"
    :closable="!busy"
    :keyboard="!busy"
    :mask-closable="false"
    @cancel="!busy && emit('close')"
  >
    <Spin :spinning="loading">
      <Alert v-if="failed" :message="failed" type="error" class="mb-4!">
        <template v-if="!loadedTask" #action>
          <Button :disabled="loading" @click="load">
            <span>重试</span>
          </Button>
        </template>
      </Alert>
      <template v-if="loadedTask">
        <p>
          任务款号：{{ loadedTask.styleNo }} · {{ loadedTask.currentNodeName }}
        </p>
        <MatchingSchemes
          :task="loadedTask"
          :context="context"
          :editable="editable && !failed"
          :before-save="beforeSave"
          @busy="setBusy"
          @changed="emit('changed')"
          @submitted="emit('submitted')"
        />
      </template>
    </Spin>
  </Modal>
</template>
