<script setup lang="ts">
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';

import type { ClientSwitch, ClientSwitchInput } from '#/api';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  addClientSwitchApi,
  deleteClientSwitchApi,
  getClientSwitchDetailsApi,
  getClientSwitchListApi,
  updateClientSwitchApi,
} from '#/api';
import CacheReloadButton from '#/components/cache-reload-button.vue';
import { useMenuTitle } from '#/composables/use-menu-title';
import { usePagedList } from '#/composables/use-paged-list';

const menuTitle = useMenuTitle();
const columns: TableColumnsType<ClientSwitch> = [
  { dataIndex: 'id', title: 'ID', width: 80 },
  {
    dataIndex: 'clientVersion',
    ellipsis: true,
    title: '客户端版本号',
    width: 180,
  },
  { dataIndex: 'switchType', title: '壳开关', width: 100 },
  { dataIndex: 'createUser', ellipsis: true, title: '创建人', width: 150 },
  { dataIndex: 'createTime', title: '创建时间', width: 180 },
  { dataIndex: 'updateTime', title: '修改时间', width: 180 },
  { dataIndex: 'status', title: '记录状态', width: 100 },
  { fixed: 'right', key: 'action', title: '操作', width: 200 },
];
const deletingId = ref<number>();
const {
  records,
  loading,
  failed: listFailed,
  pagination,
  load: loadList,
} = usePagedList((page, pageSize) =>
  getClientSwitchListApi({ page, pageSize }),
);
const saving = ref(false);
const busy = computed(() => saving.value || deletingId.value !== undefined);

function changePage(value: TablePaginationConfig) {
  const pageSize = value.pageSize ?? pagination.pageSize;
  void loadList(
    pageSize === pagination.pageSize ? (value.current ?? 1) : 1,
    pageSize,
  );
}

const modalOpen = ref(false);
const mode = ref<'add' | 'detail' | 'edit'>('add');
const detailLoading = ref(false);
const detailFailed = ref(false);
const selectedId = ref<number>();
const detail = ref<ClientSwitch>();
const formRef = ref<FormInstance>();
const readonly = computed(() => mode.value === 'detail');
const modalTitle = computed(
  () =>
    ({
      add: '新增客户端壳开关',
      detail: '客户端壳开关详情',
      edit: '编辑客户端壳开关',
    })[mode.value],
);
const switchOptions = [
  { label: '关闭', value: 0 },
  { label: '开启', value: 1 },
];
const requiredRules = [
  { required: true, whitespace: true, message: '请填写此项' },
];
const form = reactive({
  clientVersion: '',
  createUser: '',
  switchType: 0 as 0 | 1,
});
let detailRequest = 0;

