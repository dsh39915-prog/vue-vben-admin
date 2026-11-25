<script setup lang="ts">
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { SorterResult } from 'ant-design-vue/es/table/interface';

import type { AppType, AppTypeOrderInput, AppTypeQuery } from '#/api';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  FormItem,
  Image,
  Input,
  InputNumber,
  message,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import { getAppTypeListApi, updateAppTypeOrderApi } from '#/api';
import { useMenuTitle } from '#/composables/use-menu-title';

const title = useMenuTitle();
type Filters = Pick<AppTypeQuery, 'appName' | 'sort1' | 'status'>;
function emptyFilters(): Filters {
  return { sort1: '-1', appName: '', status: '-1' };
}
const filters = reactive(emptyFilters());
let appliedFilters = emptyFilters();
const direction = ref<AppTypeQuery['order']>('asc');
const records = ref<AppType[]>([]);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
const loading = ref(false);
const listFailed = ref(false);
const saving = ref(false);
let listRequest = 0;

const sortOptions = [
  { label: '全部', value: '-1' },
  { label: '软件', value: '1' },
  { label: '游戏', value: '2' },
];
const statusOptions = [
  { label: '全部', value: '-1' },
  { label: '有效', value: '1' },
  { label: '无效', value: '0' },
];
const columns = computed<TableColumnsType<AppType>>(() => [
  { dataIndex: 'id', title: '分类 ID', width: 100 },
  { dataIndex: 'name', title: '分类名称', width: 150, ellipsis: true },
  { dataIndex: 'newName', title: '新分类名称', width: 150, ellipsis: true },
  {
    dataIndex: 'sort',
    title: '应用类型',
    width: 120,
    sorter: true,
    sortOrder: direction.value === 'asc' ? 'ascend' : 'descend',
    sortDirections: ['ascend', 'descend', 'ascend'],
  },
  { dataIndex: 'orderNum', title: '排序号', width: 100 },
  { dataIndex: 'status', title: '状态', width: 90 },
  { dataIndex: 'contentCount', title: 'iPhone 应用数量', width: 150 },
  { dataIndex: 'contentCountIpad', title: 'iPad 应用数量', width: 150 },
  { dataIndex: 'icon', title: 'iPhone 图标', width: 110 },
  { dataIndex: 'iconIpad', title: 'iPad 图标', width: 110 },
  { dataIndex: 'newIcon', title: '新分类图标', width: 160, ellipsis: true },
  { dataIndex: 'description', title: '分类说明', width: 240, ellipsis: true },
  { key: 'action', title: '操作', width: 110, fixed: 'right' },
]);

async function loadList(
  page = pagination.current,
  pageSize = pagination.pageSize,
) {
  const request = ++listRequest;
  loading.value = true;
  listFailed.value = false;
  try {
    const data = await getAppTypeListApi({
      ...appliedFilters,
      page,
      pageSize,
      sort: 'Sort',
      order: direction.value,
    });
    if (request !== listRequest) return;
    const lastPage = Math.max(
      1,
      Math.ceil(data.total / (data.size || pageSize)),
    );
    if (page > lastPage) {
      await loadList(lastPage, pageSize);
      return;
    }
    records.value = data.records;
    Object.assign(pagination, {
      current: data.current,
      pageSize: data.size,
      total: data.total,
    });
  } catch {
    if (request === listRequest) listFailed.value = true;
  } finally {
    if (request === listRequest) loading.value = false;
  }
}
function search() {
  if (saving.value) return;
  appliedFilters = { ...filters, appName: filters.appName.trim() };
  void loadList(1);
}
function reset() {
  Object.assign(filters, emptyFilters());
  search();
}
function changeTable(
  value: TablePaginationConfig,
  _filters: unknown,
  sorter: SorterResult<AppType> | SorterResult<AppType>[],
) {
  if (saving.value) return;
  const active = Array.isArray(sorter) ? sorter[0] : sorter;
  const order = active?.order === 'descend' ? 'desc' : 'asc';
  const size = value.pageSize ?? pagination.pageSize;
  const page =
    direction.value === order && size === pagination.pageSize
      ? (value.current ?? 1)
      : 1;
  direction.value = order;
  void loadList(page, size);
}

