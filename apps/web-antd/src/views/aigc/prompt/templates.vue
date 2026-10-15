<script lang="ts" setup>
import type { FormInstance } from 'ant-design-vue';
import type { Dayjs } from 'dayjs';

import type {
  PromptCategoryRecord,
  PromptPageParams,
  PromptSaveParams,
} from '#/api';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  DatePicker,
  Form,
  FormItem,
  Image,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  createPromptApi,
  deletePromptApi,
  getPromptApi,
  getPromptCategoryListApi,
  getPromptPageApi,
  updatePromptApi,
} from '#/api';

import { useAigcPage } from '../common/use-page';
const categoriesLoading = ref(false);
const saving = ref(false);
const detailLoading = ref(false);
const deletingId = ref<number>();
const categories = ref<PromptCategoryRecord[]>([]);
const editorOpen = ref(false);
const readOnly = ref(false);
const formRef = ref<FormInstance>();
const query = reactive({
  categoryId: undefined as number | undefined,
  userPrompt: '',
});
const timeRange = ref<[Dayjs, Dayjs]>();
const {
  rows,
  loading,
  pager,
  pagination,
  load: loadRows,
  search: searchPage,
  change,
} = useAigcPage(
  getPromptPageApi,
  {} as Omit<PromptPageParams, 'page' | 'pageSize'>,
);
const editor = reactive<PromptSaveParams>({ name: '' });

const categoryOptions = computed(() =>
  categories.value.map((item) => ({ label: item.name, value: item.id })),
);
const editorCategoryOptions = computed(() => {
  const options = [...categoryOptions.value];
  if (
    editor.categoryId !== undefined &&
    !options.some((item) => item.value === editor.categoryId)
  ) {
    options.push({
      label: `类别 #${editor.categoryId}`,
      value: editor.categoryId,
    });
  }
  return options;
});
const editorTitle = computed(() =>
  readOnly.value
    ? '提示词详情'
    : editor.id === undefined
      ? '新增提示词'
      : '编辑提示词',
);
const referenceUrl = computed(() =>
  /^https?:\/\//i.test(editor.referenceImg ?? '')
    ? editor.referenceImg
    : undefined,
);
const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '名称', dataIndex: 'name', width: 200 },
  { title: '类别', key: 'category', width: 160 },
  { title: '用户提示词', dataIndex: 'userPrompt', ellipsis: true, width: 280 },
  {
    title: '系统提示词',
    dataIndex: 'systemPrompt',
    ellipsis: true,
    width: 240,
  },
  { title: '描述', dataIndex: 'description', ellipsis: true, width: 200 },
  { title: '操作', key: 'action', width: 210, fixed: 'right' as const },
];

function categoryName(id?: number) {
  if (id === undefined || id === null) return '未分类';
  return categories.value.find((item) => item.id === id)?.name ?? `类别 #${id}`;
}

async function loadCategories() {
  categoriesLoading.value = true;
  try {
    categories.value = await getPromptCategoryListApi();
  } catch {
    // The shared request interceptor displays API errors.
  } finally {
    categoriesLoading.value = false;
  }
}

function search() {
  return searchPage({
    categoryId: query.categoryId,
    userPrompt: query.userPrompt.trim() || undefined,
    beginTime: timeRange.value?.[0].format('YYYY-MM-DD'),
    endTime: timeRange.value?.[1].format('YYYY-MM-DD'),
  });
}

function reset() {
  query.categoryId = undefined;
  query.userPrompt = '';
  timeRange.value = undefined;
  search();
}

async function refresh() {
  await Promise.all([loadCategories(), loadRows()]);
}

async function openEditor(id?: number, view = false) {
  if (detailLoading.value) return;
  detailLoading.value = true;
  try {
    const data = id === undefined ? undefined : await getPromptApi(id);
    if (data === null) {
      message.warning('该提示词不存在，请刷新列表');
      return;
    }
    editor.id = data?.id;
    editor.name = data?.name ?? '';
    editor.categoryId = data?.categoryId;
    editor.userPrompt = data?.userPrompt ?? '';
    editor.systemPrompt = data?.systemPrompt ?? '';
    editor.referenceImg = data?.referenceImg ?? '';
    editor.description = data?.description ?? '';
    readOnly.value = view;
    formRef.value?.clearValidate();
    editorOpen.value = true;
    void loadCategories();
  } catch {
    // The shared request interceptor displays API errors.
  } finally {
    detailLoading.value = false;
  }
}

async function save() {
  if (saving.value) return;
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  saving.value = true;
  try {
    const data: PromptSaveParams = {
      name: editor.name.trim(),
      categoryId: editor.categoryId,
      userPrompt: editor.userPrompt,
      systemPrompt: editor.systemPrompt,
      referenceImg: editor.referenceImg,
      description: editor.description,
    };
    if (editor.id === undefined) {
      await createPromptApi(data);
      pager.current = 1;
    } else {
      await updatePromptApi({ ...data, id: editor.id });
    }
    message.success('保存成功');
    editorOpen.value = false;
    await loadRows();
  } catch {
    // Keep the form open when saving fails.
  } finally {
    saving.value = false;
  }
}

