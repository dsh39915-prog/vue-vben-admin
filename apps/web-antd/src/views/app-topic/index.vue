<script setup lang="ts">
import type { FormInstance, TableColumnsType } from 'ant-design-vue';
import type { TableRowSelection } from 'ant-design-vue/es/table/interface';

import type { AppTopic, AppTopicInput, AppTopicQuery } from '#/api';

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
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import { getAppTopicListApi, removeAppTopicsApi, saveAppTopicApi } from '#/api';
import CacheReloadButton from '#/components/cache-reload-button.vue';
import { useMenuTitle } from '#/composables/use-menu-title';

import { optionLabel } from '../app-info/data';
import {
  nameOptions,
  platformOptions,
  recommendationOptions,
  topicStatusOptions,
  validId,
  validOrder,
  withAll,
} from './data';
import TopicAppsModal from './topic-apps-modal.vue';
import { useTopicPage } from './use-topic-page';

const title = useMenuTitle();
type Filters = Omit<AppTopicQuery, 'page' | 'pageSize'>;
function emptyFilters(): Filters {
  return { status: -1, isShowName: -1, remd: -1, platform: -1, name: '' };
}
const filters = reactive(emptyFilters());
let applied = emptyFilters();
const working = ref(false);
const editorOpen = ref(false);
const membersOpen = ref(false);
const activeTopic = ref<AppTopic>();
const { change, failed, load, loading, pagination, records, selectedIds } =
  useTopicPage(
    (page, pageSize, signal) =>
      getAppTopicListApi({ ...applied, page, pageSize }, signal),
    () => working.value || editorOpen.value || membersOpen.value,
  );
const actionsDisabled = computed(
  () =>
    loading.value ||
    failed.value ||
    working.value ||
    editorOpen.value ||
    membersOpen.value,
);
const filterFields = [
  { key: 'status', label: '专题状态', options: withAll(topicStatusOptions) },
  { key: 'isShowName', label: '是否显示名称', options: withAll(nameOptions) },
  { key: 'remd', label: '推荐类型', options: withAll(recommendationOptions) },
  { key: 'platform', label: '运行平台', options: withAll(platformOptions) },
] as const;
const columns: TableColumnsType<AppTopic> = [
  { dataIndex: 'id', title: '专题 ID', width: 100 },
  { dataIndex: 'name', title: '专题名称', width: 180, ellipsis: true },
  { dataIndex: 'title', title: '专题标题', width: 180, ellipsis: true },
  { dataIndex: 'remd', title: '推荐类型', width: 120 },
  { dataIndex: 'site', title: '排序位置', width: 100 },
  { dataIndex: 'platform', title: '运行平台', width: 150 },
  { dataIndex: 'isShowName', title: '显示名称', width: 100 },
  { dataIndex: 'status', title: '专题状态', width: 100 },
  { dataIndex: 'onLineTime', title: '上线日期', width: 130 },
  { dataIndex: 'offLineTime', title: '下线日期', width: 130 },
  {
    dataIndex: 'appName',
    title: '应用预览（前五个）',
    width: 280,
    ellipsis: true,
  },
  { dataIndex: 'appIdStr', title: '专题应用 ID', width: 260, ellipsis: true },
  { dataIndex: 'createTime', title: '创建时间', width: 180 },
  { dataIndex: 'updateTime', title: '更新时间', width: 180 },
  { key: 'action', title: '操作', width: 230, fixed: 'right' },
];
const rowSelection = computed<TableRowSelection<AppTopic>>(() => ({
  selectedRowKeys: selectedIds.value,
  onChange: (keys) => {
    selectedIds.value = keys.map(Number);
  },
  getCheckboxProps: (record) => ({
    disabled: actionsDisabled.value || !validId(record.id),
  }),
}));
function search() {
  if (working.value || editorOpen.value || membersOpen.value) return;
  applied = { ...filters, name: filters.name.trim() };
  void load(1);
}
function reset() {
  Object.assign(filters, emptyFilters());
  search();
}
async function remove(ids: number[]) {
  if (
    actionsDisabled.value ||
    ids.length === 0 ||
    !ids.every((id) => validId(id))
  )
    return;
  working.value = true;
  try {
    const success = await removeAppTopicsApi([...ids]);
    if (!success) {
      message.error('专题删除失败，请重试');
      return;
    }
    message.success('专题已删除');
    await load();
  } catch {
    /* 拦截器显示错误，保留列表与选择。 */
  } finally {
    working.value = false;
  }
}
function manage(record: AppTopic) {
  if (actionsDisabled.value || !validId(record.id)) return;
  activeTopic.value = { ...record };
  membersOpen.value = true;
}
const selectedId = ref<number>();
function emptyForm(): Omit<AppTopicInput, 'id'> {
  return {
    name: '',
    title: '',
    remd: 1,
    site: 0,
    platform: 101,
    isShowName: 1,
    onLineTime: '',
    offLineTime: '',
  };
}
const form = reactive(emptyForm());
const formRef = ref<FormInstance>();
const requiredText = [
  { required: true, whitespace: true, message: '请填写此项' },
];
const requiredChoice = [{ required: true, message: '请选择此项' }];
async function openEditor(record?: AppTopic) {
  if (working.value || membersOpen.value || (record && actionsDisabled.value))
    return;
  selectedId.value = record?.id;
  Object.assign(
    form,
    record
      ? {
          name: record.name ?? '',
          title: record.title ?? '',
          remd: record.remd,
          site: record.site,
          platform: record.platform,
          isShowName: record.isShowName,
          onLineTime: record.onLineTime?.slice(0, 10) ?? '',
          offLineTime: record.offLineTime?.slice(0, 10) ?? '',
        }
      : emptyForm(),
  );
  editorOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}
