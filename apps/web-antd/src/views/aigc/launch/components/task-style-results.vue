<script setup lang="ts">
import type { ProductStyle } from '#/api';

import { computed, onUnmounted, ref, watch } from 'vue';

import { Alert, Button, Card, Empty, Select, Spin } from 'ant-design-vue';

import { getProductStylesApi } from '#/api';

import StyleResults from '../../generation/components/business-results.vue';

const props = defineProps<{ taskId: number; readOnly: boolean }>();
const emit = defineEmits<{ busy: [boolean] }>();
const styles = ref<ProductStyle[]>([]);
const styleId = ref<string>();
const loading = ref(false);
const failed = ref(false);
const busy = ref(false);
const options = computed(() =>
  styles.value.map((style) => ({
    label: `${style.styleNo} · ${style.styleName}`,
    value: String(style.id),
  })),
);
let latest = 0;
async function load() {
  if (busy.value) return;
  const request = ++latest;
  loading.value = true;
  failed.value = false;
  styleId.value = undefined;
  styles.value = [];
  try {
    const data = await getProductStylesApi(props.taskId);
    if (request !== latest) return;
    styles.value = data;
    styleId.value = data[0] ? String(data[0].id) : undefined;
  } catch {
    if (request === latest) failed.value = true;
  } finally {
    if (request === latest) loading.value = false;
  }
}
watch(
  () => props.taskId,
  () => {
    void load();
  },
  { immediate: true },
);
watch(busy, (value) => emit('busy', value), { flush: 'sync' });
onUnmounted(() => {
  latest += 1;
  emit('busy', false);
});
</script>

<template>
  <Spin :spinning="loading">
    <Alert
      v-if="failed"
      type="error"
      message="款式列表加载失败，请重试"
      class="mb-4!"
    >
      <template #action>
        <div>
          <Button @click="load">
            <span>重新加载款式</span>
          </Button>
        </div>
      </template>
    </Alert>
    <Card v-if="!failed && styles.length" :bordered="false" class="mb-4!">
      <div class="flex flex-wrap items-center gap-3">
        <span>商品款式</span>
        <Select
          v-model:value="styleId"
          :options="options"
          :disabled="busy"
          aria-label="结果所属款式"
          show-search
          option-filter-prop="label"
          class="w-72! max-w-full"
        />
      </div>
    </Card>
    <Empty
      v-if="!loading && !failed && !styles.length"
      description="暂无商品款式"
    />
    <StyleResults
      v-if="styleId && !failed"
      :key="styleId"
      :style-id="styleId"
      :style-no="styles.find((style) => String(style.id) === styleId)?.styleNo"
      embedded
      :read-only="readOnly"
      @busy="busy = $event"
    />
  </Spin>
</template>
