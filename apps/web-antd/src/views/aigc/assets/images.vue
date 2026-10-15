<script setup lang="ts">
import type { LibraryImageFilters, LibraryImageRecord } from '#/api';

import { onMounted, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
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
  deleteLibraryImageApi,
  getLibraryImageApi,
  getLibraryImagePageApi,
} from '#/api';

import { useAigcPage } from '../common/use-page';
import ImageUpload from './components/image-upload.vue';
import {
  libraryStatusOptions,
  libraryTypeName,
  libraryTypeOptions,
} from './helpers';
import { useLibraryCategories } from './use-library-categories';

const query = reactive<LibraryImageFilters>({ imageName: '' });
const {
  categories,
  options: categoryOptions,
  loading: categoriesLoading,
  load: loadCategories,
} = useLibraryCategories(() => query.libraryType);
watch(
  () => query.libraryType,
  () => {
    query.categoryId = undefined;
  },
);
const {
  rows,
  loading,
  pagination,
  pager,
  load,
  search: searchPage,
  change,
} = useAigcPage(
  async (params) => {
    const data = await getLibraryImagePageApi({
      categoryId: params.categoryId,
      imageName: params.imageName,
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
const uploadOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<LibraryImageRecord>();
const detailOpen = ref(false);
const deletingId = ref<number>();
const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '图片', key: 'image', width: 130 },
  { title: '图片名称', dataIndex: 'imageName', width: 240 },
  { title: '库类型', key: 'libraryType', width: 120 },
  { title: '分类', key: 'category', width: 180 },
  { title: '状态', key: 'status', width: 100 },
  { title: '上传时间', dataIndex: 'createTime', width: 180 },
  { title: '操作', key: 'action', width: 230, fixed: 'right' as const },
];
function categoryName(id: number, name?: null | string) {
  return (
    name ||
    categories.value.find((item) => item.id === id)?.categoryName ||
    `分类 #${id}`
  );
}
function search() {
  return searchPage({
    ...query,
    imageName: query.imageName?.trim() || undefined,
  });
}
function reset() {
  query.libraryType = undefined;
  query.categoryId = undefined;
  query.status = undefined;
  query.imageName = '';
  void search();
}
function refresh() {
  return Promise.all([load(), loadCategories()]);
}
function uploaded() {
  pager.current = 1;
  void load();
}
async function showDetail(id: number) {
  if (detailLoading.value) return;
  detailLoading.value = true;
  try {
    const data = await getLibraryImageApi(id);
    if (!data) {
      message.warning('该图片不存在，请刷新列表');
      return;
    }
    detail.value = data;
    detailOpen.value = true;
  } catch {
    // The shared request interceptor displays API errors.
  } finally {
    detailLoading.value = false;
  }
}
async function remove(id: number) {
  if (deletingId.value !== undefined) return;
  deletingId.value = id;
  try {
    await deleteLibraryImageApi(id);
    message.success('删除成功');
    await load();
  } catch {
    // The shared request interceptor displays API errors.
  } finally {
    deletingId.value = undefined;
  }
}
onMounted(load);
</script>
<template>
  <Page
    title="图库图片管理"
    description="管理道具库、模特库、场景库的图片，支持上传与预览"
  >
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
        <FormItem label="分类">
          <Select
            v-model:value="query.categoryId"
            :options="categoryOptions"
            :loading="categoriesLoading"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="全部分类"
            style="width: 200px"
            @dropdown-visible-change="(open) => open && loadCategories()"
          />
        </FormItem>
        <FormItem label="图片名称">
          <Input
            v-model:value="query.imageName"
            allow-clear
            placeholder="请输入图片名称"
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
        <FormItem>
          <Space>
            <Button type="primary" html-type="submit" :loading="loading">
              <span>查询</span>
            </Button>
            <Button @click="reset"><span>重置</span></Button>
          </Space>
        </FormItem>
      </Form>
    </Card>
    <Card title="图片列表" :bordered="false">
      <template #extra>
        <Space>
          <Button :loading="loading" @click="refresh"><span>刷新</span></Button>
          <Button type="primary" @click="uploadOpen = true">
            <span>上传图片</span>
          </Button>
        </Space>
      </template>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1260 }"
        row-key="id"
        @change="change"
      >
        <template #bodyCell="{ column, record }">
          <Image
            v-if="column.key === 'image'"
            :src="
              record.thumbnailUrl || record.previewUrl || record.originalUrl
            "
            :preview="{
              src:
                record.previewUrl ||
                record.originalUrl ||
                record.thumbnailUrl ||
                undefined,
            }"
            :width="72"
          />
          <template v-else-if="column.key === 'libraryType'">
            {{ libraryTypeName(record.libraryType) }}
          </template>
          <template v-else-if="column.key === 'category'">
            {{ categoryName(record.categoryId, record.categoryName) }}
          </template>
          <Tag
            v-else-if="column.key === 'status'"
            :color="record.status === 1 ? 'success' : 'default'"
          >
            {{
              record.status === 1 ? '启用' : record.status === 0 ? '禁用' : '-'
            }}
          </Tag>
          <Space v-else-if="column.key === 'action'">
            <Button
              type="link"
              size="small"
              :disabled="detailLoading"
              @click="showDetail(record.id)"
            >
              <span>详情</span>
            </Button>
            <a
              :href="record.originalUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>查看原图</span>
            </a>
            <Popconfirm title="确定删除该图片？" @confirm="remove(record.id)">
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
    <ImageUpload
      v-if="uploadOpen"
      :library-type="query.libraryType"
      @saved="uploaded"
      @close="uploadOpen = false"
    />
    <Modal
      v-model:open="detailOpen"
      title="图库图片详情"
      :width="760"
      :footer="null"
    >
      <template v-if="detail">
        <Descriptions :column="2" class="mb-4!" bordered size="small">
          <DescriptionsItem label="ID">{{ detail.id }}</DescriptionsItem>
          <DescriptionsItem label="图片名称">
            {{ detail.imageName }}
          </DescriptionsItem>
          <DescriptionsItem label="库类型">
            {{ libraryTypeName(detail.libraryType) }}
          </DescriptionsItem>
          <DescriptionsItem label="分类">
            {{ categoryName(detail.categoryId, detail.categoryName) }}
          </DescriptionsItem>
          <DescriptionsItem label="状态">
            {{
              detail.status === 1 ? '启用' : detail.status === 0 ? '禁用' : '-'
            }}
          </DescriptionsItem>
          <DescriptionsItem label="上传时间">
            {{ detail.createTime || '-' }}
          </DescriptionsItem>
        </Descriptions>
        <Image
          :src="detail.previewUrl || detail.thumbnailUrl || detail.originalUrl"
          :preview="{
            src:
              detail.previewUrl ||
              detail.originalUrl ||
              detail.thumbnailUrl ||
              undefined,
          }"
          width="100%"
        />
        <a
          :href="detail.originalUrl"
          class="mt-4 inline-block"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>查看原图</span>
        </a>
      </template>
    </Modal>
  </Page>
</template>
