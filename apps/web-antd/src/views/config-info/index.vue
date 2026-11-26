<script setup lang="ts">
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';

import type { ConfigInfo, ConfigInfoInput } from '#/api';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
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
  addConfigInfoApi,
  getConfigInfoDetailsApi,
  getConfigInfoListApi,
  updateConfigInfoApi,
} from '#/api';
import CacheReloadButton from '#/components/cache-reload-button.vue';
import { useMenuTitle } from '#/composables/use-menu-title';
import { usePagedList } from '#/composables/use-paged-list';

const { TextArea } = Input;
const menuTitle = useMenuTitle();
const {
  records,
  loading,
  failed: listFailed,
  pagination,
  load: loadList,
} = usePagedList((page, pageSize) => getConfigInfoListApi({ page, pageSize }));
type ConfigInfoForm = Omit<ConfigInfoInput, 'userName'> & { userName: string };

const columns: TableColumnsType<ConfigInfo> = [
  { dataIndex: 'id', title: 'ID', width: 80 },
  { dataIndex: 'configName', ellipsis: true, title: '配置名称', width: 200 },
  { dataIndex: 'configCode', ellipsis: true, title: '识别码', width: 180 },
  { dataIndex: 'configClientVersion', title: '客户端版本', width: 120 },
  { dataIndex: 'configInfoFormat', title: '内容格式', width: 100 },
  { dataIndex: 'status', title: '状态', width: 90 },
  { dataIndex: 'configNote', ellipsis: true, title: '配置说明', width: 220 },
  { dataIndex: 'userName', title: '用户名', width: 120 },
  { dataIndex: 'createTime', title: '创建时间', width: 180 },
  { dataIndex: 'updateTime', title: '更新时间', width: 180 },
  { fixed: 'right', key: 'action', title: '操作', width: 140 },
];

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
const saving = ref(false);
const selectedId = ref<number>();
const detail = ref<ConfigInfo>();
const formRef = ref<FormInstance>();
const readonly = computed(() => mode.value === 'detail');
const modalTitle = computed(
  () => ({ add: '新增配置', detail: '配置详情', edit: '编辑配置' })[mode.value],
);
const formatOptions = ['xml', 'json', 'text', 'html'].map((value) => ({
  value,
}));
const statusOptions = [
  { label: '有效', value: 1 },
  { label: '无效', value: 0 },
];
const requiredRules = [
  { required: true, whitespace: true, message: '请填写此项' },
];
let detailRequest = 0;

function emptyForm(): ConfigInfoForm {
  return {
    configClientVersion: '',
    configCode: '',
    configCondition: '',
    configInfo: '',
    configInfoFormat: 'xml',
    configName: '',
    configNote: '',
    status: 1,
    userName: '',
  };
}

const form = reactive<ConfigInfoForm>(emptyForm());

function fillForm(data: ConfigInfo) {
  Object.assign(form, {
    configClientVersion: data.configClientVersion ?? '',
    configCode: data.configCode ?? '',
    configCondition: data.configCondition ?? '',
    configInfo: data.configInfo ?? '',
    configInfoFormat: data.configInfoFormat ?? '',
    configName: data.configName ?? '',
    configNote: data.configNote ?? '',
    status: data.status,
    userName: data.userName ?? '',
  });
}

