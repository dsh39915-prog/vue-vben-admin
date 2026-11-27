<script setup lang="ts">
import { ConfigProvider, theme } from 'ant-design-vue';
</script>

<template>
  <ConfigProvider
    :theme="{ algorithm: theme.defaultAlgorithm, inherit: false }"
  >
    <main
      class="auth-page flex min-h-svh w-full items-center justify-center bg-white px-6 py-12 text-slate-900"
    >
      <div class="w-full max-w-[400px]">
        <RouterView v-slot="{ Component, route }">
          <KeepAlive :include="['Login']">
            <component :is="Component" :key="route.fullPath" />
          </KeepAlive>
        </RouterView>
      </div>
    </main>
  </ConfigProvider>
</template>

<style scoped>
.auth-page {
  --foreground: 222.2 84% 4.9%;
  --muted-foreground: 215.4 16.3% 46.9%;

  color-scheme: light;
}
</style>
