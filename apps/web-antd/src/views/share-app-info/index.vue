<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type {
  AppCategory,
  AppSort,
  ShareAppInfo,
  ShareAppInfoQuery,
} from '#/api';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  FormItem,
  Input,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getAppCategoryListApi,
  getShareAppInfoListApi,
  updateShareAppInfoVisibilityApi,
} from '#/api';
import DownloadStats from '#/components/download-stats.vue';
import { useMenuTitle } from '#/composables/use-menu-title';

type Filters = Omit<ShareAppInfoQuery, 'page' | 'pageSize'>;
const menuTitle = useMenuTitle();
function emptyFilters(): Filters {
  return {
    sort: -1,
    type: -1,
    platform: -1,
    status: -1,
    searchType: 1,
    appName: '',
  };
}
const filters = reactive(emptyFilters());
let appliedFilters = emptyFilters();
const records = ref<ShareAppInfo[]>([]);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
const loading = ref(false);
const listFailed = ref(false);
const updatingId = ref<number>();
let listRequest = 0;

const sortOptions = [
  { label: '全部', value: -1 },
  { label: '软件', value: 1 },
  { label: '游戏', value: 2 },
];
const platformOptions = [
  { label: '全部', value: -1 },
  { label: 'iPhone', value: 101 },
  { label: 'iPad', value: 102 },
  { label: 'iPhone & iPad', value: 103 },
];
const statusOptions = [
  { label: '全部', value: -1 },
  { label: '有效', value: 1 },
  { label: '无效', value: 0 },
  { label: '已隐藏', value: -2 },
];
const searchOptions = [
  { label: '应用名称', value: 1 },
  { label: '应用 ID（AppId）', value: 2 },
  { label: 'iTunes ID（ItemId）', value: 3 },
  { label: '包 ID（SourceId）', value: 4 },
];
const columns: TableColumnsType<ShareAppInfo> = [
  { dataIndex: 'id', title: '分享包 ID', width: 110 },
  { dataIndex: 'appId', title: '应用 ID', width: 100 },
  { dataIndex: 'appName', title: '应用名称', width: 200, ellipsis: true },
  { dataIndex: 'shortShortNote', title: '广告语', width: 200, ellipsis: true },
  { dataIndex: 'sort', title: '类型', width: 80 },
  { dataIndex: 'typeName', title: '分类', width: 100 },
  { dataIndex: 'platform', title: '运行平台', width: 140 },
  { dataIndex: 'status', title: '状态', width: 90 },
  { dataIndex: 'size', title: '大小', width: 110 },
  { dataIndex: 'version', title: '版本号', width: 110 },
  { dataIndex: 'shortVersion', title: '短版本号', width: 110 },
  {
    dataIndex: 'longVersion',
    title: '长版本号',
    width: 160,
    className: 'whitespace-nowrap',
  },
  { dataIndex: 'minVersion', title: '最低系统版本', width: 120 },
  { key: 'downloadStats', title: '下载统计', width: 140, align: 'center' },
  { dataIndex: 'orderNum', title: '排序号', width: 90 },
  { dataIndex: 'keywords', title: '搜索关键字', width: 200, ellipsis: true },
  { dataIndex: 'path', title: 'IPA 下载地址', width: 140 },
  { dataIndex: 'plist', title: '安装配置地址', width: 140 },
  { dataIndex: 'ipaUpdateTime', title: 'IPA 更新时间', width: 180 },
  { dataIndex: 'createTime', title: '创建时间', width: 180 },
  { dataIndex: 'updateTime', title: '更新时间', width: 180 },
  { key: 'action', title: '操作', fixed: 'right', width: 90 },
];

async function loadList(
  page = pagination.current,
  pageSize = pagination.pageSize,
) {
  const request = ++listRequest;
  loading.value = true;
  listFailed.value = false;
  try {
    const data = await getShareAppInfoListApi({
      ...appliedFilters,
      page,
      pageSize,
    });
    if (request !== listRequest) return;
    records.value = data.records;
    pagination.current = data.current;
    pagination.pageSize = data.size;
    pagination.total = data.total;
  } catch {
    if (request === listRequest) listFailed.value = true;
  } finally {
    if (request === listRequest) loading.value = false;
  }
}

function search() {
  appliedFilters = { ...filters, appName: filters.appName.trim() };
  void loadList(1);
}

function reset() {
  Object.assign(filters, emptyFilters());
  search();
}

function changePage(value: TablePaginationConfig) {
  const pageSize = value.pageSize ?? pagination.pageSize;
  void loadList(
    pageSize === pagination.pageSize ? (value.current ?? 1) : 1,
    pageSize,
  );
}

const categories = reactive<Partial<Record<AppSort, AppCategory[]>>>({});
const categoryLoading = reactive({ 1: false, 2: false });
const categoryFailed = reactive({ 1: false, 2: false });
const categoriesFailed = computed(() => categoryFailed[1] || categoryFailed[2]);
const categoryOptions = computed(() => {
  const sorts: AppSort[] =
    filters.sort === -1 ? [1, 2] : [filters.sort as AppSort];
  const items = sorts.flatMap((sort) => categories[sort] ?? []);
  return [
    { label: '全部', value: -1 },
    ...[...new Map(items.map((item) => [item.id, item])).values()].map(
      (item) => ({
        label: item.name,
        value: item.id,
      }),
    ),
  ];
});

async function loadCategories(sort: AppSort) {
  if (categoryLoading[sort] || categories[sort]) return;
  categoryLoading[sort] = true;
  categoryFailed[sort] = false;
  try {
    const items = await getAppCategoryListApi(sort);
    categories[sort] = items.filter((item) => item.id > 0);
  } catch {
    categoryFailed[sort] = true;
  } finally {
    categoryLoading[sort] = false;
  }
}