async function openModal(nextMode: 'add' | 'detail' | 'edit', id?: number) {
  if (busy.value) return;
  const request = ++detailRequest;
  mode.value = nextMode;
  selectedId.value = id;
  detail.value = undefined;
  detailFailed.value = false;
  Object.assign(form, { clientVersion: '', createUser: '', switchType: 0 });
  modalOpen.value = true;
  detailLoading.value = id !== undefined;
  await nextTick();
  formRef.value?.clearValidate();
  if (id === undefined) return;
  try {
    const data = await getClientSwitchDetailsApi(id);
    if (request !== detailRequest) return;
    detail.value = data;
    Object.assign(form, {
      clientVersion: data.clientVersion ?? '',
      createUser: data.createUser ?? '',
      switchType: data.switchType,
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
  } catch {
    saving.value = false;
    return;
  }
  try {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const data: ClientSwitchInput = {
      clientVersion: form.clientVersion.trim(),
      createTime: detail.value?.createTime || now,
      createUser: form.createUser.trim(),
      status: detail.value?.status ?? 1,
      switchType: form.switchType,
      updateTime: now,
    };
    if (mode.value === 'edit') {
      if (selectedId.value === undefined) return;
      await updateClientSwitchApi({ ...data, id: selectedId.value });
    } else {
      await addClientSwitchApi(data);
    }
    message.success(
      mode.value === 'edit' ? '客户端壳开关修改成功' : '客户端壳开关新增成功',
    );
    modalOpen.value = false;
    await loadList(mode.value === 'add' ? 1 : pagination.current);
  } catch {
    // 请求拦截器统一提示错误，保留输入供重试。
  } finally {
    saving.value = false;
  }
}

async function remove(id: number) {
  if (busy.value) return;
  deletingId.value = id;
  try {
    await deleteClientSwitchApi(id);
    message.success('客户端壳开关删除成功');
    await loadList();
  } catch {
    // 请求拦截器统一提示错误，失败时保留列表。
  } finally {
    deletingId.value = undefined;
  }
}

function formatTime(value?: null | string) {
  return value?.replace('T', ' ') || '—';
}

onMounted(() => void loadList());
</script>

<template>
  <Page :title="menuTitle" description="按客户端版本管理壳开关">
    <Card title="客户端壳开关列表">
      <template #extra>
        <Space>
          <CacheReloadButton
            :cache-type="401"
            label="客户端壳开关"
            :disabled="busy"
          />
          <Button :loading="loading" :disabled="busy" @click="loadList()">
            刷新
          </Button>
          <Button type="primary" :disabled="busy" @click="openModal('add')">
            新增开关
          </Button>
        </Space>
      </template>
      <Alert
        v-if="listFailed"
        class="mb-4"
        message="客户端壳开关列表加载失败，请刷新重试"
        show-icon
        type="error"
      />
      <Table
        :columns="columns"
        :data-source="records"
        :loading="loading || deletingId !== undefined"
        :pagination="{
          ...pagination,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `共 ${total} 条`,
        }"
        :scroll="{ x: 1170 }"
        row-key="id"
        @change="changePage"
      >
        <template #bodyCell="{ column, record, text }">
          <Space v-if="column.key === 'action'" :size="0">
            <Button
              size="small"
              type="link"
              :disabled="busy"
              @click="openModal('detail', record.id)"
            >
              详情
            </Button>
            <Button
              size="small"
              type="link"
              :disabled="busy || record.status === 0"
              @click="openModal('edit', record.id)"
            >
              编辑
            </Button>
            <Popconfirm
              :title="`确认删除客户端版本 ${record.clientVersion} 的壳开关？`"
              ok-text="删除"
              cancel-text="取消"
              :disabled="busy || record.status === 0"
              @confirm="remove(record.id)"
            >
              <Button
                size="small"
                type="link"
                danger
                :disabled="busy || record.status === 0"
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
          <Tag
            v-else-if="column.dataIndex === 'switchType'"
            :color="record.switchType === 1 ? 'success' : 'default'"
          >
            {{ record.switchType === 1 ? '开启' : '关闭' }}
          </Tag>
          <Tag
            v-else-if="column.dataIndex === 'status'"
            :color="record.status === 1 ? 'success' : 'default'"
          >
            {{ record.status === 1 ? '正常' : '已删除' }}
          </Tag>
          <template
            v-else-if="
              column.dataIndex === 'createTime' ||
              column.dataIndex === 'updateTime'
            "
          >
            {{ formatTime(text) }}
          </template>
          <template v-else>{{ text || '—' }}</template>
        </template>
      </Table>
    </Card>

    <Modal
      :open="modalOpen"
      :title="modalTitle"
      :width="560"
      :closable="!saving"
      :keyboard="!saving"
      :mask-closable="false"
      @cancel="closeModal"
    >
      <Spin :spinning="detailLoading">
        <Alert
          v-if="detailFailed"
          message="客户端壳开关详情加载失败，请重试"
          show-icon
          type="error"
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
          :model="form"
          :disabled="readonly || detailLoading || saving"
          layout="vertical"
        >
          <FormItem
            label="客户端版本号"
            name="clientVersion"
            :rules="requiredRules"
          >
            <Input v-model:value="form.clientVersion" placeholder="例如 213" />
          </FormItem>
          <FormItem label="壳开关" name="switchType">
            <Select v-model:value="form.switchType" :options="switchOptions" />
          </FormItem>
          <FormItem label="创建人" name="createUser" :rules="requiredRules">
            <Input v-model:value="form.createUser" placeholder="请输入创建人" />
          </FormItem>
          <div
            v-if="detail"
            class="text-muted-foreground flex flex-col gap-2 text-sm"
          >
            <span>ID：{{ detail.id }}</span>
            <span>记录状态：{{ detail.status === 1 ? '正常' : '已删除' }}</span>
            <span>创建时间：{{ formatTime(detail.createTime) }}</span>
            <span>修改时间：{{ formatTime(detail.updateTime) }}</span>
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
