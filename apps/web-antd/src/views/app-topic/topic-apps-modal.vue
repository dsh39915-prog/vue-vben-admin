<script setup lang="ts">
import type { FormInstance, TableColumnsType } from 'ant-design-vue';
import type { TableRowSelection } from 'ant-design-vue/es/table/interface';

import type { AppTopic, AppTopicApp } from '#/api';

import { computed, nextTick, reactive, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
} from 'ant-design-vue';

import {
  getAppTopicAppsApi,
  removeAppTopicAppsApi,
  updateAppTopicAppApi,
} from '#/api';

import CandidateAppsPanel from './candidate-apps-panel.vue';
import { validId, validOrder } from './data';
import { useTopicPage } from './use-topic-page';

const props = defineProps<{
  open: boolean;
  topic?: Pick<AppTopic, 'id' | 'name' | 'platform'>;
}>();
const emit = defineEmits<{ changed: []; 'update:open': [value: boolean] }>();
const working = ref(false);
const candidateWorking = ref(false);
const candidateRevision = ref(0);
const editorOpen = ref(false);
const filtersHost = ref<HTMLElement>();
const {
  cancel,
  change,
  failed,
  load,
  loading,
  pagination,
  records,
  selectedIds,
} = useTopicPage(
  (page, pageSize) => {
    const sid = props.topic?.id;
    if (!validId(sid)) throw new Error('请选择有效专题');
    return getAppTopicAppsApi({ sid, page, pageSize });
  },
  () => working.value || candidateWorking.value || editorOpen.value,
);
const disabled = computed(
  () =>
    loading.value ||
    failed.value ||
    working.value ||
    candidateWorking.value ||
    editorOpen.value,
);
const columns: TableColumnsType<AppTopicApp> = [
  { dataIndex: 'id', title: '关联记录 ID', width: 130 },
  { dataIndex: 'sid', title: '专题 ID', width: 110 },
  { dataIndex: 'appId', title: '应用 ID', width: 110 },
  { dataIndex: 'appName', title: '专题内应用名称', width: 250, ellipsis: true },
  { dataIndex: 'remd', title: '排序位置', width: 110 },
  { key: 'action', title: '操作', width: 150, fixed: 'right' },
];
const rowSelection = computed<TableRowSelection<AppTopicApp>>(() => ({
  selectedRowKeys: selectedIds.value,
  onChange: (keys) => {
    selectedIds.value = keys.map(Number);
  },
  getCheckboxProps: (record) => ({
    disabled: disabled.value || !validId(record.id),
  }),
}));
async function remove(ids: number[]) {
  const sid = props.topic?.id;
  if (
    disabled.value ||
    !validId(sid) ||
    ids.length === 0 ||
    !ids.every((id) => validId(id))
  )
    return;
  working.value = true;
  try {
    const success = await removeAppTopicAppsApi([...ids]);
    if (!props.open || sid !== props.topic?.id) return;
    if (!success) {
      message.error('专题应用移除失败，请重试');
      return;
    }
    message.success('专题应用已移除');
    emit('changed');
    candidateRevision.value += 1;
    await load();
  } catch {
    /* 保留选择供重试。 */
  } finally {
    working.value = false;
  }
}
const selectedId = ref<number>();
const form = reactive({ appName: '', remd: undefined as number | undefined });
const formRef = ref<FormInstance>();
async function edit(record: AppTopicApp) {
  if (disabled.value || !validId(record.id)) return;
  selectedId.value = record.id;
  Object.assign(form, {
    appName: record.appName ?? '',
    remd: record.remd ?? undefined,
  });
  editorOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}
async function save() {
  const id = selectedId.value;
  const sid = props.topic?.id;
  if (working.value || !validId(id) || !validId(sid) || !formRef.value) return;
  working.value = true;
  try {
    await formRef.value.validate();
    if (form.remd === undefined) return;
    const success = await updateAppTopicAppApi({
      id,
      appName: form.appName.trim(),
      remd: form.remd,
    });
    if (!props.open || sid !== props.topic?.id) return;
    if (!success) {
      message.error('专题应用保存失败，请重试');
      return;
    }
    message.success('专题应用已保存');
    editorOpen.value = false;
    emit('changed');
    await load();
  } catch {
    /* 保留表单供重试。 */
  } finally {
    working.value = false;
  }
}
function close() {
  if (!working.value && !candidateWorking.value && !editorOpen.value)
    emit('update:open', false);
}
function added() {
  emit('changed');
  void load();
}
watch(
  () => [props.open, props.topic?.id] as const,
  ([open, sid]) => {
    cancel();
    editorOpen.value = false;
    records.value = [];
    Object.assign(pagination, { current: 1, pageSize: 20, total: 0 });
    if (open && validId(sid)) void load(1);
  },
  { immediate: true },
);
</script>

