<script setup lang="ts">
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';

import type { AppCategory, AppInfo, AppInfoInput, AppSort } from '#/api';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getAppCategoryListApi,
  getAppInfoDetailsApi,
  getAppInfoListApi,
  updateAppInfoApi,
} from '#/api';
import DownloadStats from '#/components/download-stats.vue';
import PromotionPackage from '#/components/promotion-package.vue';
import { useMenuTitle } from '#/composables/use-menu-title';

import {
  coopOptions,
  emptyQuery,
  installOptions,
  optionLabel,
  platformOptions,
  priceOptions,
  searchOptions,
  selectFilters,
  sortOptions,
  statusOptions,
} from './data';

const { RangePicker } = DatePicker;
const menuTitle = useMenuTitle();
const filters = reactive(emptyQuery());
let appliedFilters = emptyQuery();
const dateRange = ref<[string, string]>();
const prices = ref<string[]>([]);
const records = ref<AppInfo[]>([]);
const loading = ref(false);
const listFailed = ref(false);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
let listRequest = 0;

const columns: TableColumnsType<AppInfo> = [
  { dataIndex: 'id', title: '应用 ID', width: 100 },
  { dataIndex: 'appName', ellipsis: true, title: '应用名称', width: 220 },
  { dataIndex: 'itemId', title: 'iTunes ID', width: 140 },
  { dataIndex: 'sourceId', ellipsis: true, title: '包 ID', width: 240 },
  { dataIndex: 'sort', title: '类型', width: 80 },
  { dataIndex: 'typeName', title: '分类', width: 110 },
  { dataIndex: 'platform', title: '运行平台', width: 140 },
  {
    dataIndex: 'version',
    title: '版本',
    width: 120,
    className: 'whitespace-nowrap',
  },
  { dataIndex: 'size', title: '大小', width: 110 },
  { dataIndex: 'status', title: '应用状态', width: 100 },
  { dataIndex: 'appStoreStatus', title: '上架状态', width: 100 },
  { dataIndex: 'isSharePage', title: '共享包', width: 80 },
  { dataIndex: 'isRemd', title: '是否推广包', width: 300 },
  { dataIndex: 'appPriceFlag', title: '价格类型', width: 100 },
  { dataIndex: 'appStorePrice', title: '价格（元）', width: 110 },
  { key: 'downloadStats', title: '下载统计', width: 140, align: 'center' },
  { dataIndex: 'createTime', title: '创建时间', width: 180 },
  { dataIndex: 'updateTime', title: '更新时间', width: 180 },
  { fixed: 'right', key: 'action', title: '操作', width: 80 },
];

