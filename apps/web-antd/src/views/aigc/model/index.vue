<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';

import type { AiModelPageParams, AiModelSaveParams } from '#/api';

import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  createAiModelApi,
  deleteAiModelApi,
  disableAiModelsApi,
  enableAiModelsApi,
  getAiModelApi,
  getAiModelPageApi,
  testAiModelConnectionApi,
  updateAiModelApi,
} from '#/api';

import { useAigcPage } from '../common/use-page';

const query = reactive<Omit<AiModelPageParams, 'page' | 'pageSize'>>({});
const {
  rows,
  loading,
  pagination,
  load,
  search: searchPage,
  change,
} = useAigcPage(getAiModelPageApi, { ...query });
const selectedKeys = ref<number[]>([]);
const busy = ref(false);
const submittingTests = ref<number[]>([]);
const hasTestingModels = computed(() =>
  rows.value.some((item) => item.testStatus === 1),
);
let active = false;
let timer: number | undefined;
const detailLoading = ref(false);
const editorOpen = ref(false);
const readOnly = ref(false);
const formRef = ref<FormInstance>();
const editor = reactive<AiModelSaveParams>({
  modelName: '',
  modelCode: '',
  modelType: 0,
  providerId: 1,
  status: 1,
});
const modelTypes = [
  { label: '图片模型', value: 0 },
  { label: '视频模型', value: 1 },
];
const statuses = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 },
];
const testStatuses: Record<number, { color: string; label: string }> = {
  0: { label: '未测试', color: 'default' },
  1: { label: '测试中', color: 'processing' },
  2: { label: '测试成功', color: 'success' },
  3: { label: '测试失败', color: 'error' },
};
const editorTitle = computed(() =>
  readOnly.value
    ? '模型详情'
    : editor.id === undefined
      ? '新增模型'
      : '编辑模型',
);
const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '模型名称', dataIndex: 'modelName', width: 200 },
  { title: '模型编码', dataIndex: 'modelCode', width: 240 },
  { title: '类型', key: 'modelType', width: 100 },
  { title: '服务商 ID', dataIndex: 'providerId', width: 110 },
  { title: '接口地址', dataIndex: 'apiUrl', ellipsis: true, width: 240 },
  { title: '状态', key: 'status', width: 90 },
  { title: '测试状态', key: 'testStatus', width: 120 },
  { title: '调用结果', key: 'result', width: 360 },
  { title: '更新时间', key: 'updateTime', width: 180 },
  { title: '操作', key: 'action', fixed: 'right' as const, width: 330 },
];

