<script setup lang="ts">
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { TableRowSelection } from 'ant-design-vue/es/table/interface';

import type { AppSpecial } from '#/api';

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
  Form,
  FormItem,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getAppSpecialListApi,
  removeAppSpecialAppsApi,
  updateAppSpecialOrderApi,
} from '#/api';
import CacheReloadButton from '#/components/cache-reload-button.vue';
import { useMenuTitle } from '#/composables/use-menu-title';

import { optionLabel, priceOptions } from '../app-info/data';
import CandidateAppsPanel from './candidate-apps-panel.vue';

const title = useMenuTitle();
const records = ref<AppSpecial[]>([]);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
const loading = ref(false);
const listFailed = ref(false);
const working = ref(false);
const candidateWorking = ref(false);
const candidateRevision = ref(0);
const filtersHost = ref<HTMLElement>();
const orderOpen = ref(false);
const selectedIds = ref<number[]>([]);
const actionsDisabled = computed(
  () =>
    loading.value ||
    listFailed.value ||
    working.value ||
    candidateWorking.value ||
    orderOpen.value,
);
let listRequest = 0;
const columns: TableColumnsType<AppSpecial> = [
  { dataIndex: 'id', title: '专题记录 ID', width: 130 },
  { dataIndex: 'appId', title: '应用 ID', width: 110 },
  { dataIndex: 'appName', title: '应用名称', width: 240, ellipsis: true },
  { dataIndex: 'orderNum', title: '排序号', width: 120 },
  { dataIndex: 'menuId', title: '专题栏目 ID', width: 130 },
  { dataIndex: 'sort', title: '应用类型', width: 100 },
  { dataIndex: 'status', title: '专题状态', width: 100 },
  { dataIndex: 'appStorePrice', title: '价格（元）', width: 120 },
  { dataIndex: 'appPriceFlag', title: '价格类型', width: 100 },
  { dataIndex: 'appStoreStatus', title: '上架状态', width: 100 },
  { key: 'action', title: '操作', width: 180, fixed: 'right' },
];
function validId(id: number) {
  return Number.isInteger(id) && id > 0;
}
const rowSelection = computed<TableRowSelection<AppSpecial>>(() => ({
  selectedRowKeys: selectedIds.value,
  onChange: (keys) => {
    selectedIds.value = keys.map(Number);
  },
  getCheckboxProps: (record) => ({
    disabled: actionsDisabled.value || !validId(record.id),
  }),
}));
async function loadList(
  page = pagination.current,
  pageSize = pagination.pageSize,
) {
  const request = ++listRequest;
  loading.value = true;
  listFailed.value = false;
  selectedIds.value = [];
  try {
    const data = await getAppSpecialListApi({ page, pageSize });
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
function changePage(value: TablePaginationConfig) {
  if (actionsDisabled.value) return;
  const pageSize = value.pageSize ?? pagination.pageSize;
  void loadList(
    pageSize === pagination.pageSize ? (value.current ?? 1) : 1,
    pageSize,
  );
}
async function remove(ids: number[]) {
  if (
    actionsDisabled.value ||
    ids.length === 0 ||
    !ids.every((id) => validId(id))
  )
    return;
  const snapshot = [...ids];
  working.value = true;
  try {
    await removeAppSpecialAppsApi(snapshot);
    message.success('专题应用已移除');
    candidateRevision.value += 1;
    await loadList();
  } catch {
    // 保留当前列表及选择，可重新确认后重试。
  } finally {
    working.value = false;
  }
}

const selected = ref<AppSpecial>();
const formRef = ref<FormInstance>();
const form = reactive({ order: undefined as number | undefined });
async function openOrder(record: AppSpecial) {
  if (actionsDisabled.value || !validId(record.id)) return;
  selected.value = { ...record };
  form.order = record.orderNum ?? undefined;
  orderOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}
function validOrder(_rule: unknown, value: unknown) {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 2_147_483_647
  )
    return Promise.resolve();
  return Promise.reject(new Error('请输入有效的非负整数排序号'));
}
async function saveOrder() {
  const current = selected.value;
  if (working.value || !current || !formRef.value) return;
  working.value = true;
  try {
    await formRef.value.validate();
    if (form.order === undefined) return;
    await updateAppSpecialOrderApi({ id: current.id, order: form.order });
    message.success('排序修改成功');
    orderOpen.value = false;
    await loadList();
  } catch {
    // 请求错误由拦截器提示，保留输入以便重试。
  } finally {
    working.value = false;
  }
}
onMounted(() => void loadList());
onBeforeUnmount(() => {
  ++listRequest;
});
</script>

<template>
  <Page :title="title">
    <div ref="filtersHost"></div>
    <Alert
      v-if="listFailed"
      class="mb-4"
      message="专题应用加载失败，请刷新重试"
      type="error"
      show-icon
    />
    <div class="special-apps-layout">
      <section class="special-apps-pane" aria-label="当前一级专题应用">
        <div class="special-apps-pane-header">
          <h3 class="text-base font-medium">当前专题应用</h3>
          <Space :size="8">
            <CacheReloadButton
              :cache-type="72"
              label="装机必备"
              size="small"
              :disabled="working || candidateWorking || orderOpen"
            />
            <Button
              size="small"
              :loading="loading"
              :disabled="working || candidateWorking || orderOpen"
              @click="loadList()"
            >
              刷新
            </Button>
            <Popconfirm
              :title="`确定移除选中的 ${selectedIds.length} 条专题应用吗？`"
              ok-text="移除"
              cancel-text="取消"
              :disabled="actionsDisabled || selectedIds.length === 0"
              @confirm="remove(selectedIds)"
            >
              <Button
                size="small"
                danger
                :disabled="actionsDisabled || selectedIds.length === 0"
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
          row-key="id"
          :row-selection="rowSelection"
          :scroll="{ x: 1500 }"
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
            <Space v-if="column.key === 'action'" :size="0">
              <Button
                type="link"
                size="small"
                :disabled="actionsDisabled || !validId(record.id)"
                @click="openOrder(record as AppSpecial)"
              >
                修改排序
              </Button>
              <Popconfirm
                :title="`确定移除「${record.appName ?? record.appId}」吗？`"
                ok-text="移除"
                cancel-text="取消"
                :disabled="actionsDisabled || !validId(record.id)"
                @confirm="remove([record.id])"
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  :disabled="actionsDisabled || !validId(record.id)"
                >
                  移除
                </Button>
              </Popconfirm>
            </Space>
            <template v-else-if="column.dataIndex === 'orderNum'">
              {{ text === 0 ? '0（未排序）' : (text ?? '—') }}
            </template>
            <template v-else-if="column.dataIndex === 'sort'">
              {{ text === null ? '—' : text === 1 ? '软件' : '游戏' }}
            </template>
            <Tag
              v-else-if="column.dataIndex === 'status'"
              :color="text === 1 ? 'success' : 'default'"
            >
              {{ text === 1 ? '有效' : text === 0 ? '无效' : (text ?? '—') }}
            </Tag>
            <template v-else-if="column.dataIndex === 'appPriceFlag'">
              {{ optionLabel(priceOptions, text) }}
            </template>
            <template v-else-if="column.dataIndex === 'appStoreStatus'">
              {{ text === 1 ? '上架' : text === 0 ? '下架' : (text ?? '—') }}
            </template>
            <template v-else>{{ text ?? '—' }}</template>
          </template>
        </Table>
      </section>
      <CandidateAppsPanel
        class="special-apps-pane special-apps-candidates"
        :disabled="working || orderOpen"
        :filter-target="filtersHost"
        :revision="candidateRevision"
        @busy="candidateWorking = $event"
        @added="loadList()"
      />
    </div>
    <Modal
      :open="orderOpen"
      :title="`修改排序：${selected?.appName ?? selected?.appId ?? ''}`"
      :confirm-loading="working"
      :closable="!working"
      :keyboard="!working"
      :mask-closable="false"
      :cancel-button-props="{ disabled: working }"
      ok-text="保存"
      cancel-text="取消"
      @cancel="orderOpen = false"
      @ok="saveOrder"
    >
      <Form
        ref="formRef"
        name="app-special-order"
        :model="form"
        :disabled="working"
        layout="vertical"
      >
        <FormItem
          label="排序号"
          name="order"
          :rules="[{ validator: validOrder }]"
        >
          <InputNumber
            v-model:value="form.order"
            :min="0"
            :max="2147483647"
            :precision="0"
            class="w-full"
          />
        </FormItem>
        <p class="text-muted-foreground text-sm">0 表示未排序。</p>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.special-apps-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  width: 100%;
  min-width: 0;
}

.special-apps-pane {
  flex: 1 1 0%;
  width: 0;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgb(128 128 128 / 25%);
  border-radius: 8px;
}

.special-apps-candidates {
  flex-grow: 1.2;
}

.special-apps-layout :deep(.special-apps-pane-header) {
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

.special-apps-layout :deep(.special-apps-pane-header h3),
.special-apps-layout :deep(.special-apps-pane-header .ant-space) {
  flex-shrink: 0;
}

.special-apps-layout :deep(.ant-table-wrapper) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.special-apps-layout :deep(.ant-table-thead > tr > th) {
  white-space: nowrap;
}

.special-apps-layout :deep(.ant-table-pagination) {
  margin: 12px;
}
</style>
