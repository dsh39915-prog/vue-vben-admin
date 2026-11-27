# I4 Admin 上线说明

正式前端和接口均为 `https://qq.i4.cn`。浏览器直接请求该域名：系统接口使用 `/api/system/...`，业务接口使用 `/appInfo/...`、`/shareappinfolist/...` 等真实路径。无需增加接口前缀或前端 API 转发规则。

## 构建与交付

使用仓库指定的 Node.js 和 pnpm 版本：

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm check:type
pnpm exec vitest run apps/web-antd/src packages/@core/preferences/__tests__ packages/@core/base/icons/src/__tests__ packages/@core/base/shared/src/cache/__tests__ packages/effects/layouts/src/widgets/lock-screen/clock.test.ts --maxWorkers=2 --testTimeout=20000
pnpm exec vitest run scripts/deploy/verify-archive.test.mjs --environment=node --maxWorkers=1
pnpm build:release
```

交付文件位于 `apps/web-antd`：`dist.zip` 为静态站点包，`dist.zip.sha256` 用于传输后校验，`release-manifest.json` 记录源码提交、工作区是否有未提交改动、接口地址和文件哈希。生产检查会拒绝旧代理前缀、开发服务地址、默认缓存编码占位符、源码映射和入口引用缺失，并核对 ZIP 中的文件列表、大小、SHA256 与 `dist` 完全一致。损坏、混入旧文件或与当前目录内容不一致的压缩包不能发布。

发布应以已提交的源码为准，构建后核对清单中的提交号和 `workingTreeDirty`。不要在记录校验和后继续修改构建目录；如修改 `_app.config.js`，必须重新打包并生成清单。

## 同域部署

将 `dist` 内的文件部署到正式域名的静态目录，保持已有 API 路由和后端服务可用。不要用纯静态站点的 SPA 兜底规则覆盖 `/api/system/...` 或业务接口，否则接口请求可能收到 HTML。

`scripts/deploy/nginx.conf` 和 Docker 镜像仅提供静态站点服务，适合放在现有站点入口之后；它们不负责转发 API。采用其他静态托管方式也可以，不依赖这份 Nginx 配置。若部署使用现有业务服务的静态目录，按该服务的静态资源配置放置文件。

带哈希的 JS/CSS 可以长期缓存；`index.html`、`_app.config.js` 必须及时更新。上传时先放置新资源，最后切换入口文件，保留上一版本的哈希资源供已打开的页面使用。不要在上传新包前清空整个站点目录。

下载直接拼接：IPA 为 `https://d-app6.i4.cn/soft/` + `path`，安装配置为 `https://dl.i4.cn/sslplist/` + `plist`。不配置下载代理。

公网后台的防收录与入口限流配置见 [防爬与防刷说明](ANTI-BOT.md)。采用随附 Nginx 配置时，需一并部署 `anti-bot-*.conf`；使用现有网关时按说明在原有 API 处理入口引入规则。

## 上线验收

1. 正式域名 HTTPS 证书正常，`GET /api/system/auth/captcha` 返回 JSON 和业务码 `200`，不能返回静态入口 HTML。
2. 使用正式账号手动完成登录及服务端要求的验证码、短信步骤；阿里云场景应允许正式前端域名。不要使用模拟验证码或关闭后端验证来验收。
3. 核对顶部模块、左侧菜单和按钮权限；刷新已授权页面不应误跳无权限页，退出后无法继续使用旧会话。
4. 验证应用列表、推荐、分享包及专题列表的真实数据、筛选和分页；写操作使用专门的测试记录。
5. 在分享包列表中各选一个有效 IPA 和安装配置链接手动验证下载。目录根路径的 `403/404` 不能替代具体文件验证。
6. 更换主题后刷新，确认主题保留；检查控制台无资源解析错误或未捕获异常。

## 回滚

发布前备份当前入口文件、运行时配置和旧静态资源包。出现问题时恢复上一版本入口及 `_app.config.js`，保留它引用的哈希资源，刷新验证登录和接口路径。前端回滚不执行数据库变更，不改变菜单和权限数据。

可选镜像构建：`pnpm build:docker -- i4-admin:<版本号>`。构建脚本只创建新镜像，不停止、删除现有容器或历史镜像；容器切换与回滚按实际部署平台执行。
