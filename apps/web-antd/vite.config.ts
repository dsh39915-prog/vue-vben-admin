import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: { nitroMock: false },
    vite: {
      server: {
        proxy: {
          '/resource-download/': {
            target: 'http://app-res.mc.cn',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/resource-download\//, '/soft/'),
            configure(proxy) {
              proxy.on('proxyReq', (request) => {
                request.removeHeader('authorization');
                request.removeHeader('cookie');
              });
              proxy.on('proxyRes', (response) => {
                response.headers['content-disposition'] = 'attachment';
                delete response.headers['set-cookie'];
              });
            },
          },
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
