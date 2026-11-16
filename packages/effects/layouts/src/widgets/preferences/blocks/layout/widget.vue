<script setup lang="ts">
import type { SelectOption } from '@vben/types';

import { computed } from 'vue';

import { getText } from '@vben/texts';

import SelectItem from '../select-item.vue';
import SwitchItem from '../switch-item.vue';

defineOptions({
  name: 'PreferenceInterfaceControl',
});

const widgetGlobalSearch = defineModel<boolean>('widgetGlobalSearch');
const widgetFullscreen = defineModel<boolean>('widgetFullscreen');
const widgetNotification = defineModel<boolean>('widgetNotification');
const widgetThemeToggle = defineModel<boolean>('widgetThemeToggle');
const widgetSidebarToggle = defineModel<boolean>('widgetSidebarToggle');
const widgetLockScreen = defineModel<boolean>('widgetLockScreen');
const appPreferencesButtonPosition = defineModel<string>(
  'appPreferencesButtonPosition',
);
const widgetRefresh = defineModel<boolean>('widgetRefresh');
const widgetTimezone = defineModel<boolean>('widgetTimezone');

const positionItems = computed((): SelectOption[] => [
  {
    label: getText('preferences.position.auto'),
    value: 'auto',
  },
  {
    label: getText('preferences.position.header'),
    value: 'header',
  },
  {
    label: getText('preferences.position.fixed'),
    value: 'fixed',
  },
  {
    label: getText('preferences.position.userDropdown'),
    value: 'user-dropdown',
  },
]);
</script>

<template>
  <SwitchItem v-model="widgetGlobalSearch">
    {{ getText('preferences.widget.globalSearch') }}
  </SwitchItem>
  <SwitchItem v-model="widgetThemeToggle">
    {{ getText('preferences.widget.themeToggle') }}
  </SwitchItem>
  <SwitchItem v-model="widgetFullscreen">
    {{ getText('preferences.widget.fullscreen') }}
  </SwitchItem>
  <SwitchItem v-model="widgetNotification">
    {{ getText('preferences.widget.notification') }}
  </SwitchItem>
  <SwitchItem v-model="widgetLockScreen">
    {{ getText('preferences.widget.lockScreen') }}
  </SwitchItem>
  <SwitchItem v-model="widgetSidebarToggle">
    {{ getText('preferences.widget.sidebarToggle') }}
  </SwitchItem>
  <SwitchItem v-model="widgetRefresh">
    {{ getText('preferences.widget.refresh') }}
  </SwitchItem>
  <SwitchItem v-model="widgetTimezone">
    {{ getText('preferences.widget.timezone') }}
  </SwitchItem>
  <SelectItem v-model="appPreferencesButtonPosition" :items="positionItems">
    {{ getText('preferences.position.title') }}
  </SelectItem>
</template>
