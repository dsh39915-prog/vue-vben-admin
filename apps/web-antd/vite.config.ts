import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: { nitroMock: false },
    vite: {
      server: {
        proxy: {
          '/config-api': {
            // 保留前端 Host，使携带 Origin 的同源登录请求通过后端校验。
            changeOrigin: false,
            rewrite: (path) =>
              path
                .replace(/^\/config-api(?=\/|$)/, '')
                .replace(/^\/system(?=\/|$)/, '/api/system'),
            target: 'http://192.168.5.197:8080',
          },
        },
      },
    },
  };
});
