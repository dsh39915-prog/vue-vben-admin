<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

import { getText } from '@vben/texts';

import { useVbenModal } from '@vben-core/popup-ui';

import { startUpdateChecker } from './update-checker';

interface Props {
  // 轮询时间，分钟
  checkUpdatesInterval?: number;
  // 返回 { buildId: string } 的版本文件地址
  checkUpdateUrl?: string;
}

defineOptions({ name: 'CheckUpdates' });

const props = withDefaults(defineProps<Props>(), {
  checkUpdatesInterval: 1,
  checkUpdateUrl: `${import.meta.env.BASE_URL || '/'}app-version.json`,
});

let stopChecking: (() => void) | undefined;

const [UpdateNoticeModal, modalApi] = useVbenModal({
  closable: false,
  closeOnPressEscape: false,
  closeOnClickModal: false,
  onConfirm() {
    window.location.reload();
  },
});

onMounted(() => {
  stopChecking = startUpdateChecker({
    buildId: import.meta.env.VITE_APP_BUILD_ID,
    intervalMinutes: props.checkUpdatesInterval,
    onUpdate: () => modalApi.open(),
    url: props.checkUpdateUrl,
  });
});

onUnmounted(() => {
  stopChecking?.();
});
</script>
<template>
  <UpdateNoticeModal
    :cancel-text="getText('common.cancel')"
    :confirm-text="getText('common.refresh')"
    :fullscreen-button="false"
    :title="getText('ui.widgets.checkUpdatesTitle')"
    centered
    content-class="px-8 min-h-10"
    footer-class="border-none mb-3 mr-3"
    header-class="border-none"
  >
    {{ getText('ui.widgets.checkUpdatesDescription') }}
  </UpdateNoticeModal>
</template>
