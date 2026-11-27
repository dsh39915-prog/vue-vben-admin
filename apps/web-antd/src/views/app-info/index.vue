<script setup lang="ts">
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { SorterResult } from 'ant-design-vue/es/table/interface';

import type {
  AppInfo,
  AppInfoInput,
  AppInfoQuery,
  AppSort,
  PeculiarAppMsg,
} from '#/api';

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
  DatePicker,
  Form,
  FormItem,
  Input,
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
  getAppInfoDetailsApi,
  getAppInfoListApi,
  getPeculiarAppMsgOptionsApi,
  updateAppInfoApi,
} from '#/api';
import DownloadStats from '#/components/download-stats.vue';
import PromotionPackage from '#/components/promotion-package.vue';
import { useAppCategories } from '#/composables/use-app-categories';
import { useMenuTitle } from '#/composables/use-menu-title';
import { usePagedList } from '#/composables/use-paged-list';

import AddRecommendationModal from './add-recommendation-modal.vue';
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
const sorting = ref<Pick<AppInfoQuery, 'order' | 'sort'>>({});
const {
  records,
  loading,
  failed: listFailed,
  pagination,
  load: loadList,
} = usePagedList((page, pageSize, signal) =>
  getAppInfoListApi(
    { ...appliedFilters, ...sorting.value, page, pageSize },
    signal,
  ),
);

function columnSortOrder(field: NonNullable<AppInfoQuery['sort']>) {
  if (sorting.value.sort !== field) return null;
  return sorting.value.order === 'asc' ? 'ascend' : 'descend';
}

const columns = computed<TableColumnsType<AppInfo>>(() => [
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
  {
    dataIndex: 'appStorePrice',
    title: '价格（元）',
    width: 120,
    sorter: true,
    sortOrder: columnSortOrder('appStorePrice'),
  },
  {
    key: 'downloadStats',
    dataIndex: 'downloadCount',
    title: '下载统计',
    width: 140,
    align: 'center',
    sorter: true,
    sortOrder: columnSortOrder('downloadCount'),
  },
  { dataIndex: 'createTime', title: '创建时间', width: 180 },
  { dataIndex: 'updateTime', title: '更新时间', width: 180 },
  { fixed: 'right', key: 'action', title: '操作', width: 140 },
]);

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
  sorting.value = {};
  search();
}

function changeTable(
  value: TablePaginationConfig,
  _filters: unknown,
  sorter: SorterResult<AppInfo> | SorterResult<AppInfo>[],
) {
  if (saving.value || modalOpen.value || recommendationOpen.value) return;
  const active = Array.isArray(sorter) ? sorter[0] : sorter;
  const next: Pick<AppInfoQuery, 'order' | 'sort'> =
    active?.order &&
    (active.field === 'appStorePrice' || active.field === 'downloadCount')
      ? {
          sort: active.field,
          order: active.order === 'ascend' ? 'asc' : 'desc',
        }
      : {};
  const changed =
    sorting.value.sort !== next.sort || sorting.value.order !== next.order;
  const size = value.pageSize ?? pagination.pageSize;
  sorting.value = next;
  void loadList(
    !changed && size === pagination.pageSize ? (value.current ?? 1) : 1,
    size,
  );
}

const {
  categories,
  loading: categoryLoading,
  failed: categoryFailed,
  load: loadCategories,
  refresh: refreshCategories,
} = useAppCategories();
const anyCategoryFailed = computed(
  () => categoryFailed[1] || categoryFailed[2],
);

