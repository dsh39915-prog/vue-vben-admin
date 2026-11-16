<script setup lang="ts">
import type { SelectOption } from '@vben/types';

import { computed } from 'vue';

import { getText } from '@vben/texts';

import SwitchItem from '../switch-item.vue';
import ToggleItem from '../toggle-item.vue';

defineOptions({
  name: 'PreferenceBreadcrumbConfig',
});

const props = defineProps<{ disabled?: boolean }>();

const breadcrumbEnable = defineModel<boolean>('breadcrumbEnable');
const breadcrumbShowIcon = defineModel<boolean>('breadcrumbShowIcon');
const breadcrumbStyleType = defineModel<string>('breadcrumbStyleType');
const breadcrumbShowHome = defineModel<boolean>('breadcrumbShowHome');
const breadcrumbHideOnlyOne = defineModel<boolean>('breadcrumbHideOnlyOne');

const typeItems: SelectOption[] = [
  { label: getText('preferences.normal'), value: 'normal' },
  { label: getText('preferences.breadcrumb.background'), value: 'background' },
];

const disableItem = computed(() => {
  return !breadcrumbEnable.value || props.disabled;
});
</script>

<template>
  <SwitchItem v-model="breadcrumbEnable" :disabled="disabled">
    {{ getText('preferences.breadcrumb.enable') }}
  </SwitchItem>
  <SwitchItem v-model="breadcrumbHideOnlyOne" :disabled="disableItem">
    {{ getText('preferences.breadcrumb.hideOnlyOne') }}
  </SwitchItem>
  <SwitchItem v-model="breadcrumbShowIcon" :disabled="disableItem">
    {{ getText('preferences.breadcrumb.icon') }}
  </SwitchItem>
  <SwitchItem
    v-model="breadcrumbShowHome"
    :disabled="disableItem || !breadcrumbShowIcon"
  >
    {{ getText('preferences.breadcrumb.home') }}
  </SwitchItem>
  <ToggleItem
    v-model="breadcrumbStyleType"
    :disabled="disableItem"
    :items="typeItems"
  >
    {{ getText('preferences.breadcrumb.style') }}
  </ToggleItem>
</template>
