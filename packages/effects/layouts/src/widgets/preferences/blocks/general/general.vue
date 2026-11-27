<script setup lang="ts">
import { getText } from '@vben/texts';

import InputItem from '../input-item.vue';
import SwitchItem from '../switch-item.vue';

defineOptions({
  name: 'PreferenceGeneralConfig',
});

const appDynamicTitle = defineModel<boolean>('appDynamicTitle');
const appWatermark = defineModel<boolean>('appWatermark');
const appWatermarkContent = defineModel<string>('appWatermarkContent');
const appEnableCheckUpdates = defineModel<boolean>('appEnableCheckUpdates');
const appEnableCopyPreferences = defineModel<boolean>(
  'appEnableCopyPreferences',
);
</script>

<template>
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
