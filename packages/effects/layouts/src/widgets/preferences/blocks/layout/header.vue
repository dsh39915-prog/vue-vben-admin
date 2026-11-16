<script setup lang="ts">
import type {
  LayoutHeaderMenuAlignType,
  LayoutHeaderModeType,
  SelectOption,
} from '@vben/types';

import { getText } from '@vben/texts';

import SelectItem from '../select-item.vue';
import SwitchItem from '../switch-item.vue';
import ToggleItem from '../toggle-item.vue';

defineProps<{ disabled: boolean }>();

const headerEnable = defineModel<boolean>('headerEnable');
const headerMode = defineModel<LayoutHeaderModeType>('headerMode');
const headerMenuAlign =
  defineModel<LayoutHeaderMenuAlignType>('headerMenuAlign');

const modeItems: SelectOption[] = [
  {
    label: getText('preferences.header.modeStatic'),
    value: 'static',
  },
  {
    label: getText('preferences.header.modeFixed'),
    value: 'fixed',
  },
  {
    label: getText('preferences.header.modeAuto'),
    value: 'auto',
  },
  {
    label: getText('preferences.header.modeAutoScroll'),
    value: 'auto-scroll',
  },
];

const headerMenuAlignItems: SelectOption[] = [
  {
    label: getText('preferences.header.menuAlignStart'),
    value: 'start',
  },
  {
    label: getText('preferences.header.menuAlignCenter'),
    value: 'center',
  },
  {
    label: getText('preferences.header.menuAlignEnd'),
    value: 'end',
  },
];
</script>

<template>
  <SwitchItem v-model="headerEnable" :disabled="disabled">
    {{ getText('preferences.header.visible') }}
  </SwitchItem>
  <SelectItem v-model="headerMode" :disabled="!headerEnable" :items="modeItems">
    {{ getText('preferences.mode') }}
  </SelectItem>
  <ToggleItem
    v-model="headerMenuAlign"
    :disabled="!headerEnable"
    :items="headerMenuAlignItems"
  >
    {{ getText('preferences.header.menuAlign') }}
  </ToggleItem>
</template>
