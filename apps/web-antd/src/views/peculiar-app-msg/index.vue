<script setup lang="ts">
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';

import type {
  PeculiarAppMsg,
  PeculiarAppMsgInput,
  PeculiarAppMsgQuery,
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
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getPeculiarAppMsgDetailsApi,
  getPeculiarAppMsgListApi,
  removePeculiarAppMsgApi,
  savePeculiarAppMsgApi,
} from '#/api';
import { useMenuTitle } from '#/composables/use-menu-title';

const title = useMenuTitle();
const { TextArea } = Input;
const statusOptions = [
  { label: '有效', value: 1 },
  { label: '无效', value: 0 },
];
const filterStatusOptions = [{ label: '全部', value: -1 }, ...statusOptions];
const popupTypeOptions = [
  { label: '安装弹窗', value: 1 },
  { label: '安装弹网页', value: 2 },
  { label: '爱思服务器安装弹窗', value: 3 },
  { label: 'store安装弹窗', value: 4 },
];
const columns: TableColumnsType<PeculiarAppMsg> = [
  { dataIndex: 'id', title: 'ID', width: 80 },
  { dataIndex: 'title', title: '标题', width: 200, ellipsis: true },
  { dataIndex: 'info', title: '详情', width: 300, ellipsis: true },
  { dataIndex: 'popupType', title: '弹窗类型', width: 180 },
  { dataIndex: 'status', title: '状态', width: 90 },
  { dataIndex: 'createTime', title: '创建时间', width: 180 },
  { dataIndex: 'updateTime', title: '更新时间', width: 180 },
  { key: 'action', title: '操作', width: 190, fixed: 'right' },
];
const filters = reactive<{ status: PeculiarAppMsgQuery['status'] }>({
  status: -1,
});
let appliedStatus: PeculiarAppMsgQuery['status'] = -1;
const records = ref<PeculiarAppMsg[]>([]);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
const loading = ref(false);
const listFailed = ref(false);
const saving = ref(false);
const deletingId = ref<number>();
const busy = computed(() => saving.value || deletingId.value !== undefined);
const actionsDisabled = computed(
  () => loading.value || listFailed.value || busy.value,
);
let listRequest = 0;

