<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';
import type { TableRowSelection } from 'ant-design-vue/es/table/interface';

import type {
  AppSpecialCandidate,
  AppSpecialCandidateQuery,
  AppSpecialCategory,
} from '#/api';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  FormItem,
  Input,
  message,
  Row,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  addAppSpecialAppsApi,
  getAppSpecialCandidateListApi,
  getAppSpecialCategoriesApi,
} from '#/api';
import DownloadStats from '#/components/download-stats.vue';

import { optionLabel, priceOptions, statusOptions } from '../app-info/data';

const props = defineProps<{
  disabled?: boolean;
  filterTarget?: HTMLElement;
  revision?: number;
}>();
const emit = defineEmits<{ added: []; busy: [value: boolean] }>();
type Filters = Omit<
  AppSpecialCandidateQuery,
  'isFree' | 'page' | 'pageSize'
> & { prices: string[] };
function emptyFilters(): Filters {
  return { type: -1, searchKeyType: '', searchKeyText: '', prices: [] };
}
const filters = reactive(emptyFilters());
let appliedFilters: Omit<AppSpecialCandidateQuery, 'page' | 'pageSize'> = {
  type: -1,
  searchKeyType: '',
  searchKeyText: '',
  isFree: '-1',
};
const records = ref<AppSpecialCandidate[]>([]);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
const loading = ref(false);
const listFailed = ref(false);
const adding = ref(false);
const selectedIds = ref<number[]>([]);
const actionsDisabled = computed(
  () => loading.value || listFailed.value || adding.value || props.disabled,
);
let listRequest = 0;
let categoryRequest = 0;
const categories = ref<AppSpecialCategory[]>([]);
const categoryLoading = ref(false);
const categoryFailed = ref(false);
const categoryOptions = computed(() => [
  { label: '全部', value: -1 },
  ...categories.value
    .filter((item) => item.id > 0)
    .map((item) => ({ label: item.name, value: item.id })),
]);
const searchOptions = [
  { label: '不限', value: '' },
  { label: '应用名称', value: '1' },
  { label: '应用 ID', value: '2' },
];
const columns: TableColumnsType<AppSpecialCandidate> = [
  { dataIndex: 'appId', title: '应用 ID', width: 110 },
  { dataIndex: 'id', title: '应用主表 ID', width: 120 },
  { dataIndex: 'appName', title: '应用名称', width: 220, ellipsis: true },
  { dataIndex: 'sort', title: '应用类型', width: 100 },
  { dataIndex: 'typeName', title: '分类', width: 110 },
  { dataIndex: 'type', title: '分类 ID', width: 100 },
  { dataIndex: 'channelId', title: '渠道 ID', width: 100 },
  { key: 'downloadStats', title: '下载统计', width: 140, align: 'center' },
  { dataIndex: 'appStorePrice', title: '价格（元）', width: 120 },
  { dataIndex: 'appPriceFlag', title: '价格类型', width: 100 },
  { dataIndex: 'appStoreStatus', title: '上架状态', width: 100 },
  { dataIndex: 'status', title: '应用状态', width: 100 },
  { dataIndex: 'isAdded', title: '添加状态', width: 100 },
  { key: 'action', title: '操作', width: 90, fixed: 'right' },
];
function canAdd(record: AppSpecialCandidate) {
  return (
    record.isAdded === 0 && Number.isInteger(record.appId) && record.appId > 0
  );
}
const rowSelection = computed<TableRowSelection<AppSpecialCandidate>>(() => ({
  selectedRowKeys: selectedIds.value,
  onChange: (keys) => {
    selectedIds.value = keys.map(Number);
  },
  getCheckboxProps: (record) => ({
    disabled: actionsDisabled.value || !canAdd(record),
  }),
}));
async function loadCategories() {
  const request = ++categoryRequest;
  categoryLoading.value = true;
  categoryFailed.value = false;
  try {
    const data = await getAppSpecialCategoriesApi();
    if (request === categoryRequest) categories.value = data;
  } catch {
    if (request === categoryRequest) categoryFailed.value = true;
  } finally {
    if (request === categoryRequest) categoryLoading.value = false;
  }
}
async function loadList(
  page = pagination.current,
  pageSize = pagination.pageSize,
) {
  const request = ++listRequest;
  loading.value = true;
  listFailed.value = false;
  selectedIds.value = [];
  try {
    const data = await getAppSpecialCandidateListApi({
      ...appliedFilters,
      page,
      pageSize,
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
  if (adding.value || props.disabled) return;
  appliedFilters = {
    type: filters.type,
    searchKeyType: filters.searchKeyType,
    searchKeyText: filters.searchKeyText.trim(),
    isFree: filters.prices.length > 0 ? filters.prices.join(',') : '-1',
  };
  void loadList(1);
}
function reset() {
  if (adding.value || props.disabled) return;
  Object.assign(filters, emptyFilters());
  search();
}
function changePage(value: TablePaginationConfig) {
  if (actionsDisabled.value) return;
  const pageSize = value.pageSize ?? pagination.pageSize;
  void loadList(
    pageSize === pagination.pageSize ? (value.current ?? 1) : 1,
    pageSize,
  );
}
async function add(ids: number[]) {
  if (actionsDisabled.value || ids.length === 0) return;
  const available = new Set(
    records.value
      .filter((record) => canAdd(record))
      .map((record) => record.appId),
  );
  if (!ids.every((id) => available.has(id))) return;
  adding.value = true;
  emit('busy', true);
  try {
    await addAppSpecialAppsApi([...ids]);
    message.success('专题应用添加成功');
    emit('added');
    await loadList();
  } catch {
    // 保留选择与筛选，便于重试。
  } finally {
    adding.value = false;
    emit('busy', false);
  }
}
watch(
  () => props.revision,
  () => void loadList(),
);
onMounted(() => {
  void loadCategories();
  void loadList(1);
});
onBeforeUnmount(() => {
  ++listRequest;
  ++categoryRequest;
  emit('busy', false);
});
</script>

<template>
  <section class="min-w-0" aria-label="可添加应用">
    <div class="special-apps-pane-header">
      <h3 class="text-base font-medium">可添加应用</h3>
      <Space :size="8">
        <Button
          size="small"
          :loading="loading"
          :disabled="adding || props.disabled"
          @click="loadList()"
        >
          刷新候选
        </Button>
        <Button
          size="small"
          type="primary"
          :loading="adding"
          :disabled="actionsDisabled || selectedIds.length === 0"
          @click="add(selectedIds)"
        >
          添加选中（{{ selectedIds.length }}）
        </Button>
      </Space>
    </div>
    <Teleport :to="filterTarget || 'body'" :disabled="!filterTarget">
      <Card class="filter-card" title="可添加应用筛选" size="small">
        <Alert
          v-if="categoryFailed"
          class="mb-4"
          message="应用分类加载失败，请重试"
          type="error"
          show-icon
        >
          <template #action>
            <Button
              size="small"
              :disabled="adding || props.disabled"
              @click="loadCategories"
            >
              重试分类
            </Button>
          </template>
        </Alert>
        <Form
          name="app-special-filters"
          :model="filters"
          :disabled="adding || props.disabled"
          layout="vertical"
          @finish="search"
        >
          <Row :gutter="16">
            <Col :xs="24" :sm="12" :lg="6" :xl="3">
              <FormItem label="应用分类" name="type">
                <Select
                  v-model:value="filters.type"
                  :options="categoryOptions"
                  :loading="categoryLoading"
                  show-search
                  option-filter-prop="label"
                />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="12" :lg="6" :xl="3">
              <FormItem label="搜索类型" name="searchKeyType">
                <Select
                  v-model:value="filters.searchKeyType"
                  :options="searchOptions"
                />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="24" :lg="12" :xl="9">
              <FormItem label="搜索内容" name="searchKeyText">
                <Input
                  v-model:value="filters.searchKeyText"
                  placeholder="请输入应用名称或应用 ID"
                  allow-clear
                />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="24" :lg="12" :xl="9">
              <FormItem label="是否免费" name="prices">
                <Select
                  v-model:value="filters.prices"
                  :options="priceOptions"
                  mode="multiple"
                  placeholder="全部"
                  allow-clear
                />
              </FormItem>
            </Col>
          </Row>
          <div class="flex justify-end">
            <Space>
              <Button type="primary" html-type="submit" :loading="loading">
                查询
              </Button>
              <Button @click="reset"> 重置 </Button>
            </Space>
          </div>
        </Form>
      </Card>
      <Alert
        v-if="listFailed"
        class="mb-4"
        message="可添加应用加载失败，请重试"
        type="error"
        show-icon
      >
        <template #action>
          <Button
            size="small"
            :disabled="adding || props.disabled"
            @click="loadList()"
          >
            重试列表
          </Button>
        </template>
      </Alert>
    </Teleport>
    <Table
      :columns="columns"
      :data-source="records"
      :loading="loading"
      row-key="appId"
      :row-selection="rowSelection"
      :scroll="{ x: 1650 }"
      :pagination="{
        ...pagination,
        disabled: actionsDisabled,
        showSizeChanger: true,
        pageSizeOptions: ['20', '50', '100'],
        showTotal: (total) => `共 ${total} 条`,
      }"
      @change="changePage"
    >
      <template #bodyCell="{ column, record, text }">
        <Button
          v-if="column.key === 'action'"
          type="link"
          size="small"
          :disabled="actionsDisabled || !canAdd(record as AppSpecialCandidate)"
          @click="add([record.appId])"
        >
          添加
        </Button>
        <DownloadStats
          v-else-if="column.key === 'downloadStats'"
          :count="record.downloadCount"
          :base="record.downloadBase"
        />
        <template v-else-if="column.dataIndex === 'sort'">
          {{ text === null ? '—' : text === 1 ? '软件' : '游戏' }}
        </template>
        <template v-else-if="column.dataIndex === 'status'">
          {{ optionLabel(statusOptions, text) }}
        </template>
        <template v-else-if="column.dataIndex === 'appPriceFlag'">
          {{ optionLabel(priceOptions, text) }}
        </template>
        <template v-else-if="column.dataIndex === 'appStoreStatus'">
          {{ text === 1 ? '上架' : text === 0 ? '下架' : (text ?? '—') }}
        </template>
        <Tag
          v-else-if="column.dataIndex === 'isAdded'"
          :color="text === 1 ? 'success' : 'default'"
        >
          {{ text === 1 ? '已添加' : text === 0 ? '未添加' : (text ?? '—') }}
        </Tag>
        <template v-else>{{ text ?? '—' }}</template>
      </template>
    </Table>
  </section>
</template>
