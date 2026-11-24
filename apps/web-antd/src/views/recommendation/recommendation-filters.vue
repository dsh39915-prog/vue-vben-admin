<script setup lang="ts">
import type { RecommendationSelection } from './filter-selection';

import type { AppCategory } from '#/api';

import { computed } from 'vue';

import { Alert, Button, Radio } from 'ant-design-vue';

import { audienceOptions, platformOptions, sectionOptions } from './data';
import { changeRecommendationSelection } from './filter-selection';

const props = defineProps<{
  categories: AppCategory[];
  categoryFailed: boolean;
  categoryLoading: boolean;
  disabled: boolean;
}>();
defineEmits<{ retryCategories: [] }>();
const selection = defineModel<RecommendationSelection>({ required: true });
const platformButtonOptions = platformOptions.map((option) => ({
  ...option,
  label: `${option.label}OS`,
}));
const showSections = computed(() => selection.value.audience !== 'featured');
const showCategories = computed(
  () => showSections.value && selection.value.section === 'category',
);
const categoryOptions = computed(() =>
  props.categories.map((item) => ({ label: item.name, value: item.id })),
);
function change(value: Parameters<typeof changeRecommendationSelection>[1]) {
  selection.value = changeRecommendationSelection(selection.value, value);
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start gap-3" data-filter-level="platform">
      <span id="rec-platform" class="filter-label">运行平台</span>
      <Radio.Group
        :value="selection.platform"
        :options="platformButtonOptions"
        option-type="button"
        button-style="solid"
        :disabled="disabled"
        aria-labelledby="rec-platform"
        @change="change({ platform: $event.target.value })"
      />
    </div>
    <div class="flex flex-wrap items-start gap-3" data-filter-level="audience">
      <span id="rec-audience" class="filter-label">应用类型</span>
      <Radio.Group
        :value="selection.audience"
        :options="audienceOptions"
        option-type="button"
        button-style="solid"
        :disabled="disabled"
        aria-labelledby="rec-audience"
        @change="change({ audience: $event.target.value })"
      />
    </div>
    <div
      v-if="showSections"
      class="flex flex-wrap items-start gap-3"
      data-filter-level="section"
    >
      <span id="rec-section" class="filter-label">推荐栏目</span>
      <Radio.Group
        :value="selection.section"
        :options="sectionOptions"
        option-type="button"
        button-style="solid"
        :disabled="disabled"
        aria-labelledby="rec-section"
        @change="change({ section: $event.target.value })"
      />
    </div>
    <div
      v-if="showCategories"
      class="flex flex-wrap items-start gap-3"
      data-filter-level="category"
    >
      <span id="rec-category" class="filter-label">应用分类</span>
      <div class="min-w-0 flex-1 space-y-3">
        <Alert
          v-if="categoryFailed"
          message="应用分类加载失败，请重试"
          type="error"
          show-icon
        >
          <template #action>
            <Button size="small" @click="$emit('retryCategories')">
              重试分类
            </Button>
          </template>
        </Alert>
        <span v-if="categoryLoading" class="text-sm">分类加载中…</span>
        <span
          v-else-if="!categoryFailed && categories.length === 0"
          class="text-sm"
        >
          暂无可用分类
        </span>
        <Radio.Group
          :value="selection.categoryId"
          :options="categoryOptions"
          class="recommendation-categories"
          option-type="button"
          button-style="solid"
          :disabled="disabled || categoryLoading"
          aria-labelledby="rec-category"
          @change="change({ categoryId: $event.target.value })"
        />
      </div>
    </div>
  </div>
</template>
<style scoped>
.filter-label {
  flex-shrink: 0;
  width: 5rem;
  line-height: 2rem;
}

.recommendation-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 0;
}
</style>