function refreshList() {
  void refreshCategories();
  void loadList();
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
const recommendationOpen = ref(false);
const recommendationApp =
  ref<Pick<AppInfo, 'appName' | 'id' | 'platform' | 'sort'>>();
const rowActionDisabled = computed(
  () =>
    loading.value ||
    listFailed.value ||
    saving.value ||
    modalOpen.value ||
    recommendationOpen.value,
);
function openRecommendation(record: AppInfo) {
  if (rowActionDisabled.value || !Number.isInteger(record.id) || record.id <= 0)
    return;
  recommendationApp.value = {
    id: record.id,
    appName: record.appName,
    platform: record.platform,
    sort: record.sort,
  };
  recommendationOpen.value = true;
}
let detailRequest = 0;
const editCategoryOptions = computed(() =>
  (categories[form.sort] ?? []).map((item) => ({
    label: item.name,
    value: item.id,
  })),
);
const popupRecords = ref<PeculiarAppMsg[]>([]);
const popupLoading = ref(false);
const popupFailed = ref(false);
let popupRequest = 0;
const popupOptions = computed(() => {
  const options: { disabled?: boolean; label: string; value: number }[] = [
    { label: '无（不设置特殊弹窗）', value: 0 },
    ...[
      ...new Map(
        popupRecords.value
          .filter((item) => Number.isInteger(item.id) && item.id > 0)
          .map((item) => [item.id, item]),
      ).values(),
    ].map((item) => ({
      label: `${item.title?.trim() || '未命名提示'}（ID: ${item.id}）${item.status === 0 ? '（无效）' : ''}`,
      value: item.id,
    })),
  ];
  if (
    !popupLoading.value &&
    !popupFailed.value &&
    form.peculiarPopId > 0 &&
    !options.some((item) => item.value === form.peculiarPopId)
  ) {
    options.push({
      label: `特殊应用提示 ID: ${form.peculiarPopId}（列表未返回）`,
      value: form.peculiarPopId,
      disabled: true,
    });
  }
  return options;
});
async function loadPopupOptions() {
  const request = ++popupRequest;
  popupLoading.value = true;
  popupFailed.value = false;
  try {
    const data = await getPeculiarAppMsgOptionsApi();
    if (request === popupRequest) popupRecords.value = data;
  } catch {
    if (request === popupRequest) popupFailed.value = true;
  } finally {
    if (request === popupRequest) popupLoading.value = false;
  }
}
const saveDisabled = computed(
  () =>
    detailLoading.value ||
    detailFailed.value ||
    popupLoading.value ||
    popupFailed.value ||
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
  popupRecords.value = [];
  void loadPopupOptions();
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
  ++popupRequest;
  popupLoading.value = false;
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
onBeforeUnmount(() => {
  ++detailRequest;
  ++popupRequest;
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
        <Button :loading="loading" @click="refreshList">刷新</Button>
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
        :scroll="{ x: 2700 }"
        row-key="id"
        @change="changeTable"
      >
        <template #bodyCell="{ column, record, text }">
          <Space v-if="column.key === 'action'" :size="0">
            <Button
              type="link"
              size="small"
              :disabled="rowActionDisabled"
              @click="openEdit(record.id, record.appName)"
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              :disabled="
                rowActionDisabled ||
                !Number.isInteger(record.id) ||
                record.id <= 0
              "
              @click="openRecommendation(record as AppInfo)"
            >
              推荐
            </Button>
          </Space>
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
    <AddRecommendationModal
      v-model:open="recommendationOpen"
      :app="recommendationApp"
      @added="loadList()"
    />
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
            label="特殊应用弹窗"
            name="peculiarPopId"
            :rules="requiredRules"
          >
            <Select
              v-model:value="form.peculiarPopId"
              :options="popupOptions"
              :loading="popupLoading"
              :disabled="detailLoading || saving || popupLoading || popupFailed"
              placeholder="请选择特殊应用提示"
              show-search
              option-filter-prop="label"
            />
          </FormItem>
          <Alert
            v-if="popupFailed"
            class="mb-4"
            message="特殊应用提示加载失败，请重试"
            type="error"
            show-icon
          >
            <template #action>
              <Button size="small" :disabled="saving" @click="loadPopupOptions">
                重试特殊提示
              </Button>
            </template>
          </Alert>
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
