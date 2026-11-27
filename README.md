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

默认访问 <http://localhost:5666>。本地开发通过 Vite 的 `/dev-api` 代理访问真实后端 `http://192.168.5.197:8080`，避免内网服务拒绝跨域请求。生产环境直接请求 `https://qq.i4.cn`，应用构建配置明确禁用 Mock 服务。使用后端分配的管理账号登录。

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
- `apps/web-antd/.env.production`：生产接口服务地址和构建选项；`VITE_GLOB_API_URL=https://qq.i4.cn`，认证、系统管理和业务接口共用该地址。
- `apps/web-antd/vite.config.ts`：开发 API 代理。
- `packages`：共享组件、布局、权限和工具。

本地环境覆盖可使用 `.env.local` 或 `.env.[mode].local`（已被 Git 忽略）。

## 页面间距规范

全局 Ant Design Vue 样式位于 `packages/styles/src/antd/index.css`：表单和卡片使用组件默认间距，所有尺寸的表格数据行上下内边距各为 `8px`。

筛选卡片统一使用 `<Card class="filter-card" title="筛选条件">`，与下方列表保持 `16px` 间距。筛选表单的 `Row` 使用 `:gutter="16"`，查询和重置按钮独立成行、靠右排列。应用管理在宽屏（`xl`，宽度至少 `1200px`）使用 8 列，时间范围和搜索内容各占 2 列；较窄屏幕自动减少列数。新增业务页面沿用这套间距。

## 认证与系统管理