<template>
  <Modal
    :open="open"
    :title="`专题应用：${topic?.name ?? ''}`"
    :width="1800"
    :style="{ top: '24px', maxWidth: 'calc(100vw - 32px)' }"
    :closable="!working && !candidateWorking && !editorOpen"
    :keyboard="!working && !candidateWorking && !editorOpen"
    :mask-closable="false"
    @cancel="close"
  >
    <div ref="filtersHost"></div>
    <Alert
      v-if="failed"
      class="mb-4"
      message="专题应用加载失败，请刷新重试"
      type="error"
      show-icon
    />
    <div class="topic-apps-layout">
      <section class="topic-apps-pane" aria-label="当前专题应用">
        <div class="topic-apps-pane-header">
          <h3 class="text-base font-medium">当前专题应用</h3>
          <Space :size="8">
            <Button
              size="small"
              :loading="loading"
              :disabled="working || candidateWorking || editorOpen"
              @click="load()"
            >
              刷新应用
            </Button>
            <Popconfirm
              :title="`确定移除选中的 ${selectedIds.length} 个应用吗？`"
              ok-text="移除"
              cancel-text="取消"
              :disabled="disabled || selectedIds.length === 0"
              @confirm="remove(selectedIds)"
            >
              <Button
                size="small"
                danger
                :disabled="disabled || selectedIds.length === 0"
              >
                移除选中（{{ selectedIds.length }}）
              </Button>
            </Popconfirm>
          </Space>
        </div>
        <Table
          :columns="columns"
          :data-source="records"
          :loading="loading"
          :row-selection="rowSelection"
          row-key="id"
          :scroll="{ x: 900 }"
          :pagination="{
            ...pagination,
            disabled,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            showTotal: (total) => `共 ${total} 条`,
          }"
          @change="change"
        >
          <template #bodyCell="{ column, record, text }">
            <Space v-if="column.key === 'action'" :size="0">
              <Button
                type="link"
                size="small"
                :disabled="disabled"
                @click="edit(record as AppTopicApp)"
              >
                编辑应用
              </Button>
              <Popconfirm
                :title="`确定移除「${record.appName ?? record.appId}」吗？`"
                ok-text="移除"
                cancel-text="取消"
                :disabled="disabled"
                @confirm="remove([record.id])"
              >
                <Button type="link" size="small" danger :disabled="disabled">
                  移除
                </Button>
              </Popconfirm>
            </Space>
            <template v-else>{{ text ?? '—' }}</template>
          </template>
        </Table>
      </section>
      <CandidateAppsPanel
        class="topic-apps-pane topic-apps-candidates"
        :open="open"
        :topic="topic"
        :disabled="working || editorOpen"
        :revision="candidateRevision"
        :filter-target="filtersHost"
        @busy="candidateWorking = $event"
        @added="added"
      />
    </div>
    <template #footer>
      <Button
        :disabled="working || candidateWorking || editorOpen"
        @click="close"
      >
        关闭
      </Button>
    </template>
  </Modal>
  <Modal
    :open="editorOpen"
    title="编辑专题应用"
    :width="560"
    :closable="!working"
    :keyboard="!working"
    :mask-closable="false"
    @cancel="editorOpen = false"
  >
    <Form
      ref="formRef"
      name="app-topic-member-editor"
      :model="form"
      :disabled="working"
      layout="vertical"
    >
      <FormItem
        label="专题内应用名称"
        name="appName"
        :rules="[
          { required: true, whitespace: true, message: '请输入应用名称' },
        ]"
      >
        <Input v-model:value="form.appName" />
      </FormItem>
      <FormItem
        label="排序位置"
        name="remd"
        :rules="[{ validator: validOrder }]"
      >
        <InputNumber
          v-model:value="form.remd"
          :min="0"
          :max="2147483647"
          :precision="0"
          class="w-full"
        />
      </FormItem>
    </Form>
    <template #footer>
      <Button :disabled="working" @click="editorOpen = false"> 取消 </Button>
      <Button type="primary" :loading="working" @click="save">
        保存应用
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.topic-apps-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  width: 100%;
  min-width: 0;
}

.topic-apps-pane {
  flex: 1 1 0%;
  width: 0;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgb(128 128 128 / 25%);
  border-radius: 8px;
}

.topic-apps-candidates {
  flex-grow: 1.2;
}

.topic-apps-layout :deep(.topic-apps-pane-header) {
  box-sizing: border-box;
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 12px;
  overflow-x: auto;
  white-space: nowrap;
  background: rgb(128 128 128 / 8%);
  border-bottom: 1px solid rgb(128 128 128 / 25%);
}

.topic-apps-layout :deep(.topic-apps-pane-header h3),
.topic-apps-layout :deep(.topic-apps-pane-header .ant-space) {
  flex-shrink: 0;
}

.topic-apps-layout :deep(.ant-table-wrapper) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.topic-apps-layout :deep(.ant-table-thead > tr > th) {
  white-space: nowrap;
}

.topic-apps-layout :deep(.ant-table-pagination) {
  margin: 12px;
}
</style>
