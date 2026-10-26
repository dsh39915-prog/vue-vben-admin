<script setup lang="ts">
import type { ProductStyle, WorkflowImage } from '#/api';

import { computed, onUnmounted, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Empty,
  Input,
  message,
  Modal,
  Spin,
} from 'ant-design-vue';

import { queryMatchStylesApi } from '#/api';

import ImageThumbnail from '../../common/image-thumbnail.vue';
import ImageUploadItem from '../../common/image-upload-item.vue';
import { withMainClothing } from '../matching-scheme-sources';
import { imageUrl } from '../workflow-helpers';

const props = defineProps<{
  modelValue: WorkflowImage[];
  mainImage?: WorkflowImage;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [WorkflowImage[]];
  busy: [number];
  applyAiScheme: [ProductStyle];
}>();
const pickerOpen = ref(false);
const keyword = ref('');
const candidates = ref<ProductStyle[]>([]);
const knownStyles = ref(new Map<string, ProductStyle>());
const applyingKey = ref('');
let active = true;
function clothingKey(styleNo: string, originalUrl: string) {
  return JSON.stringify([styleNo.trim(), originalUrl]);
}
function rememberStyles(styles: ProductStyle[]) {
  for (const style of styles) {
    if (style.clothingProductUrl)
      knownStyles.value.set(
        clothingKey(style.styleNo, style.clothingProductUrl.originalUrl),
        style,
      );
  }
}
function styleHasAiImages(style?: ProductStyle) {
  return Boolean(
    style?.aiModelImageUrls?.length || style?.aiActionImageUrls?.length,
  );
}
function hasAiImages(image: WorkflowImage) {
  return styleHasAiImages(
    knownStyles.value.get(clothingKey(image.styleNo || '', image.originalUrl)),
  );
}
async function applyAiScheme(image: WorkflowImage) {
  if (props.disabled || applyingKey.value) return;
  const key = clothingKey(image.styleNo || '', image.originalUrl);
  const known = knownStyles.value.get(key);
  applyingKey.value = key;
  emit('busy', 1);
  try {
    const data = await queryMatchStylesApi(image.styleNo || '');
    if (
      !active ||
      props.disabled ||
      !companions.value.some(
        (item) => clothingKey(item.styleNo || '', item.originalUrl) === key,
      )
    )
      return;
    const matches = data.filter(
      (style) =>
        clothingKey(
          style.styleNo,
          style.clothingProductUrl?.originalUrl || '',
        ) === key &&
        (!known || String(style.id) === String(known.id)),
    );
    if (matches.length !== 1) {
      message.warning('未找到唯一匹配的辅服饰款式，请重新选择');
      return;
    }
    const style = matches[0]!;
    rememberStyles(data);
    if (!styleHasAiImages(style)) {
      message.info('该款式暂无可复用AI图片');
      return;
    }
    emit('applyAiScheme', style);
  } catch (error) {
    if (active)
      message.error(
        error instanceof Error ? error.message : 'AI图片读取失败，请重试',
      );
  } finally {
    if (active) {
      applyingKey.value = '';
      emit('busy', -1);
    }
  }
}
const searching = ref(false);
const searchError = ref('');
let latestSearch = 0;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
const companions = computed(() =>
  props.modelValue.filter(
    (image) => image.originalUrl !== props.mainImage?.originalUrl,
  ),
);
function clearSearch() {
  clearTimeout(searchTimer);
  latestSearch += 1;
  candidates.value = [];
  searching.value = false;
  searchError.value = '';
}
async function search() {
  clearSearch();
  const text = keyword.value.trim();
  if (!pickerOpen.value) return;
  const request = latestSearch;
  searching.value = true;
  try {
    const data = await queryMatchStylesApi(text);
    if (request === latestSearch && pickerOpen.value) {
      rememberStyles(data);
      candidates.value = data;
    }
  } catch (error) {
    if (request === latestSearch && pickerOpen.value)
      searchError.value =
        error instanceof Error ? error.message : '服饰款式查询失败，请重试';
  } finally {
    if (request === latestSearch) searching.value = false;
  }
}
watch(
  keyword,
  () => {
    clearSearch();
    if (!pickerOpen.value) return;
    searching.value = true;
    searchTimer = setTimeout(() => void search(), 300);
  },
  { flush: 'sync' },
);
function selected(style: ProductStyle) {
  return props.modelValue.some(
    (image) => image.originalUrl === style.clothingProductUrl?.originalUrl,
  );
}
watch(
  () =>
    companions.value.map((image) =>
      clothingKey(image.styleNo || '', image.originalUrl),
    ),
  async () => {
    const styleNos = [
      ...new Set(
        companions.value
          .filter(
            (image) =>
              image.styleNo?.trim() &&
              !knownStyles.value.has(
                clothingKey(image.styleNo, image.originalUrl),
              ),
          )
          .map((image) => image.styleNo!.trim()),
      ),
    ];
    await Promise.all(
      styleNos.map(async (styleNo) => {
        try {
          const data = await queryMatchStylesApi(styleNo);
          if (active) rememberStyles(data);
        } catch {
          // Preserve all selected clothing; the shared interceptor reports errors.
        }
      }),
    );
  },
  { immediate: true },
);
function open() {
  if (props.disabled || pickerOpen.value) return;
  keyword.value = '';
  clearSearch();
  pickerOpen.value = true;
  emit('busy', 1);
  void search();
}
function close() {
  if (!pickerOpen.value) return;
  pickerOpen.value = false;
  clearSearch();
  emit('busy', -1);
}
function add(style: ProductStyle) {
  if (
    props.disabled ||
    searching.value ||
    searchError.value ||
    !pickerOpen.value ||
    !candidates.value.includes(style) ||
    !style.clothingProductUrl ||
    selected(style)
  )
    return;
  emit(
    'update:modelValue',
    withMainClothing(props.mainImage, [
      ...companions.value,
      { ...style.clothingProductUrl, styleNo: style.styleNo, isMain: 0 },
    ]),
  );
}
onUnmounted(() => {
  active = false;
  clearSearch();
  if (pickerOpen.value) emit('busy', -1);
  if (applyingKey.value) emit('busy', -1);
});
function remove(index: number) {
  if (props.disabled) return;
  emit(
    'update:modelValue',
    withMainClothing(
      props.mainImage,
      companions.value.filter((_, i) => i !== index),
    ),
  );
}
</script>

