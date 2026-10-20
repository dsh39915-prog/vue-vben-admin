<script setup lang="ts">
import type { CaptchaChallenge } from '#/api/core/captcha';

import { onBeforeUnmount, ref } from 'vue';

import { Alert, Button, Modal, Slider, Spin } from 'ant-design-vue';

import { checkCaptchaApi, getCaptchaApi } from '#/api/core/captcha';
import { encryptCaptcha } from '#/features/auth/captcha';
const open = ref(false);
const loading = ref(false);
const checking = ref(false);
const challenge = ref<CaptchaChallenge>();
const offset = ref(0);
const error = ref('');
let resolve: ((value: string | undefined) => void) | undefined;
let generation = 0;
function close(value?: string) {
  generation++;
  open.value = false;
  const done = resolve;
  resolve = undefined;
  done?.(value);
}
async function load() {
  const id = ++generation;
  loading.value = true;
  error.value = '';
  challenge.value = undefined;
  offset.value = 0;
  try {
    const data = await getCaptchaApi();
    if (id === generation) challenge.value = data;
  } catch (e) {
    if (id === generation)
      error.value = e instanceof Error ? e.message : '验证码加载失败，请重试';
  } finally {
    if (id === generation) loading.value = false;
  }
}
function verify() {
  close();
  open.value = true;
  void load();
  return new Promise<string | undefined>((done) => {
    resolve = done;
  });
}
async function check() {
  if (!challenge.value || checking.value || loading.value) return;
  const id = generation;
  checking.value = true;
  error.value = '';
  const { token, secretKey } = challenge.value;
  const point = JSON.stringify({ x: offset.value, y: 5 });
  try {
    await checkCaptchaApi(token, encryptCaptcha(point, secretKey));
    if (id === generation)
      close(encryptCaptcha(token + '---' + point, secretKey));
  } catch (e) {
    if (id === generation) {
      challenge.value = undefined;
      error.value = e instanceof Error ? e.message : '验证失败，请刷新后重试';
    }
  } finally {
    checking.value = false;
  }
}
onBeforeUnmount(() => close());
defineExpose({ verify });
</script>
<template>
  <Modal
    :open="open"
    title="拖动滑块完成图片验证"
    :footer="null"
    :width="360"
    :mask-closable="false"
    @cancel="close()"
  >
    <Spin :spinning="loading || checking">
      <Alert
        v-if="error"
        class="mb-4!"
        type="error"
        :message="error"
        show-icon
      />
      <div v-if="challenge" style="width: 310px">
        <div class="relative" style="width: 310px; height: 155px">
          <img
            :src="`data:image/png;base64,${challenge.originalImageBase64}`"
            alt="验证背景"
            style="width: 310px; height: 155px"
            draggable="false"
          />
          <img
            :src="`data:image/png;base64,${challenge.jigsawImageBase64}`"
            alt="待拼合图块"
            class="absolute top-0"
            :style="{ left: `${offset}px`, width: '47px', height: '155px' }"
            draggable="false"
          />
        </div>
        <Slider
          v-model:value="offset"
          :min="0"
          :max="263"
          :step="1"
          :disabled="checking || loading"
          :tooltip-open="false"
          aria-label="验证滑块"
          @after-change="check"
        />
      </div>
      <Button :disabled="checking || loading" @click="load">
        <span>刷新验证码</span>
      </Button>
    </Spin>
  </Modal>
</template>
