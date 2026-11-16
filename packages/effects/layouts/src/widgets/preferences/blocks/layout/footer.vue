<script setup lang="ts">
import { getText } from '@vben/texts';

import SwitchItem from '../switch-item.vue';

const footerEnable = defineModel<boolean>('footerEnable');
const footerFixed = defineModel<boolean>('footerFixed');
</script>

<template>
  <SwitchItem v-model="footerEnable">
    {{ getText('preferences.footer.visible') }}
  </SwitchItem>
  <SwitchItem v-model="footerFixed" :disabled="!footerEnable">
    {{ getText('preferences.footer.fixed') }}
  </SwitchItem>
</template>
