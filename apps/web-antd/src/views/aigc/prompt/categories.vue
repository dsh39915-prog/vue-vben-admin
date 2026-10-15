<script lang="ts" setup>
import type { FormInstance } from 'ant-design-vue';

import type { PromptCategoryRecord, PromptCategorySaveParams } from '#/api';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
} from 'ant-design-vue';

import {
  createPromptCategoryApi,
  deletePromptCategoryApi,
  getPromptCategoryApi,
  getPromptCategoryListApi,
  updatePromptCategoryApi,
} from '#/api';

const loading = ref(false);
const saving = ref(false);
const detailLoading = ref(false);
const deletingId = ref<number>();
const rows = ref<PromptCategoryRecord[]>([]);
const keyword = ref('');
const appliedKeyword = ref('');
const current = ref(1);
const editorOpen = ref(false);
const readOnly = ref(false);
const formRef = ref<FormInstance>();
const editor = reactive<PromptCategorySaveParams>({
  name: '',
  description: '',
});
const filteredRows = computed(() =>
  rows.value.filter((row) =>
    row.name
      .toLocaleLowerCase()
      .includes(appliedKeyword.value.toLocaleLowerCase()),
  ),
);
const editorTitle = computed(() =>
  readOnly.value
    ? '类别详情'
    : editor.id === undefined
      ? '新增类别'
      : '编辑类别',
);
const columns = [
  { title: 'ID', dataIndex: 'id', width: 90 },
  { title: '类别名称', dataIndex: 'name', width: 240 },
  { title: '描述', dataIndex: 'description' },
  { title: '操作', key: 'action', width: 210, fixed: 'right' as const },
];

async function loadRows() {
  loading.value = true;
  try {
    rows.value = await getPromptCategoryListApi();
  } catch {
    // The shared request interceptor displays API errors.
  } finally {
    loading.value = false;
  }
}

function search() {
  appliedKeyword.value = keyword.value.trim();
  current.value = 1;
}

function reset() {
  keyword.value = '';
  search();
}

async function openEditor(id?: number, view = false) {
  if (detailLoading.value) return;
  detailLoading.value = true;
  try {
    const data = id === undefined ? undefined : await getPromptCategoryApi(id);
    if (data === null) {
      message.warning('该类别不存在，请刷新列表');
      return;
    }
    editor.id = data?.id;
    editor.name = data?.name ?? '';
    editor.description = data?.description ?? '';
    readOnly.value = view;
    formRef.value?.clearValidate();
    editorOpen.value = true;
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
    const data: PromptCategorySaveParams = {
      name: editor.name.trim(),
      description: editor.description,
    };
    if (editor.id === undefined) {
      await createPromptCategoryApi(data);
    } else {
      await updatePromptCategoryApi({ ...data, id: editor.id });
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
    await deletePromptCategoryApi(id);
    message.success('删除成功');
    current.value = 1;
    await loadRows();
  } catch {
    // The shared request interceptor displays API errors.
  } finally {
    deletingId.value = undefined;
  }
}

onMounted(loadRows);
</script>

<template>
  <Page title="AI 提示词类别" description="维护提示词类别名称和描述">
    <Card class="mb-4!" :bordered="false">
      <Form :model="{ keyword }" layout="inline" @finish="search">
        <FormItem label="类别名称">
          <Input
            v-model:value="keyword"
            allow-clear
            placeholder="请输入类别名称"
          />
        </FormItem>
        <FormItem>
          <Space>
            <Button type="primary" html-type="submit">
              <span>查询</span>
            </Button>
            <Button @click="reset">
              <span>重置</span>
            </Button>
          </Space>
        </FormItem>
      </Form>
    </Card>
    <Card title="类别列表" :bordered="false">
      <template #extra>
        <Space>
          <Button :loading="loading" @click="loadRows">
            <span>刷新</span>
          </Button>
          <Button
            type="primary"
            :disabled="detailLoading"
            @click="openEditor()"
          >
            <span>新增类别</span>
          </Button>
        </Space>
      </template>
      <Table
        :columns="columns"
        :data-source="filteredRows"
        :loading="loading"
        :pagination="{
          current,
          pageSize: 10,
          showTotal: (total: number) => `共 ${total} 条`,
        }"
        :scroll="{ x: 800 }"
        row-key="id"
        @change="(pagination) => (current = pagination.current ?? 1)"
      >
        <template #bodyCell="{ column, record }">
          <Space v-if="column.key === 'action'">
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
            <Popconfirm title="确定删除该类别？" @confirm="remove(record.id)">
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
          label="类别名称"
          name="name"
          :rules="[
            { required: true, whitespace: true, message: '请输入类别名称' },
          ]"
        >
          <Input v-model:value="editor.name" placeholder="请输入类别名称" />
        </FormItem>
        <FormItem label="描述" name="description">
          <Input.TextArea
            v-model:value="editor.description"
            :rows="4"
            placeholder="请输入类别描述"
          />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
