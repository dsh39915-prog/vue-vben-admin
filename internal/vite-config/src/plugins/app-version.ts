import type { Plugin } from 'vite';

import { randomUUID } from 'node:crypto';

/** 同一次构建在页面代码和版本文件中使用相同标识。 */
export function viteAppVersionPlugin(): Plugin {
  const buildId = randomUUID();

  return {
    apply: 'build',
    config() {
      return {
        define: {
          'import.meta.env.VITE_APP_BUILD_ID': JSON.stringify(buildId),
        },
      };
    },
    generateBundle() {
      this.emitFile({
        fileName: 'app-version.json',
        source: `${JSON.stringify({ buildId })}\n`,
        type: 'asset',
      });
    },
    name: 'vite:app-version',
  };
}