<template>
  <div class="flex flex-wrap items-start gap-3">
    <Alert
      v-if="!mainImage"
      type="warning"
      message="表格数据缺少主服饰图，请补齐来源数据后重新加载"
      show-icon
    />
    <div v-if="mainImage" class="w-[120px] max-w-full" data-clothing="main">
      <ImageUploadItem
        :src="imageUrl(mainImage)"
        :preview-src="mainImage.previewUrl || mainImage.originalUrl"
        :original-url="imageUrl(mainImage, true)"
      />
      <p class="mb-0 mt-1 break-all text-xs">
        主服饰（固定） · {{ mainImage.styleNo }}
      </p>
    </div>
    <div
      v-for="(image, index) in companions"
      :key="`${image.styleNo}:${image.originalUrl}:${index}`"
      class="w-[120px] max-w-full"
      data-clothing="companion"
    >
      <ImageUploadItem
        :src="imageUrl(image)"
        :preview-src="image.previewUrl || image.originalUrl"
        :original-url="imageUrl(image, true)"
        :disabled="disabled"
        removable
        :remove-label="`移除搭配服饰 ${index + 1}`"
        @remove="remove(index)"
      />
      <p class="mb-0 mt-1 break-all text-xs">搭配服饰 · {{ image.styleNo }}</p>
      <p
        v-if="hasAiImages(image)"
        class="mb-0 mt-1 text-xs text-muted-foreground"
      >
        已用AI方案生过图片
      </p>
      <Button
        v-if="hasAiImages(image) && !disabled"
        size="small"
        type="link"
        class="px-0!"
        :loading="
          applyingKey === clothingKey(image.styleNo || '', image.originalUrl)
        "
        :disabled="Boolean(applyingKey)"
        @click="applyAiScheme(image)"
      >
        <span>应用AI搭配方案</span>
      </Button>
    </div>
    <Button v-if="!disabled" class="self-center" @click="open">
      <span>添加辅服饰图</span>
    </Button>
    <Modal
      v-if="pickerOpen"
      open
      title="按款号添加辅服饰图"
      :width="720"
      :footer="null"
      @cancel="close"
    >
      <label class="mb-4 flex flex-col gap-2">
        <span>服饰款号</span>
        <Input
          v-model:value="keyword"
          allow-clear
          placeholder="输入款号模糊查询服饰图片"
          @press-enter="search"
        />
      </label>
      <Alert
        v-if="searchError"
        type="error"
        :message="searchError"
        class="mb-4!"
      >
        <template #action>
          <Button @click="search">
            <span>重试查询</span>
          </Button>
        </template>
      </Alert>
      <Spin :spinning="searching" tip="正在查询服饰图片…">
        <div class="min-h-[140px]">
          <Empty
            v-if="!searching && !searchError && !candidates.length"
            :description="
              keyword.trim() ? '没有匹配的服饰款式' : '暂无服饰款式'
            "
          />
          <div
            v-for="style in candidates"
            :key="String(style.id)"
            class="mb-3 flex items-center gap-4 rounded border border-solid border-[hsl(var(--border))] p-3"
          >
            <ImageThumbnail
              v-if="style.clothingProductUrl"
              :src="imageUrl(style.clothingProductUrl)"
              :preview="{
                src:
                  style.clothingProductUrl.previewUrl ||
                  style.clothingProductUrl.originalUrl,
              }"
            />
            <div class="min-w-0 flex-1 break-all">
              {{ style.styleNo }} · {{ style.styleName }}
            </div>
            <Button
              :disabled="
                disabled || !style.clothingProductUrl || selected(style)
              "
              @click="add(style)"
            >
              <span>{{
                !style.clothingProductUrl
                  ? '暂无服饰图'
                  : selected(style)
                    ? '已添加'
                    : '添加搭配服饰'
              }}</span>
            </Button>
          </div>
        </div>
      </Spin>
      <div class="mt-4 flex justify-end">
        <Button @click="close"><span>完成选择</span></Button>
      </div>
    </Modal>
  </div>
</template>
