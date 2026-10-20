<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';

import type { FlowAssignBatchParams, LaunchTask } from '#/api';

import { onMounted, onUnmounted, reactive, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Form,
  FormItem,
  message,
  Modal,
  Select,
  Table,
} from 'ant-design-vue';

import { assignFlowTasksBatchApi, getSimpleUserListApi } from '#/api';
import {
  getDrawingTaskPage,
  useDrawingAccess,
} from '#/features/drawing/access';

import {
  assignNodeKeys,
  canHandleTask,
  getWorkflowContext,
} from '../workflow-helpers';

const props = defineProps<{ nodeKey: string; tasks: LaunchTask[] }>();
const emit = defineEmits<{ close: []; changed: []; busy: [boolean] }>();
const access = useDrawingAccess();
const formRef = ref<FormInstance>();
const editor = reactive({ assigneeId: undefined as string | undefined });
const users = ref<{ value: string; label: string; name: string }[]>([]);
const loading = ref(false);
const usersFailed = ref(false);
const saving = ref(false);
const failure = ref('');
let active = true;
const columns = [
  { title: '款号', dataIndex: 'styleNo' },
  { title: '开发年份季节', dataIndex: 'productSeason' },
  { title: '品类', dataIndex: 'category' },
  { title: '当前处理人', dataIndex: 'currentNodeAssigneeName' },
];
async function loadUsers() {
  if (loading.value) return;
  loading.value = true;
  usersFailed.value = false;
  try {
    const data = await getSimpleUserListApi();
    if (!active) return;
    if (!Array.isArray(data)) throw new Error('处理人列表格式不正确');
    users.value = data
      .filter((u) => u.id !== undefined)
      .map((u) => ({
        value: String(u.id),
        name: u.nickname || u.username,
        label: `${u.nickname || u.username} (#${u.id})`,
      }));
  } catch {
    if (active) usersFailed.value = true;
  } finally {
    if (active) loading.value = false;
  }
}
async function verifyTasks(): Promise<FlowAssignBatchParams['tasks']> {
  if (!assignNodeKeys.includes(props.nodeKey) || !props.tasks.length)
    throw new Error('请选择当前分配节点的任务');
  const scope = access.scopeFor(props.nodeKey);
  const remaining = new Map(props.tasks.map((task) => [task.id, task]));
  const contexts: FlowAssignBatchParams['tasks'] = [];
  let pageNo = 1;
  while (remaining.size) {
    const page = await getDrawingTaskPage({ pageNo, pageSize: 200 }, scope);
    if (!active) throw new Error('操作已取消');
    for (const task of page.list) {
      const selected = remaining.get(task.id);
      if (!selected) continue;
      const context = getWorkflowContext(task);
      const previous = getWorkflowContext(selected);
      if (
        !canHandleTask(task) ||
        !context ||
        !previous ||
        context.nodeKey !== props.nodeKey ||
        context.nodeTaskId !== previous.nodeTaskId ||
        context.procInstId !== previous.procInstId
      )
        throw new Error('所选任务状态已变化，请刷新列表后重新选择');
      contexts.push({
        procInstId: context.procInstId,
        nodeTaskId: context.nodeTaskId,
      });
      remaining.delete(task.id);
    }
    if (!page.list.length || pageNo * 200 >= page.total) break;
    pageNo += 1;
  }
  if (remaining.size)
    throw new Error(
      '所选任务已流转、转派或不属于当前环节，请刷新列表后重新选择',
    );
  // Recheck permission immediately before the write request.
  const currentScope = access.scopeFor(props.nodeKey);
  if (currentScope.currentAssigneeId !== scope.currentAssigneeId)
    throw new Error('任务访问范围已变化，请刷新列表后重新选择');
  return contexts;
}
async function submit() {
  if (saving.value || loading.value || usersFailed.value) return;
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  if (saving.value || !active) return;
  const user = users.value.find((u) => u.value === editor.assigneeId);
  if (!user) {
    message.warning('请选择有效的处理人');
    return;
  }
  saving.value = true;
  failure.value = '';
  try {
    const tasks = await verifyTasks();
    if (!active) return;
    const completed = await assignFlowTasksBatchApi({
      nodeKey: props.nodeKey,
      tasks,
      unifiedAssigneeId: user.value,
      unifiedAssigneeName: user.name,
    });
    if (completed !== true)
      throw new Error('批量分配未确认成功，请刷新任务后确认状态');
    message.success('批量分配成功');
    emit('changed');
    emit('close');
  } catch (error) {
    if (active)
      failure.value =
        error instanceof Error
          ? error.message
          : '批量分配失败，请刷新任务后确认状态';
  } finally {
    saving.value = false;
  }
}
watch(saving, (value) => emit('busy', value), { flush: 'sync' });
onMounted(loadUsers);
onUnmounted(() => {
  active = false;
  emit('busy', false);
});
</script>
<template>
  <Modal
    open
    title="批量分配"
    :width="760"
    :confirm-loading="saving"
    :ok-button-props="{
      disabled: loading || saving || usersFailed || !tasks.length,
    }"
    :closable="!saving"
    :keyboard="!saving"
    :cancel-button-props="{ disabled: saving }"
    :mask-closable="false"
    ok-text="确认分配"
    cancel-text="取消"
    @ok="submit"
    @cancel="emit('close')"
  >
    <p class="mb-4">将选中的 {{ tasks.length }} 个任务统一分配给同一处理人。</p>
    <Table
      :columns="columns"
      :data-source="tasks"
      row-key="id"
      :pagination="false"
      size="small"
      class="mb-4!"
      :scroll="{ y: 260 }"
    />
    <Alert
      v-if="usersFailed"
      message="处理人列表加载失败，请重试"
      type="error"
      class="mb-4!"
    >
      <template #action>
        <Button :loading="loading" @click="loadUsers">
          <span>重试</span>
        </Button>
      </template>
    </Alert>
    <Alert v-if="failure" :message="failure" type="error" class="mb-4!" />
    <Form ref="formRef" :model="editor" layout="vertical" :disabled="saving">
      <FormItem
        label="处理人"
        name="assigneeId"
        :rules="[{ required: true, message: '请选择处理人' }]"
      >
        <Select
          v-model:value="editor.assigneeId"
          :options="users"
          :loading="loading"
          :disabled="loading || usersFailed || saving"
          show-search
          option-filter-prop="label"
          placeholder="请选择处理人"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
