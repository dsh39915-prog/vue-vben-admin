<script setup lang="ts">
import { getText } from '@vben/texts';

import SwitchItem from '../switch-item.vue';

defineOptions({
  name: 'PreferenceColorMode',
});

const appColorWeakMode = defineModel<boolean>('appColorWeakMode', {
  default: false,
});

const appColorGrayMode = defineModel<boolean>('appColorGrayMode', {
  default: false,
});
</script>

<template>
  <SwitchItem v-model="appColorWeakMode">
    {{ getText('preferences.theme.weakMode') }}
  </SwitchItem>
  <SwitchItem v-model="appColorGrayMode">
    {{ getText('preferences.theme.grayMode') }}
  </SwitchItem>
</template>
