<script setup lang="ts">
import type { SelectOption } from '@vben/types';

import { computed } from 'vue';

import { getText } from '@vben/texts';

import NumberFieldItem from '../number-field-item.vue';
import SelectItem from '../select-item.vue';
import SwitchItem from '../switch-item.vue';

defineOptions({
  name: 'PreferenceTabsConfig',
});

defineProps<{ disabled?: boolean }>();

const tabbarEnable = defineModel<boolean>('tabbarEnable');
const tabbarShowIcon = defineModel<boolean>('tabbarShowIcon');
const tabbarPersist = defineModel<boolean>('tabbarPersist');
const tabbarVisitHistory = defineModel<boolean>('tabbarVisitHistory');
const tabbarDraggable = defineModel<boolean>('tabbarDraggable');
const tabbarWheelable = defineModel<boolean>('tabbarWheelable');
const tabbarStyleType = defineModel<string>('tabbarStyleType');
const tabbarShowMore = defineModel<boolean>('tabbarShowMore');
const tabbarShowMaximize = defineModel<boolean>('tabbarShowMaximize');
const tabbarMaxCount = defineModel<number>('tabbarMaxCount');
const tabbarMiddleClickToClose = defineModel<boolean>(
  'tabbarMiddleClickToClose',
);

const styleItems = computed((): SelectOption[] => [
  {
    label: getText('preferences.tabbar.styleType.chrome'),
    value: 'chrome',
  },
  {
    label: getText('preferences.tabbar.styleType.plain'),
    value: 'plain',
  },
  {
    label: getText('preferences.tabbar.styleType.card'),
    value: 'card',
  },

  {
    label: getText('preferences.tabbar.styleType.brisk'),
    value: 'brisk',
  },
]);
</script>

<template>
  <SwitchItem v-model="tabbarEnable" :disabled="disabled">
    {{ getText('preferences.tabbar.enable') }}
  </SwitchItem>
  <SwitchItem v-model="tabbarPersist" :disabled="!tabbarEnable">
    {{ getText('preferences.tabbar.persist') }}
  </SwitchItem>
  <SwitchItem
    v-model="tabbarVisitHistory"
    :disabled="!tabbarEnable"
    :tip="getText('preferences.tabbar.visitHistoryTip')"
  >
    {{ getText('preferences.tabbar.visitHistory') }}
  </SwitchItem>
  <NumberFieldItem
    v-model="tabbarMaxCount"
    :disabled="!tabbarEnable"
    :max="30"
    :min="0"
    :step="5"
    :tip="getText('preferences.tabbar.maxCountTip')"
  >
    {{ getText('preferences.tabbar.maxCount') }}
  </NumberFieldItem>
  <SwitchItem v-model="tabbarDraggable" :disabled="!tabbarEnable">
    {{ getText('preferences.tabbar.draggable') }}
  </SwitchItem>
  <SwitchItem
    v-model="tabbarWheelable"
    :disabled="!tabbarEnable"
    :tip="getText('preferences.tabbar.wheelableTip')"
  >
    {{ getText('preferences.tabbar.wheelable') }}
  </SwitchItem>
  <SwitchItem v-model="tabbarMiddleClickToClose" :disabled="!tabbarEnable">
    {{ getText('preferences.tabbar.middleClickClose') }}
  </SwitchItem>
  <SwitchItem v-model="tabbarShowIcon" :disabled="!tabbarEnable">
    {{ getText('preferences.tabbar.icon') }}
  </SwitchItem>
  <SwitchItem v-model="tabbarShowMore" :disabled="!tabbarEnable">
    {{ getText('preferences.tabbar.showMore') }}
  </SwitchItem>
  <SwitchItem v-model="tabbarShowMaximize" :disabled="!tabbarEnable">
    {{ getText('preferences.tabbar.showMaximize') }}
  </SwitchItem>
  <SelectItem v-model="tabbarStyleType" :items="styleItems">
    {{ getText('preferences.tabbar.styleType.title') }}
  </SelectItem>
</template>
