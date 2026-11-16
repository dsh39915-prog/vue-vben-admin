<script setup lang="ts">
import type { LayoutType } from '@vben/types';

import { onMounted } from 'vue';

import { getText } from '@vben/texts';

import CheckboxItem from '../checkbox-item.vue';
import NumberFieldItem from '../number-field-item.vue';
import SwitchItem from '../switch-item.vue';

defineProps<{ currentLayout?: LayoutType; disabled: boolean }>();

const sidebarEnable = defineModel<boolean>('sidebarEnable');
const sidebarWidth = defineModel<number>('sidebarWidth');
const sidebarCollapsedShowTitle = defineModel<boolean>(
  'sidebarCollapsedShowTitle',
);
const sidebarAutoActivateChild = defineModel<boolean>(
  'sidebarAutoActivateChild',
);
const sidebarDraggable = defineModel<boolean>('sidebarDraggable');
const sidebarCollapsed = defineModel<boolean>('sidebarCollapsed');
const sidebarExpandOnHover = defineModel<boolean>('sidebarExpandOnHover');

const sidebarButtons = defineModel<string[]>('sidebarButtons', { default: [] });
const sidebarCollapsedButton = defineModel<boolean>('sidebarCollapsedButton');
const sidebarFixedButton = defineModel<boolean>('sidebarFixedButton');

onMounted(() => {
  if (
    sidebarCollapsedButton.value &&
    !sidebarButtons.value.includes('collapsed')
  ) {
    sidebarButtons.value.push('collapsed');
  }
  if (sidebarFixedButton.value && !sidebarButtons.value.includes('fixed')) {
    sidebarButtons.value.push('fixed');
  }
});

const handleCheckboxChange = () => {
  sidebarCollapsedButton.value = !!sidebarButtons.value.includes('collapsed');
  sidebarFixedButton.value = !!sidebarButtons.value.includes('fixed');
};
</script>

<template>
  <SwitchItem v-model="sidebarEnable" :disabled="disabled">
    {{ getText('preferences.sidebar.visible') }}
  </SwitchItem>
  <SwitchItem v-model="sidebarDraggable" :disabled="!sidebarEnable || disabled">
    {{ getText('preferences.sidebar.draggable') }}
  </SwitchItem>
  <SwitchItem v-model="sidebarCollapsed" :disabled="!sidebarEnable || disabled">
    {{ getText('preferences.sidebar.collapsed') }}
  </SwitchItem>
  <SwitchItem
    v-model="sidebarExpandOnHover"
    :disabled="!sidebarEnable || disabled || !sidebarCollapsed"
    :tip="getText('preferences.sidebar.expandOnHoverTip')"
  >
    {{ getText('preferences.sidebar.expandOnHover') }}
  </SwitchItem>
  <SwitchItem
    v-model="sidebarCollapsedShowTitle"
    :disabled="!sidebarEnable || disabled || !sidebarCollapsed"
  >
    {{ getText('preferences.sidebar.collapsedShowTitle') }}
  </SwitchItem>
  <SwitchItem
    v-model="sidebarAutoActivateChild"
    :disabled="
      !sidebarEnable ||
      !['sidebar-mixed-nav', 'mixed-nav', 'header-mixed-nav'].includes(
        currentLayout as string,
      ) ||
      disabled
    "
    :tip="getText('preferences.sidebar.autoActivateChildTip')"
  >
    {{ getText('preferences.sidebar.autoActivateChild') }}
  </SwitchItem>
  <CheckboxItem
    :items="[
      {
        label: getText('preferences.sidebar.buttonCollapsed'),
        value: 'collapsed',
      },
      { label: getText('preferences.sidebar.buttonFixed'), value: 'fixed' },
    ]"
    multiple
    v-model="sidebarButtons"
    :on-btn-click="handleCheckboxChange"
  >
    {{ getText('preferences.sidebar.buttons') }}
  </CheckboxItem>
  <NumberFieldItem
    v-model="sidebarWidth"
    :disabled="!sidebarEnable || disabled"
    :max="320"
    :min="160"
    :step="10"
  >
    {{ getText('preferences.sidebar.width') }}
  </NumberFieldItem>
</template>