async function remove(id: number) {
  if (deletingId.value !== undefined) return;
  deletingId.value = id;
  try {
    await deletePromptApi(id);
    message.success('删除成功');
    if (rows.value.length === 1 && pager.current > 1) pager.current -= 1;
    await loadRows();
  } catch {
    // The shared request interceptor displays API errors.
  } finally {
    deletingId.value = undefined;
  }
}

onMounted(refresh);
</script>

<template>
  <Page title="AI 提示词" description="维护用户提示词、系统提示词和参考图">
    <Card class="mb-4!" :bordered="false">
      <Form :model="query" layout="inline" @finish="search">
        <FormItem label="类别">
          <Select
            v-model:value="query.categoryId"
            :options="categoryOptions"
            :loading="categoriesLoading"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="全部类别"
            style="width: 180px"
            @dropdown-visible-change="(open) => open && loadCategories()"
          />
        </FormItem>
        <FormItem label="用户提示词">
          <Input
            v-model:value="query.userPrompt"
            allow-clear
            placeholder="请输入用户提示词"
          />
        </FormItem>
        <FormItem label="时间范围">
          <DatePicker.RangePicker v-model:value="timeRange" />
        </FormItem>
        <FormItem>
          <Space>
            <Button type="primary" html-type="submit" :loading="loading">
              <span>查询</span>
            </Button>
            <Button @click="reset">
              <span>重置</span>
            </Button>
          </Space>
        </FormItem>
      </Form>
    </Card>
    <Card title="提示词列表" :bordered="false">
      <template #extra>
        <Space>
          <Button :loading="loading" @click="refresh">
            <span>刷新</span>
          </Button>
          <Button
            type="primary"
            :disabled="detailLoading"
            @click="openEditor()"
          >
            <span>新增提示词</span>
          </Button>
        </Space>
      </template>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1370 }"
        row-key="id"
        @change="change"
      >
        <template #bodyCell="{ column, record }">
          <Tag v-if="column.key === 'category'" color="blue">
            <span>{{ categoryName(record.categoryId) }}</span>
          </Tag>
          <Space v-else-if="column.key === 'action'">
            <Button
              type="link"
              size="small"
              :disabled="detailLoading"
              @click="openEditor(record.id, true)"
            >
              <span>详情</span>
            </Button>
            <Button
              type="link"
              size="small"
              :disabled="detailLoading"
              @click="openEditor(record.id)"
            >
              <span>编辑</span>
            </Button>
            <Popconfirm title="确定删除该提示词？" @confirm="remove(record.id)">
              <Button
                type="link"
                size="small"
                danger
                :loading="deletingId === record.id"
                :disabled="deletingId !== undefined"
              >
                <span>删除</span>
              </Button>
            </Popconfirm>
          </Space>
        </template>
      </Table>
    </Card>
    <Modal
      v-model:open="editorOpen"
      :title="editorTitle"
      :width="760"
      :confirm-loading="saving"
      :footer="readOnly ? null : undefined"
      :closable="!saving"
      :mask-closable="false"
      :keyboard="!saving"
      :cancel-button-props="{ disabled: saving }"
      ok-text="保存"
      cancel-text="取消"
      @ok="save"
    >
      <Form
        ref="formRef"
        :model="editor"
        :disabled="readOnly || saving"
        layout="vertical"
      >
        <FormItem
          label="名称"
          name="name"
          :rules="[
            { required: true, whitespace: true, message: '请输入提示词名称' },
          ]"
        >
          <Input v-model:value="editor.name" placeholder="请输入提示词名称" />
        </FormItem>
        <FormItem label="类别" name="categoryId">
          <Select
            v-model:value="editor.categoryId"
            :options="editorCategoryOptions"
            :loading="categoriesLoading"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="请选择类别"
          />
        </FormItem>
        <FormItem label="用户提示词" name="userPrompt">
          <Input.TextArea
            v-model:value="editor.userPrompt"
            :rows="5"
            placeholder="请输入用户提示词"
          />
        </FormItem>
        <FormItem label="系统提示词" name="systemPrompt">
          <Input.TextArea
            v-model:value="editor.systemPrompt"
            :rows="4"
            placeholder="请输入系统提示词"
          />
        </FormItem>
        <FormItem label="参考图地址" name="referenceImg">
          <Input
            v-model:value="editor.referenceImg"
            placeholder="请输入参考图地址"
          />
          <Image
            v-if="referenceUrl"
            class="mt-2"
            :src="referenceUrl"
            :width="120"
          />
        </FormItem>
        <FormItem label="描述" name="description">
          <Input.TextArea
            v-model:value="editor.description"
            :rows="3"
            placeholder="请输入描述"
          />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
