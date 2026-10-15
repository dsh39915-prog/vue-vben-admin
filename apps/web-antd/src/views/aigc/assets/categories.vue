<script lang="ts" setup>
import type { FormInstance } from 'ant-design-vue';

import type { LibraryCategoryFilters, LibraryCategorySaveParams } from '#/api';

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
  Select,
  Space,
  Table,
} from 'ant-design-vue';

import {
  createLibraryCategoryApi,
  deleteLibraryCategoryApi,
  getLibraryCategoryApi,
  getLibraryCategoryPageApi,
  updateLibraryCategoryApi,
} from '#/api';

import { useAigcPage } from '../common/use-page';
import {
  libraryStatusOptions,
  libraryTypeName,
  libraryTypeOptions,
} from './helpers';

const query = reactive<LibraryCategoryFilters>({ categoryName: '' });
const {
  rows,
  loading,
  pagination,
  load: loadRows,
  search: searchPage,
  change,
} = useAigcPage(
  async (params) => {
    const data = await getLibraryCategoryPageApi({
      categoryName: params.categoryName,
      libraryType: params.libraryType,
      status: params.status,
      pageNo: params.page,
      pageSize: params.pageSize,
    });
    return {
      records: data.list,
      total: data.total,
      current: params.page,
      size: params.pageSize,
    };
  },
  { ...query },
);
const saving = ref(false);
const detailLoading = ref(false);
const deletingId = ref<number>();
const editorOpen = ref(false);
const readOnly = ref(false);
const formRef = ref<FormInstance>();
const editor = reactive<LibraryCategorySaveParams>({
  categoryName: '',
  libraryType: 0,
});
const editorTitle = computed(() =>
  readOnly.value
    ? '分类详情'
    : editor.id === undefined
      ? '新增分类'
      : '编辑分类',
);
const columns = [
  { title: 'ID', dataIndex: 'id', width: 90 },
  { title: '库类型', key: 'libraryType', width: 160 },
  { title: '分类名称', dataIndex: 'categoryName' },
  { title: '操作', key: 'action', width: 210, fixed: 'right' as const },
];

function search() {
  return searchPage({
    ...query,
    categoryName: query.categoryName?.trim() || undefined,
  });
}
function reset() {
  query.libraryType = undefined;
  query.categoryName = '';
  query.status = undefined;
  void search();
}

async function openEditor(id?: number, view = false) {
  if (detailLoading.value) return;
  detailLoading.value = true;
  try {
    const data = id === undefined ? undefined : await getLibraryCategoryApi(id);
    if (data === null) {
      message.warning('该分类不存在，请刷新列表');
      return;
    }
    editor.id = data?.id;
    editor.categoryName = data?.categoryName ?? '';
    editor.libraryType = data?.libraryType ?? query.libraryType ?? 0;
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
    const data: LibraryCategorySaveParams = {
      categoryName: editor.categoryName.trim(),
      libraryType: editor.libraryType,
    };
    if (editor.id === undefined) {
      await createLibraryCategoryApi(data);
    } else {
      await updateLibraryCategoryApi({ ...data, id: editor.id });
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
    await deleteLibraryCategoryApi(id);
    message.success('删除成功');
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
  <Page title="图库分类管理" description="维护道具库、模特库、场景库的图片分类">
    <Card class="mb-4!" :bordered="false">
      <Form :model="query" layout="inline" @finish="search">
        <FormItem label="库类型">
          <Select
            v-model:value="query.libraryType"
            :options="libraryTypeOptions"
            allow-clear
            placeholder="全部图库"
            style="width: 160px"
          />
        </FormItem>
        <FormItem label="状态">
          <Select
            v-model:value="query.status"
            :options="libraryStatusOptions"
            allow-clear
            placeholder="全部状态"
            style="width: 140px"
          />
        </FormItem>
        <FormItem label="分类名称">
          <Input
            v-model:value="query.categoryName"
            allow-clear
            placeholder="请输入分类名称"
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
    <Card title="分类列表" :bordered="false">
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
            <span>新增分类</span>
          </Button>
        </Space>
      </template>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 800 }"
        row-key="id"
        @change="change"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'libraryType'">
            {{ libraryTypeName(record.libraryType) }}
          </template>
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
            <Popconfirm title="确定删除该分类？" @confirm="remove(record.id)">
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
          label="库类型"
          name="libraryType"
          :rules="[{ required: true, message: '请选择库类型' }]"
        >
          <Select
            v-model:value="editor.libraryType"
            :options="libraryTypeOptions"
          />
        </FormItem>
        <FormItem
          label="分类名称"
          name="categoryName"
          :rules="[
            { required: true, whitespace: true, message: '请输入分类名称' },
          ]"
        >
          <Input
            v-model:value="editor.categoryName"
            placeholder="请输入分类名称"
          />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
