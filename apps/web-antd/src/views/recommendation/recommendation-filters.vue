<script setup lang="ts">
import type { RecommendationSelection } from './filter-selection';

import { computed } from 'vue';

import { Radio } from 'ant-design-vue';

import { audienceOptions, platformOptions, sectionOptions } from './data';
import { changeRecommendationSelection } from './filter-selection';

defineProps<{ disabled: boolean }>();
const selection = defineModel<RecommendationSelection>({ required: true });
const platformButtonOptions = platformOptions.map((option) => ({
  ...option,
  label: `${option.label}OS`,
}));
const showSections = computed(() => selection.value.audience !== 'featured');
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
  </div>
</template>
<style scoped>
.filter-label {
  flex-shrink: 0;
  width: 5rem;
  line-height: 2rem;
}
</style>