async function loadList(
  page = pagination.current,
  pageSize = pagination.pageSize,
) {
  const request = ++listRequest;
  loading.value = true;
  listFailed.value = false;
  try {
    const data = await getAppInfoListApi({ ...appliedFilters, page, pageSize });
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
  appliedFilters = {
    ...filters,
    appName: filters.appName.trim(),
    isFree: prices.value.join(','),
    timeSt: dateRange.value?.[0] ?? '',
    timeEt: dateRange.value?.[1] ?? '',
  };
  void loadList(1);
}

function reset() {
  Object.assign(filters, emptyQuery());
  dateRange.value = undefined;
  prices.value = [];
  search();
}

function changePage(value: TablePaginationConfig) {
  const size = value.pageSize ?? pagination.pageSize;
  void loadList(size === pagination.pageSize ? (value.current ?? 1) : 1, size);
}

const categories = reactive<Partial<Record<AppSort, AppCategory[]>>>({});
const categoryLoading = reactive({ 1: false, 2: false });
const categoryFailed = reactive({ 1: false, 2: false });
const categoryRequests = new Map<AppSort, Promise<void>>();
const anyCategoryFailed = computed(
  () => categoryFailed[1] || categoryFailed[2],
);

function loadCategories(sort: AppSort): Promise<void> {
  if (categories[sort]) return Promise.resolve();
  const pending = categoryRequests.get(sort);
  if (pending) return pending;
  categoryLoading[sort] = true;
  categoryFailed[sort] = false;
  const request = (async () => {
    try {
      const r = await getAppCategoryListApi(sort);
      categories[sort] = r.filter((item) => item.id > 0);
    } catch {
      categoryFailed[sort] = true;
    } finally {
      categoryLoading[sort] = false;
      categoryRequests.delete(sort);
    }
  })();
  categoryRequests.set(sort, request);
  return request;
}

function retryCategories() {
  void loadCategories(1);
  void loadCategories(2);
}

const filterCategoryOptions = computed(() => {
  const sorts: AppSort[] =
    filters.sort1 === '-1' ? [1, 2] : [Number(filters.sort1) as AppSort];
  const items = sorts.flatMap((sort) => categories[sort] ?? []);
  return [
    { label: '全部', value: '' },
    ...[...new Map(items.map((item) => [item.id, item])).values()].map(
      (item) => ({
        label: item.name,
        value: String(item.id),
      }),
    ),
  ];
});

function changeFilter(key: string) {
  if (key === 'sort1') filters.type = '';
}

type EditForm = Omit<AppInfoInput, 'id' | 'type'> & {
  type: number | undefined;
};
const form = reactive<EditForm>({
  sort: 1,
  type: undefined,
  peculiarPopId: 0,
  remdAppstoreIns: 0,
});
const formRef = ref<FormInstance>();
const selectedId = ref<number>();
const selectedName = ref('');
const modalOpen = ref(false);
const detailLoading = ref(false);
const detailFailed = ref(false);
const saving = ref(false);
let detailRequest = 0;
const editCategoryOptions = computed(() =>
  (categories[form.sort] ?? []).map((item) => ({
    label: item.name,
    value: item.id,
  })),
);
const saveDisabled = computed(
  () =>
    detailLoading.value ||
    detailFailed.value ||
    categoryLoading[form.sort] ||
    categoryFailed[form.sort],
);
const requiredRules = [{ required: true, message: '请选择此项' }];

async function openEdit(id: number, name: string) {
  const request = ++detailRequest;
  selectedId.value = id;
  selectedName.value = name;
  Object.assign(form, {
    sort: 1,
    type: undefined,
    peculiarPopId: 0,
    remdAppstoreIns: 0,
  });
  modalOpen.value = true;
  detailLoading.value = true;
  detailFailed.value = false;
  await nextTick();
  formRef.value?.clearValidate();
  try {
    const data = await getAppInfoDetailsApi(id);
    if (request !== detailRequest) return;
    Object.assign(form, {
      sort: data.sort === 1 ? 1 : 2,
      type: data.type,
      peculiarPopId: data.peculiarPopId,
      remdAppstoreIns: data.remdAppstoreIns,
    });
    await loadCategories(form.sort);
  } catch {
    if (request === detailRequest) detailFailed.value = true;
  } finally {
    if (request === detailRequest) detailLoading.value = false;
  }
}

function changeEditSort() {
  form.type = undefined;
  void loadCategories(form.sort);
}

function closeModal() {
  if (saving.value) return;
  ++detailRequest;
  modalOpen.value = false;
}

async function save() {
  if (saving.value || saveDisabled.value || selectedId.value === undefined)
    return;
  saving.value = true;
  try {
    await formRef.value?.validate();
  } catch {
    saving.value = false;
    return;
  }
  try {
    if (form.type === undefined) return;
    await updateAppInfoApi({
      id: selectedId.value,
      sort: form.sort,
      type: form.type,
      peculiarPopId: form.peculiarPopId,
      remdAppstoreIns: form.remdAppstoreIns,
    });
    message.success('应用修改成功');
    modalOpen.value = false;
    await loadList();
  } catch {
    // 请求拦截器展示错误，保留表单供重试。
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadList();
  retryCategories();
});
</script>

<template>
  <Page :title="menuTitle" description="查询应用信息，管理应用分类与安装设置">
    <Card class="filter-card" title="筛选条件">
      <Alert
        v-if="anyCategoryFailed"
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
        name="app-filters"
        :model="filters"
        layout="vertical"
        @finish="search"
      >
        <Row :gutter="16">
          <Col
            v-for="item in selectFilters"
            :key="item.key"
            :xs="24"
            :sm="12"
            :lg="6"
            :xl="3"
          >
            <FormItem :label="item.label" :name="item.key">
              <Select
                v-model:value="filters[item.key]"
                :options="item.options"
                @change="changeFilter(item.key)"
              />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12" :lg="6" :xl="3">
            <FormItem label="软件分类" name="type">
              <Select
                v-model:value="filters.type"
                :options="filterCategoryOptions"
                :loading="categoryLoading[1] || categoryLoading[2]"
                show-search
                option-filter-prop="label"
              />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12" :lg="6" :xl="3">
            <FormItem label="价格类型（可多选）">
              <Select
                id="app-prices"
                v-model:value="prices"
                :options="priceOptions"
                mode="multiple"
                placeholder="全部"
                allow-clear
              />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="24" :lg="12" :xl="6">
            <FormItem label="时间范围">
              <RangePicker
                v-model:value="dateRange"
                class="w-full"
                show-time
                value-format="YYYY-MM-DD HH:mm:ss"
                format="YYYY-MM-DD HH:mm:ss"
              />
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
          <Col :xs="24" :sm="12" :lg="12" :xl="6">
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
    <Card title="应用列表">
      <template #extra>
        <Button :loading="loading" @click="loadList()">刷新</Button>
      </template>
      <Alert
        v-if="listFailed"
        class="mb-4"
        message="应用列表加载失败，请刷新重试"
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
        :scroll="{ x: 2740 }"
        row-key="id"
        @change="changePage"
      >
        <template #bodyCell="{ column, record, text }">
          <Button
            v-if="column.key === 'action'"
            type="link"
            size="small"
            @click="openEdit(record.id, record.appName)"
          >
            编辑
          </Button>
          <DownloadStats
            v-else-if="column.key === 'downloadStats'"
            :count="record.downloadCount"
            :base="record.downloadBase"
          />
          <Tag
            v-else-if="column.dataIndex === 'status'"
            :color="record.status === 1 ? 'success' : 'default'"
          >
            {{ optionLabel(statusOptions, record.status) }}
          </Tag>
          <Tag
            v-else-if="column.dataIndex === 'appStoreStatus'"
            :color="record.appStoreStatus === 1 ? 'success' : 'default'"
          >
            {{ record.appStoreStatus === 1 ? '上架' : '下架' }}
          </Tag>
          <template v-else-if="column.dataIndex === 'isSharePage'">
            {{ record.isSharePage > 0 ? '是' : '否' }}
          </template>
          <template v-else-if="column.dataIndex === 'sort'">
            {{ record.sort === 1 ? '软件' : '游戏' }}
          </template>
          <template v-else-if="column.dataIndex === 'platform'">
            {{
              optionLabel(
                platformOptions,
                record.platform === 101 || record.platform === 102
                  ? record.platform
                  : 103,
              )
            }}
          </template>
          <PromotionPackage
            v-else-if="column.dataIndex === 'isRemd'"
            :is-remd="record.isRemd"
            :channel="record.channel"
            :cooperation="optionLabel(coopOptions, record.coopModel)"
          />
          <template v-else-if="column.dataIndex === 'appPriceFlag'">
            {{ optionLabel(priceOptions, record.appPriceFlag) }}
          </template>
          <template v-else>{{ text ?? '—' }}</template>
        </template>
      </Table>
    </Card>
    <Modal
      :open="modalOpen"
      :title="`编辑应用：${selectedName}（${selectedId ?? ''}）`"
      :width="600"
      :closable="!saving"
      :keyboard="!saving"
      :mask-closable="false"
      @cancel="closeModal"
    >
      <Spin :spinning="detailLoading">
        <Alert
          v-if="detailFailed"
          message="应用详情加载失败，请重试"
          show-icon
          type="error"
        >
          <template #action>
            <Button size="small" @click="openEdit(selectedId!, selectedName)">
              重试详情
            </Button>
          </template>
        </Alert>
        <Form
          v-else
          ref="formRef"
          name="app-edit"
          :model="form"
          :disabled="detailLoading || saving"
          layout="vertical"
        >
          <FormItem label="软件类型" name="sort" :rules="requiredRules">
            <Select
              v-model:value="form.sort"
              :options="sortOptions"
              @change="changeEditSort"
            />
          </FormItem>
          <FormItem label="软件分类" name="type" :rules="requiredRules">
            <Select
              v-model:value="form.type"
              :options="editCategoryOptions"
              :loading="categoryLoading[form.sort]"
              :disabled="
                categoryLoading[form.sort] || categoryFailed[form.sort]
              "
              placeholder="请选择分类"
              show-search
              option-filter-prop="label"
            />
          </FormItem>
          <Alert
            v-if="categoryFailed[form.sort]"
            class="mb-4"
            message="应用分类加载失败，请重试"
            show-icon
            type="error"
          >
            <template #action>
              <Button size="small" @click="loadCategories(form.sort)">
                重试分类
              </Button>
            </template>
          </Alert>
          <FormItem
            label="特殊应用弹窗 ID"
            name="peculiarPopId"
            :rules="[
              {
                required: true,
                type: 'integer',
                min: 0,
                max: 2147483647,
                message: '请输入有效的非负整数 ID',
              },
            ]"
          >
            <InputNumber
              v-model:value="form.peculiarPopId"
              class="w-full"
              :min="0"
              :max="2147483647"
              :precision="0"
            />
          </FormItem>
          <FormItem
            label="推荐去 App Store 安装"
            name="remdAppstoreIns"
            :rules="requiredRules"
          >
            <Select
              v-model:value="form.remdAppstoreIns"
              :options="installOptions"
            />
          </FormItem>
        </Form>
      </Spin>
      <template #footer>
        <Button :disabled="saving" @click="closeModal">取消</Button>
        <Button
          type="primary"
          :loading="saving"
          :disabled="saveDisabled"
          @click="save"
        >
          保存
        </Button>
      </template>
    </Modal>
  </Page>
</template>
