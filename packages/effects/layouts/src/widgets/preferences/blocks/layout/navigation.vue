<script setup lang="ts">
import type { SelectOption } from '@vben/types';

import { getText } from '@vben/texts';

import SwitchItem from '../switch-item.vue';
import ToggleItem from '../toggle-item.vue';

defineOptions({
  name: 'PreferenceNavigationConfig',
});

defineProps<{ disabled?: boolean; disabledNavigationSplit?: boolean }>();

const navigationStyleType = defineModel<string>('navigationStyleType');
const navigationSplit = defineModel<boolean>('navigationSplit');
const navigationAccordion = defineModel<boolean>('navigationAccordion');

const stylesItems: SelectOption[] = [
  { label: getText('preferences.rounded'), value: 'rounded' },
  { label: getText('preferences.plain'), value: 'plain' },
];
</script>

<template>
  <ToggleItem
    v-model="navigationStyleType"
    :disabled="disabled"
    :items="stylesItems"
  >
    {{ getText('preferences.navigationMenu.style') }}
  </ToggleItem>
  <SwitchItem
    v-model="navigationSplit"
    :disabled="disabledNavigationSplit || disabled"
  >
    {{ getText('preferences.navigationMenu.split') }}
    <template #tip>
      {{ getText('preferences.navigationMenu.splitTip') }}
    </template>
  </SwitchItem>
  <SwitchItem v-model="navigationAccordion" :disabled="disabled">
    {{ getText('preferences.navigationMenu.accordion') }}
  </SwitchItem>
</template>
