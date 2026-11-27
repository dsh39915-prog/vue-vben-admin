import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const app = join(root, 'apps/web-antd');
const dist = join(app, 'dist');
const environment = await readFile(join(app, '.env.production'), 'utf8');
const expectedURL = environment.match(/^VITE_GLOB_API_URL=(.+)$/m)?.[1]?.trim();
const configuration = await readFile(join(dist, '_app.config.js'), 'utf8');
const match = configuration.match(
  /^window\._VBEN_ADMIN_PRO_APP_CONF_=(\{.*?\});/s,
);
assert.ok(match, '构建产物缺少有效的运行时配置');
const { VITE_GLOB_API_URL: apiURL } = JSON.parse(match[1]);
assert.equal(apiURL, expectedURL, '产物接口地址与生产环境配置不一致');
assert.equal(new URL(apiURL).protocol, 'https:', '生产接口必须使用 HTTPS');
const sourceLicense = await readFile(join(root, 'LICENSE'), 'utf8');
const bundledLicense = await readFile(
  join(dist, 'THIRD-PARTY-NOTICES.txt'),
  'utf8',
);
assert.equal(bundledLicense, sourceLicense, '生产产物必须保留上游许可声明');

const forbidden = [
  '/config-api',
  '/resource-download/',
  '/dev-api',
  '192.168.5.197',
  'app-res.mc.cn',
  'please-replace-me-with-your-own-key',
  '/@vite/client',
];
const files = [];
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
async function inspect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.toSorted((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await inspect(path);
      continue;
    }
    const name = relative(dist, path).replaceAll('\\', '/');
    assert.ok(!name.endsWith('.map'), `生产产物包含源码映射：${name}`);
    const data = await readFile(path);
    if (/\.(?:css|html|js|mjs)$/.test(name)) {
      const text = data.toString('utf8');
      for (const marker of forbidden) {
        assert.ok(!text.includes(marker), `${name} 包含非生产配置：${marker}`);
      }
    }
    files.push({ path: name, bytes: data.length, sha256: sha256(data) });
  }
}
await inspect(dist);

const html = await readFile(join(dist, 'index.html'), 'utf8');
const robotsMeta = html.match(/<meta\b[^>]*name="robots"[^>]*>/i)?.[0];
assert.ok(
  robotsMeta?.includes('noindex') && robotsMeta.includes('nofollow'),
  '生产入口必须包含禁止收录标记',
);
const robots = await readFile(join(dist, 'robots.txt'), 'utf8');
assert.match(robots, /^User-agent:\s*\*\s*$/im, '缺少全站爬虫规则');
assert.match(robots, /^Disallow:\s*\/\s*$/im, '必须禁止爬取全站');
for (const [, value] of html.matchAll(
  /(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g,
)) {
  if (/^(?:data:|https?:|\/\/)/.test(value)) continue;
  assert.ok(!value.includes('..'), `入口包含越界资源：${value}`);
  await readFile(join(dist, value.replace(/^\/+/, '')));
}

const archive = await readFile(join(app, 'dist.zip'));
const archiveHash = sha256(archive);
const git = (args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  }).trim();
const manifest = {
  application: '管理后台',
  builtAt: new Date().toISOString(),
  frontendOrigin: 'https://qq.i4.cn',
  apiURL,
  sourceCommit: git(['rev-parse', 'HEAD']),
  workingTreeDirty: Boolean(git(['status', '--porcelain'])),
  archive: { file: 'dist.zip', bytes: archive.length, sha256: archiveHash },
  files,
};
await writeFile(
  join(app, 'release-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
await writeFile(join(app, 'dist.zip.sha256'), `${archiveHash}  dist.zip\n`);
console.log(
  `生产产物检查通过：${files.length} 个文件，API ${apiURL}，SHA256 ${archiveHash}`,
);