async function loadList(
  page = pagination.current,
  pageSize = pagination.pageSize,
) {
  const request = ++listRequest;
  loading.value = true;
  listFailed.value = false;
  try {
    const data = await getPeculiarAppMsgListApi({
      status: appliedStatus,
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
  if (busy.value) return;
  appliedStatus = filters.status;
  void loadList(1);
}
function reset() {
  if (busy.value) return;
  filters.status = -1;
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
function optionLabel(
  options: { label: string; value: number }[],
  value: null | number,
) {
  return options.find((item) => item.value === value)?.label ?? value ?? '—';
}
function formatTime(value: null | string) {
  return value?.replace('T', ' ') || '—';
}

const modalOpen = ref(false);
const mode = ref<'add' | 'detail' | 'edit'>('add');
const detailLoading = ref(false);
const detailFailed = ref(false);
const selectedId = ref<number>();
const detail = ref<PeculiarAppMsg>();
const formRef = ref<FormInstance>();
const readonly = computed(() => mode.value === 'detail');
const modalTitle = computed(
  () =>
    ({
      add: '新增特殊应用提示',
      detail: '特殊应用提示详情',
      edit: '编辑特殊应用提示',
    })[mode.value],
);
const requiredText = [
  { required: true, whitespace: true, message: '请填写此项' },
];
const requiredChoice = [{ required: true, message: '请选择此项' }];
let detailRequest = 0;
function emptyForm(): PeculiarAppMsgInput {
  return { title: '', info: '', status: 1, popupType: 1 };
}
const form = reactive<{
  info: string;
  popupType: PeculiarAppMsgInput['popupType'] | undefined;
  status: PeculiarAppMsgInput['status'] | undefined;
  title: string;
}>(emptyForm());

async function openModal(nextMode: 'add' | 'detail' | 'edit', id?: number) {
  if (busy.value || (id !== undefined && actionsDisabled.value)) return;
  const request = ++detailRequest;
  mode.value = nextMode;
  selectedId.value = id;
  detail.value = undefined;
  detailFailed.value = false;
  Object.assign(form, emptyForm());
  detailLoading.value = id !== undefined;
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
  if (id === undefined) return;
  try {
    const data = await getPeculiarAppMsgDetailsApi(id);
    if (request !== detailRequest) return;
    detail.value = data;
    Object.assign(form, {
      title: data.title ?? '',
      info: data.info ?? '',
      status: statusOptions.some((item) => item.value === data.status)
        ? data.status
        : undefined,
      popupType: popupTypeOptions.some((item) => item.value === data.popupType)
        ? data.popupType
        : undefined,
    });
  } catch {
    if (request === detailRequest) detailFailed.value = true;
  } finally {
    if (request === detailRequest) detailLoading.value = false;
  }
}
function closeModal() {
  if (saving.value) return;
  ++detailRequest;
  modalOpen.value = false;
}
async function save() {
  if (busy.value || readonly.value || detailLoading.value || detailFailed.value)
    return;
  saving.value = true;
  try {
    await formRef.value?.validate();
    if (form.status === undefined || form.popupType === undefined) return;
    const data: PeculiarAppMsgInput & { id?: number } = {
      title: form.title.trim(),
      info: form.info,
      status: form.status,
      popupType: form.popupType,
    };
    if (mode.value === 'edit') {
      if (selectedId.value === undefined) return;
      data.id = selectedId.value;
    }
    const success = await savePeculiarAppMsgApi(data);
    if (!success) {
      message.error('保存失败，请重试');
      return;
    }
    message.success(
      mode.value === 'add' ? '特殊应用提示新增成功' : '特殊应用提示修改成功',
    );
    modalOpen.value = false;
    await loadList(mode.value === 'add' ? 1 : pagination.current);
  } catch {
    // 请求错误由拦截器提示，保留表单以便重试。
  } finally {
    saving.value = false;
  }
}
async function remove(record: PeculiarAppMsg) {
  if (actionsDisabled.value || record.id <= 0) return;
  deletingId.value = record.id;
  try {
    const success = await removePeculiarAppMsgApi(record.id);
    if (!success) {
      message.error('删除失败，请重试');
      return;
    }
    message.success('特殊应用提示已删除');
    await loadList();
  } catch {
    // 保留当前列表，便于重新确认后重试。
  } finally {
    deletingId.value = undefined;
  }
}
onMounted(() => void loadList());
onBeforeUnmount(() => {
  ++listRequest;
  ++detailRequest;
});
</script>

<template>
  <Page :title="title">
    <Card class="filter-card" title="筛选条件">
      <Form
        name="peculiar-app-msg-filters"
        :model="filters"
        :disabled="busy"
        layout="vertical"
        @finish="search"
      >
        <Row :gutter="16">
          <Col :xs="24" :sm="12" :lg="6" :xl="3">
            <FormItem label="状态" name="status">
              <Select
                v-model:value="filters.status"
                :options="filterStatusOptions"
              />
            </FormItem>
          </Col>
        </Row>
        <div class="flex justify-end">
          <Space>
            <Button
              type="primary"
              html-type="submit"
              :loading="loading"
              :disabled="busy"
            >
              查询
            </Button>
            <Button :disabled="busy" @click="reset">重置</Button>
          </Space>
        </div>
      </Form>
    </Card>
    <Card title="特殊应用提示列表">
      <template #extra>
        <Space>
          <Button :loading="loading" :disabled="busy" @click="loadList()">
            刷新
          </Button>
          <Button type="primary" :disabled="busy" @click="openModal('add')">
            新增提示
          </Button>
        </Space>
      </template>
      <Alert
        v-if="listFailed"
        class="mb-4"
        message="特殊应用提示加载失败，请刷新重试"
        type="error"
        show-icon
      />
      <Table
        :columns="columns"
        :data-source="records"
        :loading="loading"
        row-key="id"
        :scroll="{ x: 1400 }"
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
              size="small"
              type="link"
              :disabled="actionsDisabled"
              @click="openModal('detail', record.id)"
            >
              详情
            </Button>
            <Button
              size="small"
              type="link"
              :disabled="actionsDisabled"
              @click="openModal('edit', record.id)"
            >
              编辑
            </Button>
            <Popconfirm
              :title="`确定删除「${record.title ?? record.id}」吗？`"
              ok-text="删除"
              cancel-text="取消"
              :disabled="actionsDisabled"
              @confirm="remove(record as PeculiarAppMsg)"
            >
              <Button
                size="small"
                type="link"
                danger
                :disabled="actionsDisabled"
                :loading="deletingId === record.id"
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
          <Tag
            v-else-if="column.dataIndex === 'status'"
            :color="text === 1 ? 'success' : 'default'"
          >
            {{ optionLabel(statusOptions, text) }}
          </Tag>
          <template v-else-if="column.dataIndex === 'popupType'">
            {{ optionLabel(popupTypeOptions, text) }}
          </template>
          <template
            v-else-if="
              column.dataIndex === 'createTime' ||
              column.dataIndex === 'updateTime'
            "
          >
            {{ formatTime(text) }}
          </template>
          <template v-else>{{ text ?? '—' }}</template>
        </template>
      </Table>
    </Card>

    <Modal
      :open="modalOpen"
      :title="modalTitle"
      :width="720"
      :closable="!saving"
      :keyboard="!saving"
      :mask-closable="false"
      @cancel="closeModal"
    >
      <Spin :spinning="detailLoading">
        <Alert
          v-if="detailFailed"
          message="特殊应用提示详情加载失败，请重试"
          type="error"
          show-icon
        >
          <template #action>
            <Button size="small" @click="openModal(mode, selectedId)">
              重试
            </Button>
          </template>
        </Alert>
        <Form
          v-else
          ref="formRef"
          name="peculiar-app-msg-editor"
          :model="form"
          :disabled="readonly || detailLoading || saving"
          layout="vertical"
        >
          <FormItem label="标题" name="title" :rules="requiredText">
            <Input v-model:value="form.title" placeholder="请输入标题" />
          </FormItem>
          <Row :gutter="16">
            <Col :xs="24" :sm="12">
              <FormItem label="状态" name="status" :rules="requiredChoice">
                <Select v-model:value="form.status" :options="statusOptions" />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="12">
              <FormItem
                label="弹窗类型"
                name="popupType"
                :rules="requiredChoice"
              >
                <Select
                  v-model:value="form.popupType"
                  :options="popupTypeOptions"
                />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="详情" name="info" :rules="requiredText">
            <TextArea
              v-model:value="form.info"
              :rows="8"
              placeholder="请输入提示详情或网页地址"
            />
          </FormItem>
          <div
            v-if="detail"
            class="text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 text-sm"
          >
            <span>ID：{{ detail.id }}</span>
            <span>创建时间：{{ formatTime(detail.createTime) }}</span>
            <span>更新时间：{{ formatTime(detail.updateTime) }}</span>
          </div>
        </Form>
      </Spin>
      <template #footer>
        <Button :disabled="saving" @click="closeModal">
          {{ readonly ? '关闭' : '取消' }}
        </Button>
        <Button
          v-if="!readonly"
          type="primary"
          :loading="saving"
          :disabled="detailLoading || detailFailed"
          @click="save"
        >
          保存
        </Button>
      </template>
    </Modal>
  </Page>
</template>
