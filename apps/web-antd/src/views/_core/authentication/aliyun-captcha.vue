<script setup lang="ts">
import type { AuthApi } from '#/api';

import { onBeforeUnmount, onMounted, ref, useId } from 'vue';

import { Alert, Button } from 'ant-design-vue';

interface CaptchaInstance {
  destroy?: () => void;
  reset?: () => void;
}
type CaptchaWindow = Window & {
  initAliyunCaptcha?: (options: Record<string, unknown>) => void;
};
const props = defineProps<{ config: AuthApi.CaptchaConfig; value: string }>();
const emit = defineEmits<{ 'update:value': [string] }>();
const suffix = useId().replaceAll(/[^a-zA-Z0-9]/g, '');
const elementId = `aliyun-captcha-${suffix}`;
const buttonId = `aliyun-trigger-${suffix}`;
const failed = ref(false);
const loading = ref(true);
let instance: CaptchaInstance | undefined;
let disposed = false;
async function initialize() {
  failed.value = false;
  loading.value = true;
  try {
    const sdkWindow = window as CaptchaWindow;
    if (!sdkWindow.initAliyunCaptcha)
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src =
          'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js';
        script.async = true;
        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener(
          'error',
          () => {
            script.remove();
            reject(new Error('验证码脚本加载失败'));
          },
          { once: true },
        );
        document.head.append(script);
      });
    if (disposed) return;
    if (
      !sdkWindow.initAliyunCaptcha ||
      !props.config.sceneId ||
      !props.config.prefix
    )
      throw new Error('验证码配置不完整');
    sdkWindow.initAliyunCaptcha({
      SceneId: props.config.sceneId,
      prefix: props.config.prefix,
      mode: 'popup',
      element: `#${elementId}`,
      button: `#${buttonId}`,
      captchaVerifyCallback: async (captchaVerifyParam: string) => {
        if (!disposed) emit('update:value', captchaVerifyParam);
        // 仅取得挑战凭证，最终验证结果由登录接口决定。
        return { captchaResult: true, bizResult: true };
      },
      getInstance: (value: CaptchaInstance) => {
        instance = value;
      },
    });
  } catch {
    if (!disposed) failed.value = true;
  } finally {
    if (!disposed) loading.value = false;
  }
}
function reset() {
  emit('update:value', '');
  instance?.reset?.();
}
defineExpose({ reset });
onMounted(initialize);
onBeforeUnmount(() => {
  disposed = true;
  instance?.destroy?.();
});
</script>
<template>
  <div>
    <div :id="elementId"></div>
    <Button :id="buttonId" :loading="loading" :disabled="failed">
      {{ value ? '重新验证' : '点击完成滑块验证' }}
    </Button>
    <span v-if="value" class="ml-2 text-green-600">已取得验证凭证</span>
    <Alert
      v-if="failed"
      class="mt-2"
      message="滑块加载失败，请重试"
      type="error"
      show-icon
    >
      <template #action>
        <Button size="small" @click="initialize">重试</Button>
      </template>
    </Alert>
  </div>
</template>
