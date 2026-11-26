<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';
import type {
  SorterResult,
  TableRowSelection,
} from 'ant-design-vue/es/table/interface';

import type {
  AppSort,
  AppTopic,
  AppTopicCandidate,
  AppTopicCandidateQuery,
} from '#/api';

import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';

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

import { addAppTopicAppsApi, getAppTopicCandidatesApi } from '#/api';
import DownloadStats from '#/components/download-stats.vue';
import { useAppCategories } from '#/composables/use-app-categories';

import { optionLabel, priceOptions, statusOptions } from '../app-info/data';
import { platformOptions, validId, withAll } from './data';
import { useTopicPage } from './use-topic-page';

const props = defineProps<{
  disabled?: boolean;
  filterTarget?: HTMLElement;
  open: boolean;
  revision?: number;
  topic?: Pick<AppTopic, 'id' | 'name' | 'platform'>;
}>();
const emit = defineEmits<{ added: []; busy: [value: boolean] }>();
type Filters = Omit<
  AppTopicCandidateQuery,
  'order' | 'page' | 'pageSize' | 'sid' | 'sort1'
>;
type CandidateSorting = Pick<AppTopicCandidateQuery, 'order' | 'sort1'>;
function emptyFilters(): Filters {
  return {
    sort: '1',
    type: -1,
    searchKeyType: 2,
    searchKeyText: '',
    platform: props.topic?.platform ?? -1,
  };
}
const filters = reactive(emptyFilters());
let applied = emptyFilters();
const sorting = ref<CandidateSorting>({});
const working = ref(false);
const { cancel, failed, load, loading, pagination, records, selectedIds } =
  useTopicPage(
    (page, pageSize) => {
      const sid = props.topic?.id;
      if (!validId(sid)) throw new Error('请选择有效专题');
      return getAppTopicCandidatesApi({
        ...applied,
        ...sorting.value,
        sid,
        page,
        pageSize,
      });
    },
    () => working.value || props.disabled === true,
  );
const disabled = computed(
  () => loading.value || failed.value || working.value || props.disabled,
);
const categoryState = useAppCategories();
const categories = computed(
  () => categoryState.categories[Number(filters.sort) as AppSort] ?? [],
);
const categoryLoading = computed(
  () => categoryState.loading[Number(filters.sort) as AppSort],
);
const categoryFailed = computed(
  () => categoryState.failed[Number(filters.sort) as AppSort],
);
const categoryOptions = computed(() => [
  { label: '全部', value: -1 },
  ...categories.value
    .filter((item) => item.id > 0)
    .map((item) => ({ label: item.name, value: item.id })),
]);
function loadCategories() {
  return categoryState.load(Number(filters.sort) as AppSort);
}
function changeSort() {
  filters.type = -1;
  void loadCategories();
}
function search() {
  if (working.value || props.disabled) return;
  applied = { ...filters, searchKeyText: filters.searchKeyText.trim() };
  void load(1);
}
function reset() {
  if (working.value || props.disabled) return;
  Object.assign(filters, emptyFilters());
  sorting.value = {};
  void loadCategories();
  search();
}
function changeTable(
  value: TablePaginationConfig,
  _filters: unknown,
  sorter: SorterResult<AppTopicCandidate> | SorterResult<AppTopicCandidate>[],
) {
  if (!props.open || working.value || props.disabled) return;
  const active = Array.isArray(sorter) ? sorter[0] : sorter;
  const next: CandidateSorting =
    active?.order &&
    (active.field === 'downloadCount' || active.field === 'appStorePrice')
      ? {
          sort1: active.field,
          order: active.order === 'ascend' ? 'asc' : 'desc',
        }
      : {};
  const changed =
    next.sort1 !== sorting.value.sort1 || next.order !== sorting.value.order;
  const size = value.pageSize ?? pagination.pageSize;
  sorting.value = next;
  void load(
    !changed && size === pagination.pageSize ? (value.current ?? 1) : 1,
    size,
  );
}
function canAdd(record: AppTopicCandidate) {
  return record.isAdded === 0 && validId(record.appId);
}
const rowSelection = computed<TableRowSelection<AppTopicCandidate>>(() => ({
  selectedRowKeys: selectedIds.value,
  onChange: (keys) => {
    selectedIds.value = keys.map(Number);
  },
  getCheckboxProps: (record) => ({
    disabled: disabled.value || !canAdd(record),
  }),
}));
function columnSortOrder(field: NonNullable<AppTopicCandidateQuery['sort1']>) {
  if (sorting.value.sort1 !== field) return null;
  return sorting.value.order === 'asc' ? 'ascend' : 'descend';
}
const columns = computed<TableColumnsType<AppTopicCandidate>>(() => [
  { dataIndex: 'appId', title: '应用 ID', width: 110 },
  { dataIndex: 'id', title: '应用主表 ID', width: 120 },
  { dataIndex: 'appName', title: '应用名称', width: 220, ellipsis: true },
  {
    dataIndex: 'version',
    title: '版本号',
    width: 140,
    className: 'whitespace-nowrap',
  },
  { dataIndex: 'sort', title: '应用类型', width: 100 },
  { dataIndex: 'typeName', title: '分类', width: 110 },
  { dataIndex: 'type', title: '分类 ID', width: 100 },
  { dataIndex: 'channelId', title: '渠道 ID', width: 100 },
  {
    key: 'downloadStats',
    dataIndex: 'downloadCount',
    title: '下载统计',
    width: 140,
    align: 'center',
    sorter: true,
    sortOrder: columnSortOrder('downloadCount'),
  },
  {
    dataIndex: 'appStorePrice',
    title: '价格（元）',
    width: 120,
    sorter: true,
    sortOrder: columnSortOrder('appStorePrice'),
  },
  { dataIndex: 'appPriceFlag', title: '价格类型', width: 100 },
  { dataIndex: 'appStoreStatus', title: '上架状态', width: 100 },
  { dataIndex: 'status', title: '应用状态', width: 100 },
  { dataIndex: 'isAdded', title: '添加状态', width: 100 },
  { key: 'action', title: '操作', width: 90, fixed: 'right' },
]);
async function add(ids: number[]) {
  const sid = props.topic?.id;
  if (disabled.value || !validId(sid) || ids.length === 0) return;
  const available = new Set(
    records.value
      .filter((record) => canAdd(record))
      .map((record) => record.appId),
  );
  if (!ids.every((id) => available.has(id))) return;
  working.value = true;
  emit('busy', true);
  try {
    const success = await addAppTopicAppsApi({ sid, ids: [...ids] });
    if (!props.open || sid !== props.topic?.id) return;
    if (!success) {
      message.error('添加到专题失败，请重试');
      return;
    }
    message.success('应用已添加到专题');
    emit('added');
    await load();
  } catch {
    /* 保留选择供重试。 */
  } finally {
    working.value = false;
    emit('busy', false);
  }
}
watch(
  () => [props.open, props.topic?.id] as const,
  ([open, sid]) => {
    cancel();
    records.value = [];
    sorting.value = {};
    Object.assign(pagination, { current: 1, pageSize: 20, total: 0 });
    if (!open || !validId(sid)) return;
    Object.assign(filters, emptyFilters());
    applied = emptyFilters();
    void loadCategories();
    void load(1);
  },
  { immediate: true },
);
watch(
  () => props.revision,
  () => {
    if (props.open && validId(props.topic?.id)) void load();
  },
);
onBeforeUnmount(() => {
  emit('busy', false);
});
</script>

