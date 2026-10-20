<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Alert, Spin } from 'ant-design-vue';

import { socialLoginApi } from '#/api';
import { useAuthStore } from '#/store';
const route = useRoute();
const auth = useAuthStore();
const error = ref('');
const loading = ref(true);
onMounted(async () => {
  try {
    const raw = sessionStorage.getItem('social-login');
    sessionStorage.removeItem('social-login');
    const saved = raw ? JSON.parse(raw) : null;
    if (
      !saved ||
      !Number.isInteger(saved.type) ||
      Date.now() - saved.createdAt > 600000 ||
      Date.now() < saved.createdAt ||
      saved.state !== route.query.state ||
      typeof route.query.code !== 'string' ||
      !route.query.code
    )
      throw new Error('授权已失效或校验失败，请重新登录');
    const data = {
      type: saved.type,
      state: saved.state,
      code: route.query.code,
    };
    await auth.authLogin({}, undefined, () => socialLoginApi(data));
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : '第三方登录失败，请返回登录页重试';
  } finally {
    loading.value = false;
  }
});
</script>
<template>
  <Spin :spinning="loading">
    <div class="py-8">
      <Alert v-if="error" type="error" :message="error" />
      <p v-else>正在完成第三方登录…</p>
      <RouterLink v-if="error" to="/auth/login">返回登录页</RouterLink>
    </div>
  </Spin>
</template>