function search() {
  selectedKeys.value = [];
  return searchPage({
    ...query,
    modelName: query.modelName?.trim() || undefined,
  });
}
function reset() {
  Object.assign(query, {
    modelName: undefined,
    modelType: undefined,
    providerId: undefined,
    status: undefined,
  });
  void search();
}
async function openEditor(id?: number, view = false) {
  if (busy.value || detailLoading.value) return;
  detailLoading.value = true;
  try {
    const data = id === undefined ? undefined : await getAiModelApi(id);
    if (data === null) {
      message.warning('该模型不存在，请刷新列表');
      return;
    }
    Object.assign(editor, {
      id: data?.id,
      modelName: data?.modelName ?? '',
      modelCode: data?.modelCode ?? '',
      modelType: data?.modelType ?? 0,
      providerId: data?.providerId ?? 1,
      status: data?.status ?? 1,
      apiUrl: data?.apiUrl ?? '',
      apiKey: data?.apiKey ?? '',
      ak: data?.ak ?? '',
      sk: data?.sk ?? '',
    });
    readOnly.value = view;
    formRef.value?.clearValidate();
    editorOpen.value = true;
  } catch {
    /* The request interceptor displays errors. */
  } finally {
    detailLoading.value = false;
  }
}
async function save() {
  if (busy.value) return;
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  busy.value = true;
  try {
    const data = {
      ...editor,
      modelName: editor.modelName.trim(),
      modelCode: editor.modelCode.trim(),
    };
    if (editor.id === undefined) {
      delete data.id;
      await createAiModelApi(data);
    } else await updateAiModelApi({ ...data, id: editor.id });
    message.success('保存成功');
    editorOpen.value = false;
    selectedKeys.value = [];
    await load();
  } catch {
    /* Keep the form open on failure. */
  } finally {
    busy.value = false;
  }
}
async function setStatus(ids: number[], enabled: boolean) {
  if (busy.value || ids.length === 0) return;
  busy.value = true;
  try {
    await (enabled ? enableAiModelsApi(ids) : disableAiModelsApi(ids));
    message.success(enabled ? '启用成功' : '停用成功');
    selectedKeys.value = [];
    await load();
  } catch {
    /* The request interceptor displays errors. */
  } finally {
    busy.value = false;
  }
}
async function remove(id: number) {
  if (busy.value) return;
  busy.value = true;
  try {
    await deleteAiModelApi(id);
    message.success('删除成功');
    selectedKeys.value = [];
    await load();
  } catch {
    /* The request interceptor displays errors. */
  } finally {
    busy.value = false;
  }
}
async function testConnection(id: number) {
  const record = rows.value.find((item) => item.id === id);
  if (
    busy.value ||
    !record ||
    record.testStatus === 1 ||
    submittingTests.value.includes(id)
  )
    return;
  submittingTests.value = [...submittingTests.value, id];
  try {
    await testAiModelConnectionApi(id);
    rows.value = rows.value.map((item) =>
      item.id === id ? { ...item, testStatus: 1, result: undefined } : item,
    );
    message.success('测试已提交，请在列表中查看测试状态和调用结果');
  } catch {
    /* The request interceptor displays errors. */
  } finally {
    submittingTests.value = submittingTests.value.filter((item) => item !== id);
  }
}
function stopTimer() {
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
}
function schedule() {
  stopTimer();
  if (!active || !hasTestingModels.value) return;
  timer = window.setTimeout(async () => {
    if (active && !document.hidden && !loading.value && !busy.value) {
      await load();
    }
    schedule();
  }, 3000);
}
watch(hasTestingModels, schedule);
onMounted(() => {
  active = true;
  void load();
  schedule();
});
onActivated(() => {
  if (!active) {
    active = true;
    void load();
    schedule();
  }
});
onDeactivated(() => {
  active = false;
  stopTimer();
});
onUnmounted(() => {
  active = false;
  stopTimer();
});
</script>
<template>
  <Page
    title="AI 模型管理"
    description="维护图片和视频模型、连接参数与启用状态"
  >
    <Card class="mb-4!" :bordered="false">
      <Form :model="query" layout="inline" @finish="search">
        <FormItem label="模型名称">
          <Input
            v-model:value="query.modelName"
            allow-clear
            placeholder="请输入模型名称"
          />
        </FormItem>
        <FormItem label="模型类型">
          <Select
            v-model:value="query.modelType"
            :options="modelTypes"
            allow-clear
            placeholder="全部类型"
            style="width: 140px"
          />
        </FormItem>
        <FormItem label="服务商 ID">
          <InputNumber
            v-model:value="query.providerId"
            :min="1"
            :precision="0"
          />
        </FormItem>
        <FormItem label="状态">
          <Select
            v-model:value="query.status"
            :options="statuses"
            allow-clear
            placeholder="全部状态"
            style="width: 120px"
          />
        </FormItem>
        <FormItem>
          <Space>
            <Button type="primary" html-type="submit">
              <span>查询</span>
            </Button>
            <Button @click="reset">
              <span>重置</span>
            </Button>
          </Space>
        </FormItem>
      </Form>
    </Card>
    <Card title="模型列表" :bordered="false">
      <template #extra>
        <Space>
          <Button :loading="loading" :disabled="busy" @click="load">
            <span>刷新</span>
          </Button>
          <Button
            type="primary"
            :disabled="busy || detailLoading"
            @click="openEditor()"
          >
            <span>新增模型</span>
          </Button>
        </Space>
      </template>
      <Space class="mb-4">
        <Button
          :disabled="busy || selectedKeys.length === 0"
          @click="setStatus(selectedKeys, true)"
        >
          <span>批量启用</span>
        </Button>
        <Popconfirm
          title="确定停用选中的模型？"
          :disabled="busy || selectedKeys.length === 0"
          @confirm="setStatus(selectedKeys, false)"
        >
          <Button :disabled="busy || selectedKeys.length === 0">
            <span>批量停用</span>
          </Button>
        </Popconfirm>
      </Space>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 2150 }"
        row-key="id"
        :row-selection="{
          selectedRowKeys: selectedKeys,
          onChange: (keys) => (selectedKeys = keys.map(Number)),
          getCheckboxProps: () => ({ disabled: busy }),
        }"
        @change="
          (page) => {
            selectedKeys = [];
            change(page);
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'modelType'">
            {{ record.modelType === 0 ? '图片模型' : '视频模型' }}
          </template>
          <Tag
            v-else-if="column.key === 'status'"
            :color="record.status === 1 ? 'success' : 'default'"
          >
            <span>{{ record.status === 1 ? '启用' : '禁用' }}</span>
          </Tag>
          <Tag
            v-else-if="column.key === 'testStatus'"
            :color="testStatuses[record.testStatus ?? 0]?.color ?? 'default'"
          >
            <span>{{
              testStatuses[record.testStatus ?? 0]?.label ?? '-'
            }}</span>
          </Tag>
          <Tooltip
            v-else-if="column.key === 'result'"
            :title="record.result"
            :overlay-style="{ maxWidth: '600px' }"
            placement="topLeft"
          >
            <span class="block truncate">{{ record.result || '-' }}</span>
          </Tooltip>
          <template v-else-if="column.key === 'updateTime'">
            {{
              record.updateTime
                ? dayjs(record.updateTime).format('YYYY-MM-DD HH:mm:ss')
                : '-'
            }}
          </template>
          <Space v-else-if="column.key === 'action'" :size="0">
            <Button
              type="link"
              size="small"
              :disabled="busy || detailLoading"
              @click="openEditor(record.id, true)"
            >
              <span>详情</span>
            </Button>
            <Button
              type="link"
              size="small"
              :disabled="busy || detailLoading"
              @click="openEditor(record.id)"
            >
              <span>编辑</span>
            </Button>
            <Button
              type="link"
              size="small"
              :loading="
                submittingTests.includes(record.id) || record.testStatus === 1
              "
              :disabled="
                busy ||
                submittingTests.includes(record.id) ||
                record.testStatus === 1
              "
              @click="testConnection(record.id)"
            >
              <span>{{ record.testStatus === 1 ? '测试中' : '测试连接' }}</span>
            </Button>
            <Popconfirm
              :title="
                record.status === 1 ? '确定停用该模型？' : '确定启用该模型？'
              "
              @confirm="setStatus([record.id], record.status !== 1)"
            >
              <Button type="link" size="small" :disabled="busy">
                <span>{{ record.status === 1 ? '停用' : '启用' }}</span>
              </Button>
            </Popconfirm>
            <Popconfirm title="确定删除该模型？" @confirm="remove(record.id)">
              <Button type="link" size="small" danger :disabled="busy">
                <span>删除</span>
              </Button>
            </Popconfirm>
          </Space>
        </template>
      </Table>
    </Card>
    <Modal
      v-model:open="editorOpen"
      :title="editorTitle"
      :width="640"
      :footer="readOnly ? null : undefined"
      :confirm-loading="busy"
      :mask-closable="false"
      :closable="!busy"
      :keyboard="!busy"
      :cancel-button-props="{ disabled: busy }"
      ok-text="保存"
      cancel-text="取消"
      @ok="save"
    >
      <Form
        ref="formRef"
        :model="editor"
        layout="vertical"
        :disabled="readOnly || busy"
      >
        <FormItem
          label="模型名称"
          name="modelName"
          :rules="[
            { required: true, whitespace: true, message: '请输入模型名称' },
          ]"
        >
          <Input
            v-model:value="editor.modelName"
            placeholder="请输入模型名称"
          />
        </FormItem>
        <FormItem
          label="模型编码"
          name="modelCode"
          :rules="[
            { required: true, whitespace: true, message: '请输入模型编码' },
          ]"
        >
          <Input
            v-model:value="editor.modelCode"
            placeholder="请输入模型编码"
          />
        </FormItem>
        <FormItem
          label="模型类型"
          name="modelType"
          :rules="[{ required: true }]"
        >
          <Select v-model:value="editor.modelType" :options="modelTypes" />
        </FormItem>
        <FormItem
          label="服务商 ID"
          name="providerId"
          :rules="[{ required: true, message: '请输入服务商 ID' }]"
        >
          <InputNumber
            v-model:value="editor.providerId"
            :min="1"
            :precision="0"
            style="width: 100%"
          />
        </FormItem>
        <FormItem label="接口地址" name="apiUrl">
          <Input v-model:value="editor.apiUrl" placeholder="请输入接口地址" />
        </FormItem>
        <FormItem label="API Key" name="apiKey">
          <Input.Password
            v-model:value="editor.apiKey"
            placeholder="请输入 API Key"
            autocomplete="new-password"
          />
        </FormItem>
        <FormItem label="AK" name="ak">
          <Input.Password
            v-model:value="editor.ak"
            placeholder="请输入 AK"
            autocomplete="new-password"
          />
        </FormItem>
        <FormItem label="SK" name="sk">
          <Input.Password
            v-model:value="editor.sk"
            placeholder="请输入 SK"
            autocomplete="new-password"
          />
        </FormItem>
        <FormItem label="状态" name="status" :rules="[{ required: true }]">
          <Select v-model:value="editor.status" :options="statuses" />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
