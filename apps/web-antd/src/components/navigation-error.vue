<script setup lang="ts">
import { useRouter } from 'vue-router';

import { navigationFailure } from '#/router/navigation-error';
import { useAuthStore } from '#/store';

const router = useRouter();
const auth = useAuthStore();
function reload() {
  const target = navigationFailure.value?.fullPath;
  if (!target) return;
  const href = router.resolve(target).href;
  // 原生模块导入失败可能被浏览器缓存，整页重载可重新获取入口和资源。
  window.history.replaceState(window.history.state, '', href);
  window.location.reload();
}
</script>

<template>
  <main
    class="flex min-h-svh items-center justify-center bg-background px-6 text-foreground"
  >
    <section class="w-full max-w-md text-center" role="alert">
      <h1 class="mb-3 text-2xl font-semibold">页面资源加载失败</h1>
      <p class="mb-6 text-muted-foreground">
        网络异常或版本更新可能导致页面暂时无法打开，请重新加载。
      </p>
      <div class="flex justify-center gap-3">
        <button
          type="button"
          class="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          @click="reload"
        >
          重新加载
        </button>
        <button
          type="button"
          class="rounded-md border border-border px-4 py-2"
          @click="auth.logout(false, false)"
        >
          返回登录
        </button>
      </div>
    </section>
  </main>
</template>