接口以 [Swagger](http://192.168.5.197:8080/swagger-ui/index.html) 为准，成功码为 `200`，用户、角色、菜单、权限、部门和模块管理位于 `/system/users`、`/system/roles`、`/system/menus`、`/system/permissions`、`/system/departments`、`/system/modules`。用户和角色使用服务端分页，默认每页 `20` 条；其余列表提供本地关键字筛选和分页。

登录使用 `/api/system/auth/login`，密码按原文提交。前端读取公开滑块配置，仅在后端启用时加载阿里云滑块；收到 `MFA_REQUIRED` 后进入六位短信验证码验证，支持限时重发。首次登录或密码重置后若 `passwordResetRequired=true`，跳转 `/auth/change-password`，完成修改后重新登录。个人中心的密码修改同样使用真实接口，新密码须至少 12 个字符且 UTF-8 不超过 72 字节。

滑块按阿里云 V2 客户端标准使用嵌入式模式：动态加载官方 SDK 前先设置接口提供的身份标及区域配置，使用 SDK 的 `refresh`/`destroyCaptcha` 管理重试和销毁。登录按钮在表单校验通过后触发 SDK 业务回调，将 `captchaVerifyParam` 和账号密码一起提交真实登录接口；只有后端接受登录或返回短信挑战时才向 SDK 返回成功，失败返回失败结果，不在前端伪造验证通过。

登录及刷新通过 `/auth/me`、`/auth/access`、`/auth/menus` 恢复资料、权限和可见菜单。业务菜单的路径、标题、图标、顺序及层级直接取自接口，不维护前端业务路由表或权限码到页面的对照表。`path` 同时作为组件标识，自动从 `src/views` 查找同名 `.vue` 或目录下的 `index.vue`，例如 `/app-info` 对应 `views/app-info/index.vue`；页面标题同步使用接口菜单名称。未找到组件时保留接口菜单并显示 404。退出会清理账号状态、标签页和动态路由；会话失效时重新登录，当前服务没有 refresh-token 接口。

登录、令牌恢复和路由守卫共享同一权限初始化任务，等待用户资料、菜单和动态路由全部就绪后才跳转，慢接口不会提前显示无权限页。历史回跳地址为 `/access-empty` 或菜单已不存在时使用接口首页；权限已经初始化后访问临时无权限地址也会回到可用首页，只有接口确实没有可见菜单时保留无权限页。仍有权限的回跳页面及其查询参数、锚点会被保留。

用户资料、启停、密码重置和角色分配分别使用对应接口；角色授权分别保存菜单、功能权限和模块的完整 ID 集合，空集合表示移除全部授权。分配角色或重置密码会撤销目标账号会话。授权选项须具备相应列表读取权限；关联选项加载失败时禁止保存并允许重试。

按钮授权以接口菜单的 `permissionCode` 确定权限分组，按当前接口的「分组:操作」约定匹配 `/auth/access` 实际返回的完整权限码，不固定命名空间和资源别名；管理员标识使用服务端 `superAdmin` 布尔值。缺少菜单权限信息时不猜测授权码。登录日志和操作日志页面也由菜单 `path` 加载，使用真实分页接口，支持登录名、结果和时间范围筛选，默认每页 `20` 条。

菜单管理使用 `GET /api/system/menus/tree` 的菜单与权限组合树，直接按真实后端路径请求。表格和展开状态使用接口的跨表唯一 `key`，组合层级依据 `parentKey`，按统一字段 `type`、`permissionCode` 展示节点，保留来源表的 `id`、`parentId` 和 `menuId`。默认展开一级，支持逐项展开/收起及展开全部/收起全部，不分页拆分树。模块筛选项来自模块接口，搜索权限或子菜单时保留祖先路径，刷新保留手动展开状态。

表格区分菜单和权限来源；详情、编辑、删除依据 `nodeType` 使用对应资源接口和授权，避免菜单与权限同 ID 时串用。新增子菜单自动关联父菜单与模块，菜单下新增权限时带入 `menuId` 和模块，权限标识及类型分别按权限接口的 `code`、`permissionType` 保存。菜单关联选项仍从菜单列表读取，不把组合树的权限节点当作菜单 ID。

模块筛选不提供「全部」，加载完成后默认选中第一个模块，查询和重置保留当前模块。切换模块时只展示两级菜单，深层权限可手动展开，也可使用「展开全部」；搜索会展开匹配节点的路径。「新增主菜单」位于列表工具栏「展开全部」左侧，固定提交 `parentId=null`，所属模块取自当前选中的模块。列表内「新增子菜单」固定使用点击行的菜单 ID 和模块；在菜单下新增权限也继承点击行的模块。新增弹窗隐藏对应的上级菜单和所属模块选择项，提交时使用打开弹窗时固定的关联值。

角色授权弹窗使用模块按钮和菜单/权限勾选树，数据来自模块接口及 `/system/menus/tree`，切换模块保留全部选择。勾选父节点时批量选择下级，半选表示部分授权；回显严格按原授权集合展示，不因父菜单已授权而自动授予子权限。模块访问通过「允许访问当前模块」单独配置，保存仍分别提交 `menuIds`、`permissionIds`、`moduleIds` 的完整集合。跨模块祖先只作层级提示，编辑当前模块不清除其他模块或未展示的原有授权；选项加载失败或缺少读取权限时禁止保存，支持重试。

页面顶部提供模块导航，模块名称及排序取自模块接口，按授权菜单的 `moduleId` 分组，仅展示有可见菜单的启用模块。点击模块只切换左侧菜单，保留当前页面和标签；访问页面、切换标签或刷新时自动选中对应模块。分组只影响导航展示，不改写授权菜单和业务路由。布局使用顶部与左侧组合导航，保留已有主题偏好；模块信息加载失败可以重试，缺少模块管理读取权限时按接口模块 ID 展示分组，未分配归属的菜单单独归组。

接口服务地址统一由 `VITE_GLOB_API_URL` 配置。生产环境浏览器直接请求 `https://qq.i4.cn`，系统接口使用 `/api/system/...`，业务接口使用根路径，例如 `/appInfo/list`；部署无需 Nginx 接口转发规则。生产构建将服务地址写入 `dist/_app.config.js`，修改该配置即可同时切换两类接口。前后端不同源部署时，后端需允许前端来源及 `Authorization`、`Content-Type` 请求头的跨域预检。本地开发使用 `/dev-api`，Vite 仅剥离该开发前缀，后端路径保持原样。

会话失效处理会核对请求令牌，旧请求迟到的 `401` 不会撤销新登录；系统与业务客户端同时失效时只退出一次。菜单、模块、权限及角色授权变更后重新获取当前用户的资料、授权和菜单，替换动态路由、更新模块导航并清理失效标签。当前页面失去访问权时跳转新的首个可用菜单。保存成功但授权刷新失败时提供独立的「重新加载」入口，阻止沿用旧权限操作，重试不会重复提交保存请求。

系统管理拆分为列表/菜单树容器 `resource-page.vue`、编辑/用户角色/授权弹窗 `resource-editor.vue`、字段渲染组件 `resource-fields.vue` 和关联选项 composable。列表行从已有接口类型派生，动态表单明确约束允许的数据类型，不再用 `any` 绕过检查。

## 列表状态与分类缓存

`usePagedList` 统一应用、推荐、分享包、配置、壳开关、专题及候选列表的分页、请求时序、失败重试和选择清理。记录数组使用 `shallowRef`；过期响应不能覆盖新查询，页码超过最新末页时自动回退。排序和筛选仍按各接口字段传递，刷新或写入后重新加载不会清空已提交条件。

应用、分享包与应用列表专题的分类选项通过 `useAppCategories` 加载，合并同类并发请求，缓存有效期为 5 分钟。缓存页面再次激活时检查过期，页面刷新按钮可强制刷新分类；分类管理修改后主动通知所有已打开页面失效并重新加载，失败允许重试。

## 部署与自动检查

上线构建使用 `pnpm build:release`，生成静态包、SHA256 校验和与发布清单。正式域名、同域 API 部署、验收和回滚步骤见 [上线说明](scripts/deploy/RELEASE.md)。

本轮检查结果、已完成项和未解决事项见 [上线前检查记录](scripts/deploy/RELEASE-CHECK.md)。

CI 对当前仓库所有分支的推送、PR 和手动触发生效，分别执行 Lint/类型检查、前端测试和生产构建；任一步失败或取消，汇总检查都不能通过。

部署配置启用 gzip，带内容哈希的 JS/CSS 使用一年不可变缓存；`index.html` 和 `_app.config.js` 禁止存储，缺失构建资源返回 404，避免返回 HTML 造成脚本解析错误。需要部署新版 `scripts/deploy/nginx.conf` 才能生效。

分享包下载使用浏览器直连：IPA 使用 `https://d-app6.i4.cn/soft/` 拼接接口 `path`，安装配置使用 `https://dl.i4.cn/sslplist/` 拼接接口 `plist`，无需 Vite/Nginx 下载代理。链接保留“点击下载”文案，前端不将 IPA 全量加载为 Blob，避免大文件占用浏览器内存。

界面仅保留真实业务、登录改密和个人资料页面。仪表盘、工作台、组件演示、项目介绍、示例通知和未接入接口的个人设置已移除；首页跳转接口提供的首个可见菜单，没有菜单时显示无权限页面。刷新登录状态时会清理已删除或无权访问的旧标签。

## 刷新移动端缓存

推荐管理（含 217IPUA）、应用分类管理、装机必备、应用列表专题、配置管理和客户端壳开关提供独立的「刷新缓存」按钮，通过业务客户端调用 `GET /mobileCache/reload/{type}`。刷新列表与刷新服务端缓存分别操作，刷新缓存期间禁止重复提交，成功后提示当前缓存名称，失败可重试。

推荐页按当前筛选刷新：首页精选 `20`；应用推荐、排行、最新分别为 `21`、`22`、`25`；游戏推荐、排行、最新分别为 `27`、`28`、`31`。普通与 217IPUA 页面采用同一套类型，接口只传路径中的 `type`。其余页面分别使用应用分类 `6`、装机必备 `72`、应用列表专题 `83`、配置管理 `2`、客户端壳开关 `401`。

## 配置管理

菜单「配置管理」（`/config-info`）支持分页查询、查看详情、新增和编辑配置，接口字段参考根目录 `配置管理文档.txt`。

配置接口成功码为 `200`，与认证、系统管理共用 `VITE_GLOB_API_URL` 配置的服务地址。生产环境直接请求正式接口域名 `https://qq.i4.cn`，本地开发通过 Vite 代理访问 `http://192.168.5.197:8080`。

例如生产配置列表直接请求 `https://qq.i4.cn/configinfo/list`。更换正式服务地址时修改环境配置或构建后的 `_app.config.js`，无需修改 Nginx 接口规则。时间字段由服务端维护，页面只读展示。

## 客户端壳开关

菜单「客户端壳开关」（`/client-switch`）支持分页查询、详情、新增、编辑和二次确认删除，接口参考 `客户端壳开关文档.txt`，复用 `VITE_GLOB_API_URL` 服务地址和成功码 `200`。

`switchType` 表示壳开关（`0` 关闭、`1` 开启），`status` 表示记录状态（`1` 正常、`0` 已删除）。已删除记录只能查看详情。新增时填写版本号、壳开关和创建人；保存时按文档传入时间字符串，编辑保留原创建时间并更新修改时间。

配置管理和客户端壳开关路由均启用 `meta.keepAlive`，切换已打开的标签时保留分页及页面状态，不重复加载列表。主动刷新标签或关闭后重新打开时会清理组件缓存。后续新增需要保留状态的业务页面，也应在路由中启用 `meta.keepAlive`。

## 应用管理

菜单「应用管理」（`/app-info`）支持分类联动、分页查询和编辑，接口参考 `应用管理文档.txt`，复用 `VITE_GLOB_API_URL` 服务地址和成功码 `200`。路由启用 `meta.keepAlive`，切换标签保留筛选条件和分页状态。

列表默认每页请求 `20` 条，支持文档中的全部筛选字段，价格类型可多选，时间以 `YYYY-MM-DD HH:mm:ss` 字符串提交。点击「查询」或「重置」回到第一页；分页及刷新沿用上次查询条件。软件和游戏分类分别从 `/appType/typeList` 加载，切换类型会清空所选分类。

价格和下载统计表头支持服务端排序，分别传 `sort=appStorePrice`、`sort=downloadCount`，方向通过 `order=asc/desc` 提交，软件类型筛选仍使用 `sort1`。切换排序回到第一页；分页、查询、刷新和编辑后重载保留排序，取消排序或重置筛选时恢复默认顺序。

编辑通过 `/appInfo/details/{id}` 读取详情，只向 `/appInfo/update` 提交 `id`、`sort`、`type`、`peculiarPopId`、`remdAppstoreIns` 五个字段。特殊应用弹窗使用可搜索下拉框，每次打开编辑窗口时分页加载全部特殊应用提示，显示标题和 ID，无效记录注明状态；“无”提交 `0`，已有但列表未返回的关联保留 ID 回显。提示选项加载失败可重试，加载期间或失败时禁用保存。App Store 安装设置支持不推荐、推荐和禁止，保存失败保留表单。

应用列表的「推荐」操作通过 `POST /appInfo/addAppRemd` 添加当前应用到推荐列表，推荐版本、iPhone/iPad 平台和 4 个推荐栏目均使用平铺按钮组，栏目为首页精选（`1`）、应用/游戏推荐（`3`）、应用/游戏排行（`5`）、应用/游戏最新（`42`）。软件/游戏类型自动从当前记录识别，只读展示；类型缺失时获取应用详情，识别失败可重试。弹窗不提供应用分类，也不加载分类数据，固定提交 `type=0`。默认普通推荐、首页精选栏目，平台从当前记录带入，双平台应用默认 iPhone，未知平台须选择。提交仅包含 `id`、`column`、`platform`、`sort`、`type`、`iosVersion`，均按数字发送，`data=null` 视为成功；失败保留选择，成功后刷新当前页并保留筛选、排序，防止重复提交。

## 应用分类管理

应用分类管理接入根目录 `应用分类管理文档.txt`，页面组件为 `views/app-type/index.vue`，后台菜单 `path` 为 `/app-type`。通过配置的服务地址调用真实接口，默认每页 `20` 条，支持应用类型、分类名称和有效/无效状态筛选；查询和重置按钮独立成行，分页使用已提交的筛选条件。

列表使用 `POST /appType/getAppType`，`sort1` 和 `status` 按文档传字符串，排序字段固定为 `Sort`，应用类型表头支持 `asc/desc` 服务端排序。页面展示分类名称、新名称、iPhone/iPad 图标及应用数量、说明、状态和排序号，新分类图标文件名按原值展示。修改排序使用 `POST /appType/modifyAppTypeOrderNum`，仅提交当前记录的 `id`、`sort`、`oldOrder` 及用户输入的 `newOrder`；保存失败保留输入以便重试，未提供新增、删除或其他未定义的修改操作。

## 应用列表专题

「应用管理」下的「应用列表专题」由后台菜单 `path=/app-topic` 加载，接入根目录 `应用列表专题文档.txt` 中的 `/adAppspecial` 接口。专题及其应用默认每页 `20` 条，支持状态、名称显示、推荐类型、平台和名称筛选；推荐类型 `3` 为游戏推荐。专题可新增、编辑、单条/批量删除，保存仅提交文档中的可写字段，日期采用 `YYYY-MM-DD`，下线日期不得早于上线日期；状态按列表接口展示。

「管理应用」使用左右两栏，左侧分页查看当前专题应用，可修改专题内名称与排序、单条/批量移除；右侧直接单条/批量添加候选应用，无需另开添加弹窗。候选筛选区放在两栏上方，左右面板有独立边框、工具栏和分页，宽表只在各自面板内横向滚动；两侧表格按当前页数据自然展开，不设置固定高度或表格内部竖向滚动；每页 20 条完整展示，保持表头对齐。两栏独立分页，添加成功刷新左侧，移除成功刷新右侧的添加状态并保留筛选条件；写入期间阻止两侧同时操作。候选支持软件/游戏、分类、平台和应用 ID/名称查询，此处搜索类型 `1` 为应用 ID、`2` 为应用名称，`sort` 传字符串，所有候选请求携带当前专题 `sid`，已添加记录禁止重复选择。添加传应用 `appId` 数组，移除传专题内关联记录 `id` 数组，删除专题传专题 `id` 数组；翻页或查询清空选择，末页清空时自动回退，失败保留输入或选择。候选应用沿用统一的下载统计和版本号单行显示。

候选表格的下载统计和价格支持服务端升降序排序，分别传 `sort1=downloadCount`、`sort1=appStorePrice`，方向使用 `order=asc/desc`；软件/游戏筛选仍由 `sort` 传递。切换排序回到第一页并清空选择，分页、查询、刷新和增删后的联动刷新保留排序；取消排序、重置、切换专题或重新打开管理窗口时恢复默认顺序。

## 一级专题

菜单「一级专题」通过后台菜单 `path=/app-special` 加载页面，依据根目录 `一级专题文档.txt` 接入 `/appSpecialList` 接口，不新增静态菜单或业务路由。专题应用和候选应用默认每页 `20` 条。主列表支持分页、单条/批量移除及修改排序，`0` 表示未排序；移除需确认，使用专题记录的 `id`，末页清空时自动回退。

页面采用左右结构，左侧展示当前专题应用并支持排序、移除，右侧直接单条或批量添加应用；筛选区位于两侧列表上方，表头对齐，分别分页，每页数据自然展开，仅提供表格内横向滚动。右侧候选应用使用 `/appSpecialList/getAllAppOrGameListPage` 分页查询，分类选项固定以 `{ sort: 0 }` 请求 `/appType/typeList`，按接口返回展示。支持分类、应用名称/应用 ID 和多选价格类型筛选，`isFree` 未选择时传 `-1`，多选时用逗号分隔；查询和重置独立成行，翻页沿用已提交条件。添加使用应用的 `appId`，已添加或标记不明确的记录禁止重复添加；单条/批量添加成功后同步刷新专题列表与候选列表。所有批量 ID 用逗号分隔，翻页或查询时清空选择。排序使用 `POST /appSpecialList/updateSpecialAppOrGameOrder`，只提交专题记录 `id` 和非负整数 `order`。失败保留输入或选择，便于重试；列表加载失败时禁止对旧数据写入。

候选列表支持服务端升降序排序：下载统计 `downloadCount`、价格 `price`、分类 `category`、渠道 ID `channelId`、应用 ID `appId`、应用主表 ID `mainId`，方向为 `order=asc/desc`。切换排序回到第一页并清空选择；分页、查询、刷新及添加/移除后的联动刷新保留排序，取消排序或重置时恢复默认顺序。

## 特殊应用提示

菜单「特殊应用提示」通过后台菜单 `path=/peculiar-app-msg` 自动加载 `views/peculiar-app-msg/index.vue`，接口依据根目录 `特殊应用提示文档.txt`，使用统一配置的服务地址。默认每页 `20` 条，支持全部/有效/无效状态筛选，查询与重置独立成行，分页和刷新沿用已提交的筛选条件。

列表使用 `POST /peculiarAppMsg/findPeculiarAppMsgByParam`，展示标题、详情、弹窗类型、状态和创建/更新时间。新增与修改共用 `POST /peculiarAppMsg/addOrModifyPeculiarAppMsg`，新增不传 `id`，编辑先通过 `GET /peculiarAppMsg/getPeculiarAppMsgById/{id}` 读取最新详情；支持四种弹窗类型，保留详情原始内容，详情窗口只读，加载或保存失败可重试。逐条删除需确认，按文档调用 `GET /peculiarAppMsg/removePeculiarAppMsg/{id}` 逻辑删除；删除后刷新，末页清空时自动回退到有效页码。

## 推荐管理

推荐管理及推荐管理（217IPUA）共用根目录 `推荐管理、推荐管理（217IPUA）.txt` 中的三个接口，通过配置的服务地址访问，默认每页 `50` 条。页面组件分别位于 `views/recommendation/index.vue` 和 `views/recommendation-ipua/index.vue`，由后台菜单的 `path`（分别为 `/recommendation`、`/recommendation-ipua`）加载，前端不新增静态菜单或业务路由。

两个页面分别固定 `iosVersion=-1` 和 `1`，筛选按「运行平台 → 首页精选/应用推荐/游戏推荐 → 推荐栏目」联动。首页精选隐藏第三级，固定 `column=1、sort=1`；应用推荐使用 `sort=1`，游戏推荐使用 `sort=2`，其推荐、排行、最新分别使用 `column=2、42、4`。不提供分类栏目或应用分类筛选，不请求分类列表，查询与空位操作统一传 `type=0`，平台传字符串。切换上级会重置下级，默认选择 iPhoneOS 和首页精选。点击筛选按钮立即请求第一页，不提供查询/重置按钮；快速连续切换时只展示最后一次请求的结果。

查询使用 `/appInfo/getRemdList`；添加/删除空位使用 `/appInfo/addOrDelNoneRemdNum`，提交当前条件和指定位置；调整推荐位置及取消推荐使用 `/appInfo/updateAppRemd`，两者的 `type` 均使用当前筛选的 `column` 值，取消推荐时 `order=0`。分页沿用当前筛选条件，加载期间禁用分页和写入，写入操作捕获打开时的条件。写入需要明确保存或确认，失败保留输入以便重试。

## 分享包管理

菜单「分享包管理」（`/share-app-info`）接入 `分享包管理文档.txt` 中的列表查询及隐藏/显示接口，复用 `VITE_GLOB_API_URL` 和成功码 `200`。默认每页 `20` 条，支持应用分类、软件类型、运行平台、状态和四种搜索类型，筛选值按文档提交数字，全部为 `-1`。

列表展示分享包 ID、应用 ID，以及接口返回的 iTunes 应用 ID（`itemId`）和应用包 ID（`sourceId`）；iTunes ID 不换行，较长的包 ID 省略显示并可悬停查看，空值显示 `—`。

筛选区沿用默认间距、宽屏 8 列网格，查询和重置按钮独立成行。应用分类切换时清空软件类型，分页沿用已查询条件；路由启用 `meta.keepAlive`，切换标签保留页面状态。

隐藏/显示操作需确认，使用分享包主键 `id`（不是 `appId`），分别提交操作类型 `1` 和 `3`。有效记录可隐藏，无效或已隐藏记录可显示；成功后刷新当前页，当前页清空时返回有效页码。IPA 和安装配置地址均显示为“点击下载”直连链接，分别使用 `https://d-app6.i4.cn/soft/` 拼接接口的 `path`、`https://dl.i4.cn/sslplist/` 拼接接口的 `plist`；地址为空时显示 `—`。

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