async function openModal(nextMode: 'add' | 'detail' | 'edit', id?: number) {
  const request = ++detailRequest;
  mode.value = nextMode;
  selectedId.value = id;
  detail.value = undefined;
  detailFailed.value = false;
  Object.assign(form, emptyForm());
  modalOpen.value = true;
  detailLoading.value = id !== undefined;
  await nextTick();
  formRef.value?.clearValidate();
  if (id === undefined) return;
  try {
    const data = await getConfigInfoDetailsApi(id);
    if (request !== detailRequest) return;
    detail.value = data;
    fillForm(data);
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
  if (
    saving.value ||
    readonly.value ||
    detailLoading.value ||
    detailFailed.value
  )
    return;
  saving.value = true;
  try {
    await formRef.value?.validate();
  } catch {
    saving.value = false;
    return;
  }
  try {
    const data: ConfigInfoInput = {
      ...form,
      configCode: form.configCode.trim(),
      configInfoFormat: form.configInfoFormat.trim(),
      configName: form.configName.trim(),
      userName: form.userName?.trim() || null,
    };
    if (mode.value === 'edit') {
      if (selectedId.value === undefined) return;
      await updateConfigInfoApi({ ...data, id: selectedId.value });
    } else {
      await addConfigInfoApi(data);
    }
    message.success(mode.value === 'edit' ? '配置修改成功' : '配置新增成功');
    modalOpen.value = false;
    await loadList(mode.value === 'add' ? 1 : pagination.current);
  } catch {
    // 请求拦截器统一展示错误，保留表单以便修改或重试。
  } finally {
    saving.value = false;
  }
}

function formatTime(value?: null | string) {
  return value?.replace('T', ' ') || '—';
}

onMounted(() => void loadList());
</script>

<template>
  <Page :title="menuTitle" description="管理客户端配置项、内容与生效状态">
    <Card title="配置列表">
      <template #extra>
        <Space>
          <CacheReloadButton
            :cache-type="2"
            label="配置管理"
            :disabled="saving"
          />
          <Button :loading="loading" @click="loadList()">刷新</Button>
          <Button type="primary" @click="openModal('add')">新增配置</Button>
        </Space>
      </template>
      <Alert
        v-if="listFailed"
        class="mb-4"
        message="配置列表加载失败，请刷新重试"
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
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `共 ${total} 条`,
        }"
        :scroll="{ x: 1710 }"
        row-key="id"
        @change="changePage"
      >
        <template #bodyCell="{ column, record, text }">
          <Space v-if="column.key === 'action'" :size="0">
            <Button
              size="small"
              type="link"
              @click="openModal('detail', record.id)"
            >
              详情
            </Button>
            <Button
              size="small"
              type="link"
              @click="openModal('edit', record.id)"
            >
              编辑
            </Button>
          </Space>
          <Tag
            v-else-if="column.dataIndex === 'status'"
            :color="record.status === 1 ? 'success' : 'default'"
          >
            {{ record.status === 1 ? '有效' : '无效' }}
          </Tag>
          <template v-else-if="column.dataIndex === 'createTime'">
            {{ formatTime(record.createTime || record.CreateTime) }}
          </template>
          <template v-else-if="column.dataIndex === 'updateTime'">
            {{ formatTime(record.updateTime || record.UpdateTime) }}
          </template>
          <template v-else>{{ text || '—' }}</template>
        </template>
      </Table>
    </Card>

    <Modal
      :open="modalOpen"
      :title="modalTitle"
      :width="880"
      :closable="!saving"
      :keyboard="!saving"
      :mask-closable="false"
      @cancel="closeModal"
    >
      <Spin :spinning="detailLoading">
        <Alert
          v-if="detailFailed"
          message="配置详情加载失败，请重试"
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
          <Row :gutter="16">
            <Col :xs="24" :sm="12">
              <FormItem
                label="配置名称"
                name="configName"
                :rules="requiredRules"
              >
                <Input
                  v-model:value="form.configName"
                  placeholder="请输入配置名称"
                />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="12">
              <FormItem label="识别码" name="configCode" :rules="requiredRules">
                <Input
                  v-model:value="form.configCode"
                  placeholder="例如 paperscreen_4"
                />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="12">
              <FormItem label="客户端版本" name="configClientVersion">
                <Input
                  v-model:value="form.configClientVersion"
                  placeholder="例如 220"
                />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="12">
              <FormItem
                label="内容格式"
                name="configInfoFormat"
                :rules="requiredRules"
              >
                <AutoComplete
                  v-model:value="form.configInfoFormat"
                  :options="formatOptions"
                  placeholder="请选择或输入内容格式"
                />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="12">
              <FormItem label="状态" name="status">
                <Select v-model:value="form.status" :options="statusOptions" />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="12">
              <FormItem label="用户名" name="userName">
                <Input
                  v-model:value="form.userName"
                  placeholder="请输入用户名（选填）"
                />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="筛选条件" name="configCondition">
            <TextArea
              v-model:value="form.configCondition"
              :rows="2"
              placeholder="请输入配置项筛选条件（选填）"
            />
          </FormItem>
          <FormItem label="配置内容" name="configInfo" :rules="requiredRules">
            <TextArea
              v-model:value="form.configInfo"
              class="font-mono"
              :rows="12"
              :spellcheck="false"
              placeholder="请输入配置内容"
            />
          </FormItem>
          <FormItem label="配置说明" name="configNote">
            <TextArea
              v-model:value="form.configNote"
              :rows="2"
              placeholder="请输入配置说明（选填）"
            />
          </FormItem>
          <div
            v-if="detail"
            class="text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 text-sm"
          >
            <span>ID：{{ detail.id }}</span>
            <span>
              创建时间：{{ formatTime(detail.createTime || detail.CreateTime) }}
            </span>
            <span>
              更新时间：{{ formatTime(detail.updateTime || detail.UpdateTime) }}
            </span>
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
