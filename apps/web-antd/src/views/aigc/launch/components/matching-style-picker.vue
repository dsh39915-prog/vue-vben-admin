<script setup lang="ts">
import type { ProductStyle, WorkflowId } from '#/api';

import { computed, onUnmounted, ref } from 'vue';

import { Alert, Button, message, Modal, Select } from 'ant-design-vue';

import { queryMatchStylesApi } from '#/api';

import ImageThumbnail from '../../common/image-thumbnail.vue';
import { imageUrl } from '../workflow-helpers';

const props = defineProps<{ mainStyleId: WorkflowId }>();
const emit = defineEmits<{ select: [ProductStyle]; close: [] }>();
const keyword = ref('');
const styles = ref<ProductStyle[]>([]);
const selectedStyleNo = ref<string>();
const selectedId = ref<string>();
const loading = ref(false);
const error = ref('');
const selected = computed(() =>
  styles.value.find((style) => String(style.id) === selectedId.value),
);
const availableStyles = computed(() =>
  styles.value.filter((style) => String(style.id) !== String(props.mainStyleId)),
);
const styleNoOptions = computed(() =>
  [...new Set(availableStyles.value.map((style) => style.styleNo))]
    .slice(0, 6)
    .map((styleNo) => ({ label: styleNo, value: styleNo })),
);
const colorOptions = computed(() =>
  availableStyles.value
    .filter((style) => style.styleNo === selectedStyleNo.value)
    .map((style) => ({
      label: style.styleName,
      value: String(style.id),
    })),
);
let latest = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
async function search() {
  clearTimeout(timer);
  const request = ++latest;
  loading.value = true;
  selectedId.value = undefined;
  styles.value = [];
  error.value = '';
  try {
    const data = await queryMatchStylesApi(keyword.value.trim());
    if (request === latest) styles.value = data;
  } catch (cause) {
    if (request === latest)
      error.value =
        cause instanceof Error ? cause.message : '款式查询失败，请重试';
  } finally {
    if (request === latest) loading.value = false;
  }
}
function searchStyleNo(value: string) {
  clearTimeout(timer);
  latest += 1;
  keyword.value = value;
  selectedStyleNo.value = undefined;
  selectedId.value = undefined;
  styles.value = [];
  loading.value = true;
  error.value = '';
  timer = setTimeout(() => void search(), 300);
}
function changeStyleNo() {
  selectedId.value = undefined;
}
function confirm() {
  if (loading.value) return void message.info('正在查询款式，请稍候');
  if (!selected.value)
    return void message.warning('请选择搭配服装的款号和款式（颜色）');
  if (!selected.value.clothingProductUrl)
    return void message.warning('所选搭配款式暂无服饰图，请选择其他款式');
  emit('select', selected.value);
}
onUnmounted(() => {
  latest += 1;
  clearTimeout(timer);
});
void search();
</script>

<template>
  <Modal
    open
    title="添加合拍款式"
    :width="560"
    ok-text="添加款式"
    cancel-text="取消"
    :mask-closable="false"
    @ok="confirm"
    @cancel="emit('close')"
  >
    <div class="flex flex-col gap-4 py-3">
      <label class="flex flex-col gap-2">
        <span>搭配服装款号</span>
        <Select
          v-model:value="selectedStyleNo"
          :options="styleNoOptions"
          :loading="loading"
          :filter-option="false"
          :not-found-content="loading ? '正在查询款号…' : error ? '查询失败，请重试' : '暂无匹配款号'"
          show-search
          allow-clear
          placeholder="选择款号或输入模糊查询，最多显示 6 个"
          @search="searchStyleNo"
          @change="changeStyleNo"
          @clear="searchStyleNo('')"
        />
      </label>
      <label class="flex flex-col gap-2">
        <span>款式（颜色）</span>
        <Select
          v-model:value="selectedId"
          :options="colorOptions"
          :loading="loading"
          :not-found-content="
            loading
              ? '正在查询款式…'
              : error
                ? '查询失败，请重试'
                : selectedStyleNo ? '暂无匹配款式' : '请先选择款号'
          "
          show-search
          allow-clear
          option-filter-prop="label"
          placeholder="请选择款式（颜色）"
        />
      </label>
      <Alert v-if="error" type="error" :message="error" show-icon>
        <template #action><Button @click="search">重试查询</Button></template>
      </Alert>
      <div v-if="selected" class="flex items-center gap-3">
        <ImageThumbnail
          v-if="selected.clothingProductUrl"
          :src="imageUrl(selected.clothingProductUrl)"
          :preview="{ src: selected.clothingProductUrl.previewUrl }"
        />
        <span>{{ selected.styleNo }} · {{ selected.styleName }}</span>
        <span v-if="!selected.clothingProductUrl" class="text-destructive">暂无服饰图</span>
      </div>
      <p class="mb-0 text-sm text-muted-foreground">
        当前款式作为主服装，所选款式作为搭配服装，其余素材复制主款内容。
      </p>
    </div>
  </Modal>
</template>