function retryCategories() {
  void loadCategories(1);
  void loadCategories(2);
}

async function changeVisibility(id: number, status: number) {
  if (updatingId.value !== undefined) return;
  updatingId.value = id;
  const type = status === 1 ? 1 : 3;
  try {
    await updateShareAppInfoVisibilityApi({ id, type });
    message.success(type === 1 ? '分享包已隐藏' : '分享包已显示');
    await loadList();
    if (
      !listFailed.value &&
      records.value.length === 0 &&
      pagination.current > 1
    ) {
      const lastPage = Math.max(
        1,
        Math.ceil(pagination.total / pagination.pageSize),
      );
      await loadList(Math.min(pagination.current - 1, lastPage));
    }
  } catch {
    // 请求拦截器展示错误，保留当前列表供重试。
  } finally {
    updatingId.value = undefined;
  }
}

function statusLabel(status: number) {
  return (
    statusOptions.find((option) => option.value === status)?.label ?? status
  );
}

function downloadUrl(path: string) {
  return `http://app-res.mc.cn/soft/${path.replace(/^\/+/, '')}`;
}

onMounted(() => {
  void loadList();
  retryCategories();
});
</script>

<template>
  <Page :title="menuTitle" description="查询分享包信息，管理分享包的显示与隐藏">
    <Card class="filter-card" title="筛选条件">
      <Alert
        v-if="categoriesFailed"
        class="mb-4"
        message="部分应用分类加载失败，请重试"
        show-icon
        type="error"
      >
        <template #action>
          <Button size="small" @click="retryCategories"> 重试分类 </Button>
        </template>
      </Alert>
      <Form
        name="share-filters"
        :model="filters"
        layout="vertical"
        @finish="search"
      >
        <Row :gutter="16">
          <Col :xs="24" :sm="12" :lg="6" :xl="3">
            <FormItem label="应用分类" name="sort">
              <Select
                v-model:value="filters.sort"
                :options="sortOptions"
                @change="filters.type = -1"
              />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12" :lg="6" :xl="3">
            <FormItem label="软件类型" name="type">
              <Select
                v-model:value="filters.type"
                :options="categoryOptions"
                :loading="categoryLoading[1] || categoryLoading[2]"
                show-search
                option-filter-prop="label"
              />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12" :lg="6" :xl="3">
            <FormItem label="运行平台" name="platform">
              <Select
                v-model:value="filters.platform"
                :options="platformOptions"
              />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12" :lg="6" :xl="3">
            <FormItem label="应用状态" name="status">
              <Select v-model:value="filters.status" :options="statusOptions" />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12" :lg="6" :xl="3">
            <FormItem label="搜索类型" name="searchType">
              <Select
                v-model:value="filters.searchType"
                :options="searchOptions"
              />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12" :lg="12" :xl="9">
            <FormItem label="搜索内容" name="appName">
              <Input
                v-model:value="filters.appName"
                placeholder="请输入应用名称或对应 ID"
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
            <Button @click="reset">重置</Button>
          </Space>
        </div>
      </Form>
    </Card>
    <Card title="分享包列表">
      <template #extra>
        <Button :loading="loading" @click="loadList()">刷新</Button>
      </template>
      <Alert
        v-if="listFailed"
        class="mb-4"
        message="分享包列表加载失败，请刷新重试"
        show-icon
        type="error"
      />
      <Table
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :pagination="{
          ...pagination,
          showSizeChanger: true,
          pageSizeOptions: ['20', '50', '100'],
          showTotal: (total) => `共 ${total} 条`,
        }"
        :scroll="{ x: 3340 }"
        row-key="id"
        @change="changePage"
      >
        <template #bodyCell="{ column, record, text }">
          <Popconfirm
            v-if="column.key === 'action'"
            :title="`确定${record.status === 1 ? '隐藏' : '显示'}分享包「${record.appName}」吗？`"
            :ok-text="record.status === 1 ? '隐藏' : '显示'"
            cancel-text="取消"
            :disabled="updatingId !== undefined"
            @confirm="changeVisibility(record.id, record.status)"
          >
            <Button
              type="link"
              size="small"
              :loading="updatingId === record.id"
              :disabled="updatingId !== undefined"
            >
              {{ record.status === 1 ? '隐藏' : '显示' }}
            </Button>
          </Popconfirm>
          <DownloadStats
            v-else-if="column.key === 'downloadStats'"
            :count="record.downloadCount"
            :base="record.downloadBase"
          />
          <Tag
            v-else-if="column.dataIndex === 'status'"
            :color="record.status === 1 ? 'success' : 'default'"
          >
            {{ statusLabel(record.status) }}
          </Tag>
          <template v-else-if="column.dataIndex === 'sort'">
            {{ record.sort === 1 ? '软件' : '游戏' }}
          </template>
          <template v-else-if="column.dataIndex === 'platform'">
            {{
              record.platform === 101
                ? 'iPhone'
                : record.platform === 102
                  ? 'iPad'
                  : 'iPhone & iPad'
            }}
          </template>
          <template
            v-else-if="
              column.dataIndex === 'path' || column.dataIndex === 'plist'
            "
          >
            <a
              v-if="text"
              :href="downloadUrl(text)"
              class="text-primary"
              download
              target="_blank"
              rel="noopener noreferrer"
            >
              点击下载
            </a>
            <template v-else>—</template>
          </template>
          <template v-else>{{ text ?? '—' }}</template>
        </template>
      </Table>
    </Card>
  </Page>
</template>
