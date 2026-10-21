<script setup lang="ts">
import type { ProductStyle, WorkflowImage } from '#/api';

import { computed, ref } from 'vue';

import { ExternalLink, X } from '@vben/icons';

import {
  Alert,
  Button,
  Empty,
  Image,
  Input,
  Modal,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { withMainClothing } from '../matching-scheme-sources';
import { imageUrl } from '../workflow-helpers';

const props = defineProps<{
  modelValue: WorkflowImage[];
  mainImage?: WorkflowImage;
  styles: ProductStyle[];
  disabled?: boolean;
  compact?: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [WorkflowImage[]];
  busy: [number];
}>();
const pickerOpen = ref(false);
const keyword = ref('');
const companions = computed(() =>
  props.modelValue.filter(
    (image) => image.originalUrl !== props.mainImage?.originalUrl,
  ),
);
const candidates = computed(() => {
  const text = keyword.value.trim().toLowerCase();
  return text
    ? props.styles.filter((style) => style.styleNo.toLowerCase().includes(text))
    : [];
});
function selected(style: ProductStyle) {
  return props.modelValue.some(
    (image) =>
      image.originalUrl === style.clothingProductUrl?.originalUrl &&
      (image.styleNo === style.styleNo ||
        image.originalUrl === props.mainImage?.originalUrl),
  );
}
function open() {
  if (props.disabled || pickerOpen.value) return;
  keyword.value = '';
  pickerOpen.value = true;
  emit('busy', 1);
}
function close() {
  if (!pickerOpen.value) return;
  pickerOpen.value = false;
  emit('busy', -1);
}
function add(style: ProductStyle) {
  if (props.disabled || !style.clothingProductUrl || selected(style)) return;
  emit(
    'update:modelValue',
    withMainClothing(props.mainImage, [
      ...companions.value,
      { ...style.clothingProductUrl, styleNo: style.styleNo, isMain: 0 },
    ]),
  );
}
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
  <div
    :class="
      compact ? 'flex flex-wrap items-start gap-3' : 'flex flex-col gap-3'
    "
  >
    <Alert
      v-if="!mainImage"
      type="warning"
      message="表格数据缺少主服饰图，请补齐来源数据后重新加载"
      show-icon
    />
    <template v-if="compact">
      <div v-if="mainImage" class="w-[120px] max-w-full" data-clothing="main">
        <div class="relative">
          <Image
            :src="imageUrl(mainImage)"
            :preview="{ src: mainImage.previewUrl || mainImage.originalUrl }"
            width="100%"
            :height="120"
            class="object-contain"
          />
          <Tooltip title="查看原图">
            <Button
              class="absolute! bottom-1 right-1 z-10"
              size="small"
              shape="circle"
              :href="imageUrl(mainImage, true)"
              :disabled="false"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="查看原图"
            >
              <template #icon><ExternalLink class="size-3.5" /></template>
            </Button>
          </Tooltip>
        </div>
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
        <div class="relative">
          <Image
            :src="imageUrl(image)"
            :preview="{ src: image.previewUrl || image.originalUrl }"
            width="100%"
            :height="120"
            class="object-contain"
          />
          <Tooltip v-if="!disabled" title="移除搭配服饰">
            <Button
              class="absolute! -right-2 -top-2 z-10"
              size="small"
              shape="circle"
              danger
              :aria-label="`移除搭配服饰 ${index + 1}`"
              @click="remove(index)"
            >
              <template #icon><X class="size-3.5" /></template>
            </Button>
          </Tooltip>
          <Tooltip title="查看原图">
            <Button
              class="absolute! bottom-1 right-1 z-10"
              size="small"
              shape="circle"
              :href="imageUrl(image, true)"
              :disabled="false"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="查看原图"
            >
              <template #icon><ExternalLink class="size-3.5" /></template>
            </Button>
          </Tooltip>
        </div>
        <p class="mb-0 mt-1 break-all text-xs">
          搭配服饰 · {{ image.styleNo }}
        </p>
      </div>
    </template>
    <div v-else class="flex flex-wrap gap-3">
      <div
        v-if="mainImage"
        class="flex w-44 flex-col gap-2 rounded border border-solid border-[hsl(var(--border))] p-2"
        data-clothing="main"
      >
        <Tag color="blue"><span>主服饰（固定）</span></Tag>
        <Image
          :src="imageUrl(mainImage)"
          :preview="{ src: mainImage.previewUrl || mainImage.originalUrl }"
          :height="100"
          :width="150"
          class="object-contain"
        />
        <span class="break-all text-sm">{{ mainImage.styleNo }}</span>
        <a
          :href="imageUrl(mainImage, true)"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>查看原图</span>
        </a>
      </div>
      <div
        v-for="(image, index) in companions"
        :key="`${image.styleNo}:${image.originalUrl}:${index}`"
        class="flex w-44 flex-col gap-2 rounded border border-solid border-[hsl(var(--border))] p-2"
        data-clothing="companion"
      >
        <Tag><span>搭配服饰</span></Tag>
        <Image
          :src="imageUrl(image)"
          :preview="{ src: image.previewUrl || image.originalUrl }"
          :height="100"
          :width="150"
          class="object-contain"
        />
        <span class="break-all text-sm">{{ image.styleNo }}</span>
        <a
          :href="imageUrl(image, true)"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>查看原图</span>
        </a>
        <Button
          v-if="!disabled"
          size="small"
          danger
          :aria-label="`移除搭配服饰 ${index + 1}`"
          @click="remove(index)"
        >
          <span>移除搭配服饰</span>
        </Button>
      </div>
    </div>
    <Button
      v-if="!disabled"
      :class="compact ? 'self-center' : 'self-start'"
      @click="open"
    >
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
          placeholder="输入款号筛选现有款式"
        />
      </label>
      <Empty
        v-if="!candidates.length"
        :description="
          keyword.trim() ? '没有匹配的现有款式' : '请输入款号查找服饰图片'
        "
      />
      <div
        v-for="style in candidates"
        :key="String(style.id)"
        class="mb-3 flex items-center gap-4 rounded border border-solid border-[hsl(var(--border))] p-3"
      >
        <Image
          v-if="style.clothingProductUrl"
          :src="imageUrl(style.clothingProductUrl)"
          :width="80"
          :height="80"
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
          :disabled="disabled || !style.clothingProductUrl || selected(style)"
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
      <div class="mt-4 flex justify-end">
        <Button @click="close"><span>完成选择</span></Button>
      </div>
    </Modal>
  </div>
</template>
