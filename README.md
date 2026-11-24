# I4 Admin

基于 [Vue Vben Admin v5.7.0](https://github.com/vbenjs/vue-vben-admin/releases/tag/v5.7.0) 初始化，默认使用 Ant Design Vue 应用（`apps/web-antd`）。保留官方 pnpm workspace 结构和共享组件。

`apps` 目录仅保留实际使用的 `web-antd`；演示路由、静态演示数据和 `backend-mock` 服务源码已移除。

官方文档站、功能演示应用和 Changesets 发布配置已移除，使用文档可访问 [Vben 官方文档](https://doc.vben.pro/)。

项目固定使用简体中文，已移除语言切换、英文资源和 Vue I18n。共享文案位于 `packages/texts/src/messages`，应用文案位于 `apps/web-antd/src/texts/messages`。

## 本地开发

- Node.js：`^22.18.0 || ^24.0.0`
- pnpm：`10.33.4`，由根目录 `packageManager` 固定
- Git：启用 Lefthook 提交钩子需 `>=2.31`；旧版本仍可安装依赖和开发，升级 Git 后运行 `pnpm exec lefthook install` 启用钩子。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

默认访问 <http://localhost:5666>。登录和系统管理已接入真实后端 `http://192.168.0.140:8080`，开发环境通过 `/api` 代理访问，应用构建配置明确禁用 Mock 服务。使用后端分配的管理账号登录。

## 常用命令

| 命令              | 用途                                                  |
| ----------------- | ----------------------------------------------------- |
| `pnpm dev`        | 启动 Ant Design Vue 应用及业务 API 代理               |
| `pnpm check:type` | 检查 Ant Design Vue 应用类型                          |
| `pnpm build`      | 构建 Ant Design Vue 应用，产物在 `apps/web-antd/dist` |
| `pnpm preview`    | 预览已构建的 Ant Design Vue 应用                      |
| `pnpm dev:all`    | 启动保留的前端应用                                    |
| `pnpm build:all`  | 构建全部保留的工作区包                                |

## 项目配置

- `apps/web-antd/src`：页面、路由、接口和应用配置。
- `apps/web-antd/.env`：应用标题和缓存命名空间。
- `apps/web-antd/.env.development`：开发端口、API 前缀和 Mock 开关。
- `apps/web-antd/.env.production`：生产 API 地址和构建选项；`VITE_GLOB_API_URL` 为认证及系统管理 API（默认同源 `/api`），`VITE_CONFIG_API_URL` 为配置管理、客户端壳开关、应用管理和分享包管理业务接口。
- `apps/web-antd/vite.config.ts`：开发 API 代理。
- `packages`：共享组件、布局、权限和工具。

本地环境覆盖可使用 `.env.local` 或 `.env.[mode].local`（已被 Git 忽略）。

## 页面间距规范

全局 Ant Design Vue 样式位于 `packages/styles/src/antd/index.css`：表单和卡片使用组件默认间距，所有尺寸的表格数据行上下内边距各为 `8px`。

筛选卡片统一使用 `<Card class="filter-card" title="筛选条件">`，与下方列表保持 `16px` 间距。筛选表单的 `Row` 使用 `:gutter="16"`，查询和重置按钮独立成行、靠右排列。应用管理在宽屏（`xl`，宽度至少 `1200px`）使用 8 列，时间范围和搜索内容各占 2 列；较窄屏幕自动减少列数。新增业务页面沿用这套间距。

## 认证与系统管理

接口以 [Swagger](http://192.168.0.140:8080/swagger-ui/index.html) 为准，成功码为 `200`，用户、角色、菜单、权限、部门和模块管理位于 `/system/users`、`/system/roles`、`/system/menus`、`/system/permissions`、`/system/departments`、`/system/modules`。用户和角色使用服务端分页，默认每页 `20` 条；其余列表提供本地关键字筛选和分页。

登录使用 `/api/system/auth/login`，密码按原文提交。前端读取公开滑块配置，仅在后端启用时加载阿里云滑块；收到 `MFA_REQUIRED` 后进入六位短信验证码验证，支持限时重发。首次登录或密码重置后若 `passwordResetRequired=true`，跳转 `/auth/change-password`，完成修改后重新登录。个人中心的密码修改同样使用真实接口，新密码须至少 12 个字符且 UTF-8 不超过 72 字节。

登录及刷新通过 `/auth/me`、`/auth/access`、`/auth/menus` 恢复资料、权限和可见菜单。业务菜单的路径、标题、图标、顺序及层级直接取自接口，不维护前端业务路由表或权限码到页面的对照表。`path` 同时作为组件标识，自动从 `src/views` 查找同名 `.vue` 或目录下的 `index.vue`，例如 `/app-info` 对应 `views/app-info/index.vue`；页面标题同步使用接口菜单名称。未找到组件时保留接口菜单并显示 404。退出会清理账号状态、标签页和动态路由；会话失效时重新登录，当前服务没有 refresh-token 接口。

用户资料、启停、密码重置和角色分配分别使用对应接口；角色授权分别保存菜单、功能权限和模块的完整 ID 集合，空集合表示移除全部授权。分配角色或重置密码会撤销目标账号会话。授权选项须具备相应列表读取权限；关联选项加载失败时禁止保存并允许重试。

按钮授权以接口菜单的 `permissionCode` 确定权限分组，按当前接口的「分组:操作」约定匹配 `/auth/access` 实际返回的完整权限码，不固定命名空间和资源别名；管理员标识使用服务端 `superAdmin` 布尔值。缺少菜单权限信息时不猜测授权码。登录日志和操作日志页面也由菜单 `path` 加载，使用真实分页接口，支持登录名、结果和时间范围筛选，默认每页 `20` 条。

生产环境认证请求默认走同源 `/api`，仓库的 `scripts/deploy/nginx.conf` 已添加 `/api/system/` 到 `http://192.168.0.140:8080` 的转发。Docker 部署自动使用该配置，其他 Nginx 部署需同步这条 `location`。直接把认证服务地址写入 `.env.production.local` 时，后端需先允许前端来源的 CORS，以及 `GET`、`POST`、`PUT`、`PATCH`、`DELETE`、`Authorization`、`Content-Type` 和对应预检；当前对原部署来源的预检会返回 `403`。

界面仅保留真实业务、登录改密和个人资料页面。仪表盘、工作台、组件演示、项目介绍、示例通知和未接入接口的个人设置已移除；首页跳转接口提供的首个可见菜单，没有菜单时显示无权限页面。刷新登录状态时会清理已删除或无权访问的旧标签。

## 配置管理

菜单「配置管理」（`/config-info`）支持分页查询、查看详情、新增和编辑配置，接口字段参考根目录 `配置管理文档.txt`。

配置接口成功码为 `200`，地址由构建环境变量 `VITE_CONFIG_API_URL` 指定。开发模式使用 `/config-api` 前缀，由 `apps/web-antd/vite.config.ts` 代理到 `http://192.168.5.197:8080`，需能访问该内网地址；登录等现有接口仍使用 `/api`。

生产构建默认直接访问 `http://192.168.5.197:8080`，例如列表请求为 `http://192.168.5.197:8080/configinfo/list`，不经过前端部署服务器，也不带 `/config-api` 前缀。若需更换地址，可在 `.env.production.local` 中覆盖 `VITE_CONFIG_API_URL` 后重新构建。时间字段由服务端维护，页面只读展示。

直连接口时，后端需通过 CORS 允许前端部署来源（当前为 `http://192.168.5.210:10106`），并允许 `GET`、`POST` 请求以及 `Authorization`、`Content-Type` 请求头的 `OPTIONS` 预检。

## 客户端壳开关

菜单「客户端壳开关」（`/client-switch`）支持分页查询、详情、新增、编辑和二次确认删除，接口参考 `客户端壳开关文档.txt`，复用 `VITE_CONFIG_API_URL` 服务地址和成功码 `200`。

`switchType` 表示壳开关（`0` 关闭、`1` 开启），`status` 表示记录状态（`1` 正常、`0` 已删除）。已删除记录只能查看详情。新增时填写版本号、壳开关和创建人；保存时按文档传入时间字符串，编辑保留原创建时间并更新修改时间。

配置管理和客户端壳开关路由均启用 `meta.keepAlive`，切换已打开的标签时保留分页及页面状态，不重复加载列表。主动刷新标签或关闭后重新打开时会清理组件缓存。后续新增需要保留状态的业务页面，也应在路由中启用 `meta.keepAlive`。

## 应用管理

菜单「应用管理」（`/app-info`）支持分类联动、分页查询和编辑，接口参考 `应用管理文档.txt`，复用 `VITE_CONFIG_API_URL` 服务地址和成功码 `200`。路由启用 `meta.keepAlive`，切换标签保留筛选条件和分页状态。

列表默认每页请求 `20` 条，支持文档中的全部筛选字段，价格类型可多选，时间以 `YYYY-MM-DD HH:mm:ss` 字符串提交。点击「查询」或「重置」回到第一页；分页及刷新沿用上次查询条件。软件和游戏分类分别从 `/appType/typeList` 加载，切换类型会清空所选分类。

编辑通过 `/appInfo/details/{id}` 读取详情，只向 `/appInfo/update` 提交 `id`、`sort`、`type`、`peculiarPopId`、`remdAppstoreIns` 五个字段。特殊应用弹窗暂按数字 ID 填写；App Store 安装设置支持不推荐、推荐和禁止。加载失败可重试，保存失败保留表单。

## 分享包管理

菜单「分享包管理」（`/share-app-info`）接入 `分享包管理文档.txt` 中的列表查询及隐藏/显示接口，复用 `VITE_CONFIG_API_URL` 和成功码 `200`。默认每页 `20` 条，支持应用分类、软件类型、运行平台、状态和四种搜索类型，筛选值按文档提交数字，全部为 `-1`。

筛选区沿用默认间距、宽屏 8 列网格，查询和重置按钮独立成行。应用分类切换时清空软件类型，分页沿用已查询条件；路由启用 `meta.keepAlive`，切换标签保留页面状态。

隐藏/显示操作需确认，使用分享包主键 `id`（不是 `appId`），分别提交操作类型 `1` 和 `3`。有效记录可隐藏，无效或已隐藏记录可显示；成功后刷新当前页，当前页清空时返回有效页码。IPA 和安装配置地址按接口原值展示。

[官方文档](https://doc.vben.pro/) · [官方中文说明](./README.zh-CN.md) · [MIT 许可证](./LICENSE)

---

<div align="center">
  <a href="https://github.com/anncwb/vue-vben-admin">
    <img alt="VbenAdmin Logo" width="215" src="https://unpkg.com/@vbenjs/static-source@0.1.7/source/logo-v1.webp">
  </a>
  <br>
  <br>

[![license](https://img.shields.io/github/license/anncwb/vue-vben-admin.svg)](LICENSE)

  <h1>Vue Vben Admin</h1>
</div>

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=vbenjs_vue-vben-admin&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=vbenjs_vue-vben-admin) [![codeql](https://github.com/vbenjs/vue-vben-admin/actions/workflows/codeql.yml/badge.svg)](https://github.com/vbenjs/vue-vben-admin/actions/workflows/codeql.yml) [![build](https://github.com/vbenjs/vue-vben-admin/actions/workflows/build.yml/badge.svg)](https://github.com/vbenjs/vue-vben-admin/actions/workflows/build.yml) [![ci](https://github.com/vbenjs/vue-vben-admin/actions/workflows/ci.yml/badge.svg)](https://github.com/vbenjs/vue-vben-admin/actions/workflows/ci.yml) [![deploy](https://github.com/vbenjs/vue-vben-admin/actions/workflows/deploy.yml/badge.svg)](https://github.com/vbenjs/vue-vben-admin/actions/workflows/deploy.yml)

**English** | [中文](./README.zh-CN.md) | [日本語](./README.ja-JP.md)

## Introduction

Vue Vben Admin is a free and open source middle and back-end template. Using the latest `vue3`, `vite`, `TypeScript` and other mainstream technology development, the out-of-the-box middle and back-end front-end solutions can also be used for learning reference.

## Upgrade Notice

This is the latest version, 5.0, and it is not compatible with previous versions. If you are starting a new project, it is recommended to use the latest version. If you wish to view the old version, please use the [v2 branch](https://github.com/vbenjs/vue-vben-admin/tree/v2).

## Features

- **Latest Technology Stack**: Developed with cutting-edge front-end technologies like Vue 3 and Vite
- **TypeScript**: A language for application-scale JavaScript
- **Themes**: Multiple theme colors available with customizable options
- **Permissions**: Built-in solution for dynamic route-based permission generation

## Preview

- [Vben Admin](https://vben.pro/) - Full version Chinese site

Test Account: vben/123456

<div align="center">
  <img alt="VbenAdmin Logo" width="100%" src="https://anncwb.github.io/anncwb/images/preview1.png">
  <img alt="VbenAdmin Logo" width="100%" src="https://anncwb.github.io/anncwb/images/preview2.png">
  <img alt="VbenAdmin Logo" width="100%" src="https://anncwb.github.io/anncwb/images/preview3.png">
</div>

### Use Gitpod

Open the project in Gitpod (free online dev environment for GitHub) and start coding immediately.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/vbenjs/vue-vben-admin)

## Documentation

[Document](https://doc.vben.pro/)

## Install and Use

1. Get the project code

```bash
git clone https://github.com/vbenjs/vue-vben-admin.git
```

2. Install dependencies

```bash
cd vue-vben-admin
npm i -g corepack
pnpm install
```

3. Run

```bash
pnpm dev
```

4. Build

```bash
pnpm build
```

## Change Log

[CHANGELOG](https://github.com/vbenjs/vue-vben-admin/releases)

## How to Contribute

You are very welcome to join! [Raise an issue](https://github.com/anncwb/vue-vben-admin/issues/new/choose) or submit a Pull Request.

**Pull Request Process:**

1. Fork the code
2. Create your branch: `git checkout -b feat/xxxx`
3. Submit your changes: `git commit -am 'feat(function): add xxxxx'`
4. Push your branch: `git push origin feat/xxxx`
5. Submit `pull request`

## Git Contribution Submission Specification

Reference [vue](https://github.com/vuejs/vue/blob/dev/.github/COMMIT_CONVENTION.md) specification ([Angular](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-angular))

- `feat` Add new features
- `fix` Fix the problem/BUG
- `style` The code style is related and does not affect the running result
- `perf` Optimization/performance improvement
- `refactor` Refactor
- `revert` Undo edit
- `test` Test related
- `docs` Documentation/notes
- `chore` Dependency update/scaffolding configuration modification etc.
- `ci` Continuous integration
- `types` Type definition file changes

## Browser Support

The `Chrome 80+` browser is recommended for local development

Support modern browsers, not IE

| [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/edge/edge_48x48.png" alt="Edge" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Edge | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png" alt="Firefox" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Firefox | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png" alt="Chrome" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Chrome | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/safari/safari_48x48.png" alt="Safari" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Safari |
| :-: | :-: | :-: | :-: |
| last 2 versions | last 2 versions | last 2 versions | last 2 versions |

## Maintainer

[@Vben](https://github.com/anncwb)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=vbenjs/vue-vben-admin&type=Date)](https://star-history.com/#vbenjs/vue-vben-admin&Date)

## Donate

If you think this project is helpful to you, you can help the author buy a cup of coffee to show your support!

![donate](https://unpkg.com/@vbenjs/static-source@0.1.7/source/sponsor.png)

<a style="display: block;width: 100px;height: 50px;line-height: 50px; color: #fff;text-align: center; background: #408aee;border-radius: 4px;" href="https://www.paypal.com/paypalme/cvvben">Paypal Me</a>

## Contributors

<a href="https://openomy.app/github/vbenjs/vue-vben-admin" target="_blank" style="display: block; width: 100%;" align="center">
  <img src="https://openomy.app/svg?repo=vbenjs/vue-vben-admin&chart=bubble&latestMonth=3" target="_blank" alt="Contribution Leaderboard" style="display: block; width: 100%;" />
 </a>

<a href="https://github.com/vbenjs/vue-vben-admin/graphs/contributors">
  <img alt="Contributors" src="https://contrib.rocks/image?repo=vbenjs/vue-vben-admin" />
</a>

## Discord

- [Github Discussions](https://github.com/anncwb/vue-vben-admin/discussions)

## License

[MIT © Vben-2020](./LICENSE)
