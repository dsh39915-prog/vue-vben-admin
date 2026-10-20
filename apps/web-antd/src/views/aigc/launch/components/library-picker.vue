<script setup lang="ts">
import type { LibraryImageRecord, LibraryType, WorkflowImage } from '#/api';

import { computed, onUnmounted, ref } from 'vue';

import {
  Alert,
  Button,
  Empty,
  Form,
  FormItem,
  Image,
  Input,
  message,
  Modal,
  Pagination,
  Radio,
  Select,
  Spin,
} from 'ant-design-vue';

import { getLibraryImageApi, getLibraryImagePageApi } from '#/api';

import ImageUpload from '../../assets/components/image-upload.vue';
import { libraryTypeName } from '../../assets/helpers';
import { useLibraryCategories } from '../../assets/use-library-categories';

const props = defineProps<{ libraryType: LibraryType }>();
const emit = defineEmits<{ select: [WorkflowImage]; close: [] }>();
const {
  options: categories,
  loading: categoriesLoading,
  load: loadCategories,
} = useLibraryCategories(() => props.libraryType);
const query = ref<{ categoryId?: number; imageName?: string }>({});
let submitted: typeof query.value = {};
const rows = ref<LibraryImageRecord[]>([]);
const selected = ref<LibraryImageRecord>();
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const failed = ref(false);
const uploadOpen = ref(false);
const title = computed(() => '选择' + libraryTypeName(props.libraryType));
let latest = 0;
async function load(current = 1) {
  const request = ++latest;
  loading.value = true;
  failed.value = false;
  rows.value = [];
  page.value = current;
  try {
    const data = await getLibraryImagePageApi({
      ...submitted,
      libraryType: props.libraryType,
      pageNo: current,
      pageSize: 12,
    });
    if (request !== latest) return;
    if (!data || !Array.isArray(data.list))
      throw new Error('图库返回格式不正确');
    rows.value = data.list;
    total.value = data.total;
  } catch {
    if (request === latest) failed.value = true;
  } finally {
    if (request === latest) loading.value = false;
  }
}
function search() {
  submitted = {
    ...query.value,
    imageName: query.value.imageName?.trim() || undefined,
  };
  void load();
}
function choose(image: LibraryImageRecord) {
  if (image.libraryType !== props.libraryType || !image.originalUrl) {
    message.warning('图片信息不完整，请重新选择');
    return;
  }
  emit('select', {
    originalUrl: image.originalUrl,
    previewUrl: image.previewUrl || image.originalUrl,
    thumbnailUrl: image.thumbnailUrl || image.previewUrl || image.originalUrl,
  });
}
async function uploaded(id: number) {
  const request = ++latest;
  loading.value = true;
  try {
    const image = await getLibraryImageApi(id);
    if (request !== latest) return;
    if (!image) throw new Error('图片上传完成，请刷新图库后选择');
    choose(image);
  } catch (error) {
    if (request !== latest) return;
    if (error instanceof Error) message.warning(error.message);
    await load();
  } finally {
    if (request === latest) loading.value = false;
  }
}
void load();
onUnmounted(() => {
  latest += 1;
});
</script>
<template>
  <Modal
    open
    :title="title"
    :width="920"
    :mask-closable="false"
    :closable="!uploadOpen && !loading"
    :keyboard="!uploadOpen && !loading"
    :ok-button-props="{ disabled: !selected || loading || uploadOpen }"
    :cancel-button-props="{ disabled: uploadOpen || loading }"
    ok-text="选用图片"
    cancel-text="取消"
    @ok="selected && choose(selected)"
    @cancel="emit('close')"
  >
    <Form :model="query" layout="inline" class="mb-4" @finish="search">
      <FormItem label="分类">
        <Select
          v-model:value="query.categoryId"
          :options="categories"
          :loading="categoriesLoading"
          allow-clear
          placeholder="全部分类"
          class="w-44!"
          @dropdown-visible-change="(open) => open && loadCategories()"
        />
      </FormItem>
      <FormItem label="图片名称">
        <Input
          v-model:value="query.imageName"
          allow-clear
          placeholder="搜索图片"
        />
      </FormItem>
      <FormItem>
        <Button html-type="submit" type="primary" :loading="loading">
          查询
        </Button>
      </FormItem>
      <FormItem>
        <Button :disabled="loading" @click="uploadOpen = true">
          上传到图库
        </Button>
      </FormItem>
    </Form>
    <Alert
      v-if="failed"
      message="图库加载失败，请重试"
      type="error"
      class="mb-4!"
    >
      <template #action>
        <Button @click="load(page)">重试</Button>
      </template>
    </Alert>
    <Spin :spinning="loading">
      <Empty
        v-if="!loading && !failed && !rows.length"
        description="暂无图片"
      />
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <div
          v-for="image in rows"
          :key="image.id"
          class="flex flex-col gap-2 rounded border border-solid border-[hsl(var(--border))] p-2"
        >
          <Image
            :src="image.thumbnailUrl || image.previewUrl || image.originalUrl"
            :preview="{ src: image.previewUrl || image.originalUrl }"
            :height="120"
            class="object-contain"
          />
          <Radio
            :checked="selected?.id === image.id"
            :disabled="loading"
            @change="selected = image"
          >
            <span class="break-all">{{ image.imageName }}</span>
          </Radio>
        </div>
      </div>
      <Pagination
        class="mt-4"
        :current="page"
        :total="total"
        :page-size="12"
        :show-size-changer="false"
        :disabled="loading"
        @change="load"
      />
    </Spin>
    <ImageUpload
      v-if="uploadOpen"
      :library-type="libraryType"
      lock-library-type
      @uploaded="uploaded"
      @close="uploadOpen = false"
    />
  </Modal>
</template>
