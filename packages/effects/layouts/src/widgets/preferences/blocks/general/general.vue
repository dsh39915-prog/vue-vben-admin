<script setup lang="ts">
import { onMounted, ref, unref } from 'vue';

import { useTimezoneStore } from '@vben/stores';
import { getText } from '@vben/texts';

import InputItem from '../input-item.vue';
import SelectItem from '../select-item.vue';
import SwitchItem from '../switch-item.vue';

defineOptions({
  name: 'PreferenceGeneralConfig',
});

const appTimezone = defineModel<string>('appTimezone');
const appDynamicTitle = defineModel<boolean>('appDynamicTitle');
const appWatermark = defineModel<boolean>('appWatermark');
const appWatermarkContent = defineModel<string>('appWatermarkContent');
const appEnableCheckUpdates = defineModel<boolean>('appEnableCheckUpdates');
const appEnableCopyPreferences = defineModel<boolean>(
  'appEnableCopyPreferences',
);
const timezoneStore = useTimezoneStore();

const timezoneOptionsRef = ref<
  {
    label: string;
    value: string;
  }[]
>([]);

onMounted(async () => {
  timezoneOptionsRef.value = await timezoneStore.getTimezoneOptions();
  // 获取当前时区，例如：Asia/Shanghai
  const timezoneValue = unref(timezoneStore.timezone);
  if (timezoneValue) {
    appTimezone.value = timezoneValue;
  }
});
</script>

<template>
  <SelectItem v-model="appTimezone" :items="timezoneOptionsRef">
    {{ getText('preferences.timezone') }}
  </SelectItem>
  <SwitchItem v-model="appDynamicTitle">
    {{ getText('preferences.dynamicTitle') }}
  </SwitchItem>
  <SwitchItem
    v-model="appWatermark"
    @update:model-value="
      (val) => {
        if (!val) appWatermarkContent = '';
      }
    "
  >
    {{ getText('preferences.watermark') }}
  </SwitchItem>
  <InputItem
    v-if="appWatermark"
    v-model="appWatermarkContent"
    :placeholder="getText('preferences.watermarkContent')"
  >
    {{ getText('preferences.watermarkContent') }}
  </InputItem>
  <SwitchItem v-model="appEnableCheckUpdates">
    {{ getText('preferences.checkUpdates') }}
  </SwitchItem>
  <SwitchItem v-model="appEnableCopyPreferences">
    {{ getText('preferences.enableCopyPreferences') }}
  </SwitchItem>
</template>