<template>
  <section class="min-w-0" aria-label="可添加应用">
    <div class="topic-apps-pane-header">
      <h3 class="text-base font-medium">可添加应用</h3>
      <Space :size="8">
        <Button
          size="small"
          :loading="loading"
          :disabled="working || props.disabled"
          @click="load()"
        >
          刷新候选
        </Button>
        <Button
          size="small"
          type="primary"
          :loading="working"
          :disabled="disabled || selectedIds.length === 0"
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
              :disabled="working || props.disabled"
              @click="loadCategories"
            >
              重试分类
            </Button>
          </template>
        </Alert>
        <Form
          name="app-topic-candidates"
          :model="filters"
          :disabled="working || props.disabled"
          layout="vertical"
          @finish="search"
        >
          <Row :gutter="16">
            <Col :xs="24" :sm="12" :lg="6" :xl="3">
              <FormItem label="应用类型" name="sort">
                <Select
                  v-model:value="filters.sort"
                  :options="[
                    { label: '软件', value: '1' },
                    { label: '游戏', value: '2' },
                  ]"
                  @change="changeSort"
                />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="12" :lg="6" :xl="3">
              <FormItem label="应用分类" name="type">
                <Select
                  v-model:value="filters.type"
                  :options="categoryOptions"
                  :loading="categoryLoading"
                  :disabled="
                    working ||
                    props.disabled ||
                    categoryLoading ||
                    categoryFailed
                  "
                  show-search
                  option-filter-prop="label"
                />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="12" :lg="6" :xl="3">
              <FormItem label="运行平台" name="platform">
                <Select
                  v-model:value="filters.platform"
                  :options="withAll(platformOptions)"
                />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="12" :lg="6" :xl="3">
              <FormItem label="搜索类型" name="searchKeyType">
                <Select
                  v-model:value="filters.searchKeyType"
                  :options="[
                    { label: '应用名称', value: 2 },
                    { label: '应用 ID', value: 1 },
                  ]"
                />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="24" :lg="12" :xl="12">
              <FormItem label="搜索内容" name="searchKeyText">
                <Input
                  v-model:value="filters.searchKeyText"
                  placeholder="请输入应用名称或应用 ID"
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
        v-if="failed"
        class="mb-4"
        message="候选应用加载失败，请重试"
        type="error"
        show-icon
      >
        <template #action>
          <Button
            size="small"
            :disabled="working || props.disabled"
            @click="load()"
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
      :row-selection="rowSelection"
      row-key="appId"
      :scroll="{ x: 1800 }"
      :pagination="{
        ...pagination,
        disabled,
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
          :disabled="disabled || !canAdd(record as AppTopicCandidate)"
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
