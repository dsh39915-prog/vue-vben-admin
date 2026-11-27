<script setup lang="ts">
import type {
  CaptchaInstance,
  CaptchaVerifyResult,
} from './aliyun-captcha-sdk';

import type { AuthApi } from '#/api';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from 'vue';

import { Alert, Button } from 'ant-design-vue';

import { loadAliyunCaptcha } from './aliyun-captcha-sdk';

const props = defineProps<{
  config: AuthApi.CaptchaConfig;
  disabled?: boolean;
  verify: (parameter: string) => Promise<boolean>;
}>();
const emit = defineEmits<{
  ready: [value: boolean];
  visible: [value: boolean];
  working: [value: boolean];
}>();
const suffix = useId().replaceAll(/[^a-zA-Z0-9]/g, '');
const elementId = `aliyun-captcha-${suffix}`;
const buttonId = `aliyun-trigger-${suffix}`;
const container = ref<HTMLElement>();
const trigger = ref<HTMLButtonElement>();
const failed = ref(false);
const noInteraction = ref(false);
const loading = ref(true);
const verifying = ref(false);
const visible = computed(
  () => failed.value || (!loading.value && !noInteraction.value),
);
watch(visible, (value) => emit('visible', value), { immediate: true });
const generation = ref(0);
const destroyedInstances = new WeakSet<CaptchaInstance>();
let instance: CaptchaInstance | undefined;
let disposed = false;

function destroyInstance(value: CaptchaInstance | undefined) {
  if (!value || destroyedInstances.has(value)) return;
  // SDK 销毁时会同步触发 getInstance，先清除引用并标记，避免重入销毁。
  if (instance === value) instance = undefined;
  destroyedInstances.add(value);
  value.destroyCaptcha();
}

async function initialize() {
  const request = ++generation.value;
  failed.value = false;
  noInteraction.value = false;
  loading.value = true;
  emit('ready', false);
  destroyInstance(instance);
  await nextTick();
  container.value?.replaceChildren();
  const isCurrent = () => !disposed && request === generation.value;
  function fail() {
    if (!isCurrent()) return;
    failed.value = true;
    loading.value = false;
    emit('ready', false);
  }
  try {
    if (!props.config.sceneId || !props.config.prefix)
      throw new Error('验证码配置不完整');
    const initializeCaptcha = await loadAliyunCaptcha(props.config);
    if (!isCurrent()) return;
    const started = Date.now();
    const initialized = await initializeCaptcha({
      SceneId: props.config.sceneId,
      mode: 'embed',
      element: `#${elementId}`,
      button: `#${buttonId}`,
      language: 'cn',
      slideStyle: {
        width: Math.max(320, container.value?.clientWidth || 360),
        height: 40,
      },
      onError: fail,
      captchaVerifyCallback: async (
        parameter,
      ): Promise<CaptchaVerifyResult> => {
        if (!isCurrent() || props.disabled || verifying.value || !parameter)
          return { captchaResult: false, bizResult: false };
        verifying.value = true;
        emit('working', true);
        try {
          const valid = await props.verify(parameter);
          // 登录或短信挑战已被服务端接受，才向 SDK 返回验证通过。
          return { captchaResult: valid, bizResult: valid };
        } catch {
          return { captchaResult: false, bizResult: false };
        } finally {
          if (isCurrent()) {
            verifying.value = false;
            emit('working', false);
          }
        }
      },
      getInstance(value) {
        // SDK 在销毁实例时也会回传空值。
        if (!value) {
          if (isCurrent()) instance = undefined;
          return;
        }
        if (destroyedInstances.has(value)) return;
        if (isCurrent()) instance = value;
        else destroyInstance(value);
      },
    });
    noInteraction.value =
      typeof initialized === 'object' &&
      initialized !== null &&
      'CaptchaType' in initialized &&
      initialized.CaptchaType === 'TRACELESS';
    // 官方要求采集设备信息后至少间隔 2 秒再触发业务验证。
    const remaining = 2000 - (Date.now() - started);
    if (remaining > 0)
      await new Promise((resolve) => setTimeout(resolve, remaining));
    if (!isCurrent()) return;
    if (!instance || failed.value) throw new Error('验证码初始化失败');
    loading.value = false;
    emit('ready', true);
  } catch {
    fail();
  }
}
function start() {
  if (
    disposed ||
    loading.value ||
    failed.value ||
    verifying.value ||
    props.disabled
  )
    return;
  trigger.value?.click();
}
function reset() {
  instance?.refresh();
}
defineExpose({ reset, start });
onMounted(initialize);
onBeforeUnmount(() => {
  disposed = true;
  ++generation.value;
  destroyInstance(instance);
  emit('ready', false);
  emit('working', false);
});
</script>

<template>
  <div class="w-full" :aria-busy="loading || verifying">
    <div
      :id="elementId"
      ref="container"
      class="w-full"
      :class="{ 'min-h-10': visible && !failed }"
    ></div>
    <button
      :id="buttonId"
      :key="generation"
      ref="trigger"
      type="button"
      class="hidden"
      tabindex="-1"
      aria-hidden="true"
    ></button>
    <Alert
      v-if="failed"
      class="mt-2"
      message="安全验证加载失败，请重试"
      type="error"
      show-icon
    >
      <template #action>
        <Button
          size="small"
          :disabled="loading || verifying"
          @click="initialize"
        >
          重试
        </Button>
      </template>
    </Alert>
  </div>
</template>