function validDates() {
  if (form.offLineTime && form.onLineTime && form.offLineTime < form.onLineTime)
    return Promise.reject(new Error('下线日期不能早于上线日期'));
  return Promise.resolve();
}
async function save() {
  if (working.value || !formRef.value) return;
  working.value = true;
  try {
    await formRef.value.validate();
    const data: AppTopicInput = {
      ...form,
      name: form.name.trim(),
      title: form.title.trim(),
    };
    if (selectedId.value !== undefined) data.id = selectedId.value;
    const result = await saveAppTopicApi(data);
    if (result !== 'success') {
      message.error('专题保存失败，请重试');
      return;
    }
    message.success('专题保存成功');
    editorOpen.value = false;
    await load(selectedId.value === undefined ? 1 : pagination.current);
  } catch {
    /* 保留输入，接口错误由拦截器显示。 */
  } finally {
    working.value = false;
  }
}
onMounted(() => void load());
</script>

<template>
  <Page :title="title">
    <Card class="filter-card" title="筛选条件">
      <Form
        name="app-topic-filters"
        :model="filters"
        :disabled="working || editorOpen || membersOpen"
        layout="vertical"
        @finish="search"
      >
        <Row :gutter="16">
          <Col
            v-for="field in filterFields"
            :key="field.key"
            :xs="24"
            :sm="12"
            :lg="6"
            :xl="3"
          >
            <FormItem :label="field.label" :name="field.key">
              <Select
                v-model:value="filters[field.key]"
                :options="field.options"
              />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="24" :lg="12" :xl="12">
            <FormItem label="专题名称" name="name">
              <Input
                v-model:value="filters.name"
                placeholder="请输入专题名称"
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
    <Card title="专题列表">
      <template #extra>
        <Space>
          <CacheReloadButton
            :cache-type="83"
            label="应用列表专题"
            :disabled="working || editorOpen || membersOpen"
          />
          <Button
            :loading="loading"
            :disabled="working || editorOpen || membersOpen"
            @click="load()"
          >
            刷新
          </Button>
          <Popconfirm
            :title="`确定删除选中的 ${selectedIds.length} 个专题吗？`"
            ok-text="删除"
            cancel-text="取消"
            :disabled="actionsDisabled || selectedIds.length === 0"
            @confirm="remove(selectedIds)"
          >
            <Button
              danger
              :disabled="actionsDisabled || selectedIds.length === 0"
            >
              删除选中（{{ selectedIds.length }}）
            </Button>
          </Popconfirm>
          <Button
            type="primary"
            :disabled="working || editorOpen || membersOpen"
            @click="openEditor()"
          >
            新增专题
          </Button>
        </Space>
      </template>
      <Alert
        v-if="failed"
        class="mb-4"
        message="专题列表加载失败，请刷新重试"
        type="error"
        show-icon
      />
      <Table
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :row-selection="rowSelection"
        row-key="id"
        :scroll="{ x: 2520 }"
        :pagination="{
          ...pagination,
          disabled: actionsDisabled,
          showSizeChanger: true,
          pageSizeOptions: ['20', '50', '100'],
          showTotal: (total) => `共 ${total} 条`,
        }"
        @change="change"
      >
        <template #bodyCell="{ column, record, text }">
          <Space v-if="column.key === 'action'" :size="0">
            <Button
              type="link"
              size="small"
              :disabled="actionsDisabled"
              @click="openEditor(record as AppTopic)"
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              :disabled="actionsDisabled"
              @click="manage(record as AppTopic)"
            >
              管理应用
            </Button>
            <Popconfirm
              :title="`确定删除专题「${record.name}」吗？`"
              ok-text="删除"
              cancel-text="取消"
              :disabled="actionsDisabled"
              @confirm="remove([record.id])"
            >
              <Button
                type="link"
                size="small"
                danger
                :disabled="actionsDisabled"
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
          <template v-else-if="column.dataIndex === 'remd'">
            {{ optionLabel(recommendationOptions, text) }}
          </template>
          <template v-else-if="column.dataIndex === 'platform'">
            {{ optionLabel(platformOptions, text) }}
          </template>
          <template v-else-if="column.dataIndex === 'isShowName'">
            {{ optionLabel(nameOptions, text) }}
          </template>
          <Tag
            v-else-if="column.dataIndex === 'status'"
            :color="text === 1 ? 'success' : 'default'"
          >
            {{ optionLabel(topicStatusOptions, text) }}
          </Tag>
          <template v-else>{{ text ?? '—' }}</template>
        </template>
      </Table>
    </Card>
    <TopicAppsModal
      v-model:open="membersOpen"
      :topic="activeTopic"
      @changed="load()"
    />
    <Modal
      :open="editorOpen"
      :title="selectedId === undefined ? '新增专题' : '编辑专题'"
      :width="760"
      :mask-closable="false"
      :closable="!working"
      :keyboard="!working"
      @cancel="editorOpen = false"
    >
      <Form
        ref="formRef"
        name="app-topic-editor"
        :model="form"
        :disabled="working"
        layout="vertical"
      >
        <Row :gutter="16">
          <Col :xs="24" :sm="12">
            <FormItem label="专题名称" name="name" :rules="requiredText">
              <Input v-model:value="form.name" />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12">
            <FormItem label="专题标题" name="title" :rules="requiredText">
              <Input v-model:value="form.title" />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12">
            <FormItem label="推荐类型" name="remd" :rules="requiredChoice">
              <Select
                v-model:value="form.remd"
                :options="recommendationOptions"
              />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12">
            <FormItem
              label="排序位置"
              name="site"
              :rules="[{ validator: validOrder }]"
            >
              <InputNumber
                v-model:value="form.site"
                :min="0"
                :max="2147483647"
                :precision="0"
                class="w-full"
              />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12">
            <FormItem label="运行平台" name="platform" :rules="requiredChoice">
              <Select
                v-model:value="form.platform"
                :options="platformOptions"
              />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12">
            <FormItem
              label="是否显示名称"
              name="isShowName"
              :rules="requiredChoice"
            >
              <Select v-model:value="form.isShowName" :options="nameOptions" />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12">
            <FormItem
              label="上线日期"
              name="onLineTime"
              :rules="requiredChoice"
            >
              <DatePicker
                v-model:value="form.onLineTime"
                value-format="YYYY-MM-DD"
                class="w-full"
              />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12">
            <FormItem
              label="下线日期"
              name="offLineTime"
              :rules="[...requiredChoice, { validator: validDates }]"
            >
              <DatePicker
                v-model:value="form.offLineTime"
                value-format="YYYY-MM-DD"
                class="w-full"
              />
            </FormItem>
          </Col>
        </Row>
      </Form>
      <template #footer>
        <Button :disabled="working" @click="editorOpen = false"> 取消 </Button>
        <Button type="primary" :loading="working" @click="save"> 保存 </Button>
      </template>
    </Modal>
  </Page>
</template>