const modalOpen = ref(false);
const selected = ref<Omit<AppTypeOrderInput, 'newOrder'> & { name: string }>();
const formRef = ref<FormInstance>();
const form = reactive({ newOrder: undefined as number | undefined });
function canSort(
  row: AppType,
): row is AppType & { orderNum: number; sort: number } {
  return (
    row.id > 0 &&
    Number.isInteger(row.id) &&
    typeof row.sort === 'number' &&
    Number.isInteger(row.sort) &&
    typeof row.orderNum === 'number' &&
    Number.isInteger(row.orderNum)
  );
}
async function openEditor(row: AppType) {
  if (loading.value || saving.value || listFailed.value || !canSort(row))
    return;
  selected.value = {
    id: row.id,
    sort: row.sort,
    oldOrder: row.orderNum,
    name: row.name ?? `ID: ${row.id}`,
  };
  form.newOrder = row.orderNum;
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}
function closeEditor() {
  if (!saving.value) modalOpen.value = false;
}
async function save() {
  const current = selected.value;
  const editor = formRef.value;
  if (saving.value || !current || !editor) return;
  saving.value = true;
  try {
    await editor.validate();
    if (form.newOrder === undefined) return;
    await updateAppTypeOrderApi({
      id: current.id,
      sort: current.sort,
      oldOrder: current.oldOrder,
      newOrder: form.newOrder,
    });
    message.success('排序修改成功');
    modalOpen.value = false;
    await loadList();
  } catch {
    // 保留输入，接口错误由请求拦截器展示。
  } finally {
    saving.value = false;
  }
}
function sortLabel(value: null | number) {
  if (value === null) return '—';
  return value === 1 ? '软件' : '游戏';
}
function statusLabel(value: null | number) {
  return (
    statusOptions.find((item) => item.value === String(value))?.label ??
    value ??
    '—'
  );
}
onMounted(() => {
  void loadList();
});
onBeforeUnmount(() => {
  ++listRequest;
});
</script>

<template>
  <Page :title="title">
    <Card class="filter-card" title="筛选条件">
      <Form
        name="app-type-filters"
        :model="filters"
        :disabled="saving"
        layout="vertical"
        @finish="search"
      >
        <Row :gutter="16">
          <Col :xs="24" :sm="12" :lg="6" :xl="3">
            <FormItem label="应用类型" name="sort1">
              <Select v-model:value="filters.sort1" :options="sortOptions" />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12" :lg="6" :xl="3">
            <FormItem label="分类名称" name="appName">
              <Input
                v-model:value="filters.appName"
                :maxlength="128"
                allow-clear
              />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12" :lg="6" :xl="3">
            <FormItem label="状态" name="status">
              <Select v-model:value="filters.status" :options="statusOptions" />
            </FormItem>
          </Col>
        </Row>
        <div class="flex justify-end">
          <Space>
            <Button
              type="primary"
              html-type="submit"
              :loading="loading"
              :disabled="saving"
            >
              查询
            </Button>
            <Button :disabled="saving" @click="reset">重置</Button>
          </Space>
        </div>
      </Form>
    </Card>
    <Card title="分类列表">
      <template #extra>
        <Button :loading="loading" :disabled="saving" @click="loadList()">
          刷新
        </Button>
      </template>
      <Alert
        v-if="listFailed"
        class="mb-4"
        message="应用分类加载失败，请刷新重试"
        type="error"
        show-icon
      />
      <Table
        :columns="columns"
        :data-source="records"
        :loading="loading"
        row-key="id"
        :scroll="{ x: 1800 }"
        :pagination="{
          ...pagination,
          disabled: loading || saving,
          showSizeChanger: true,
          pageSizeOptions: ['20', '50', '100'],
          showTotal: (total) => `共 ${total} 条`,
        }"
        @change="changeTable"
      >
        <template #bodyCell="{ column, record, text }">
          <Button
            v-if="column.key === 'action'"
            type="link"
            size="small"
            :disabled="
              loading || saving || listFailed || !canSort(record as AppType)
            "
            @click="openEditor(record as AppType)"
          >
            修改排序
          </Button>
          <template v-else-if="column.dataIndex === 'sort'">
            {{ sortLabel(text) }}
          </template>
          <Tag
            v-else-if="column.dataIndex === 'status'"
            :color="text === 1 ? 'success' : 'default'"
          >
            {{ statusLabel(text) }}
          </Tag>
          <template
            v-else-if="
              column.dataIndex === 'icon' || column.dataIndex === 'iconIpad'
            "
          >
            <Image
              v-if="text"
              :src="text"
              :alt="record.name ?? '分类图标'"
              :width="32"
              :height="32"
            />
            <span v-else>—</span>
          </template>
          <template v-else>{{ text ?? '—' }}</template>
        </template>
      </Table>
    </Card>
    <Modal
      :open="modalOpen"
      :title="`修改排序：${selected?.name ?? ''}`"
      :confirm-loading="saving"
      :mask-closable="false"
      :keyboard="!saving"
      :closable="!saving"
      :cancel-button-props="{ disabled: saving }"
      ok-text="保存"
      @ok="save"
      @cancel="closeEditor"
    >
      <p class="mb-4">原排序号：{{ selected?.oldOrder }}</p>
      <Form
        ref="formRef"
        name="app-type-editor"
        :model="form"
        :disabled="saving"
        layout="vertical"
        @finish="save"
      >
        <FormItem
          label="新排序号"
          name="newOrder"
          :rules="[
            {
              required: true,
              type: 'integer',
              min: 0,
              max: 2_147_483_647,
              message: '请输入有效的非负整数排序号',
            },
          ]"
        >
          <InputNumber
            v-model:value="form.newOrder"
            class="w-full"
            :min="0"
            :max="2_147_483_647"
            :precision="0"
          />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
