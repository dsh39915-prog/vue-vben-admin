// @vitest-environment node
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

import { viteAppVersionPlugin } from './app-version';

async function buildVersion() {
  const result = await build({
    build: {
      minify: false,
      rollupOptions: { input: 'virtual:version-test' },
      write: false,
    },
    configFile: false,
    logLevel: 'silent',
    plugins: [
      viteAppVersionPlugin(),
      {
        load(id) {
          if (id === 'virtual:version-test') {
            return 'console.log(import.meta.env.VITE_APP_BUILD_ID);';
          }
        },
        name: 'version-test-entry',
        resolveId(id) {
          if (id === 'virtual:version-test') {
            return id;
          }
        },
      },
    ],
    publicDir: false,
  });
  if (Array.isArray(result) || !('output' in result)) {
    throw new Error('Expected a single build output');
  }
  const asset = result.output.find(
    (file) => file.fileName === 'app-version.json',
  );
  if (asset?.type !== 'asset') {
    throw new Error('Missing app-version.json');
  }
  const { buildId } = JSON.parse(String(asset.source));
  const entry = result.output.find((file) => file.type === 'chunk');
  return { buildId, entry };
}

describe('应用构建版本', () => {
  it('版本文件与页面内置标识一致，每次构建生成新标识', async () => {
    const first = await buildVersion();
    expect(first.buildId).toMatch(/^[\da-f-]{36}$/);
    expect(first.entry?.code).toContain(first.buildId);
    const second = await buildVersion();
    expect(second.buildId).not.toBe(first.buildId);
    expect(second.entry?.code).toContain(second.buildId);
  });
});
