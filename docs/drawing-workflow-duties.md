# 制图流程职责配置（2026-10-19）

左侧新增“制图流程”，按产品提供的顺序列出 15 个流程环节。员工权限由登录接口 `/system/auth/get-permission-info` 返回的 permissions 决定，不按角色名称猜测职责。2026-10-20 补充：后端内置超级管理员角色码 `super_admin` 在前端仅补充流程管理权限 `flycowerp:drawing:manage`，恢复全部流程入口；不生成全局通配符，系统授权操作仍检查后端返回的对应权限码。

## 管理员配置

1. 在现有“系统管理 → 角色管理”创建职责角色，例如搭配专员、图片审核员或修图人员。
2. 进入“上新管理 → 制图职责 → 角色职责”，选择角色并勾选允许进入的环节，点击“保存职责”。
3. 在“员工角色”页签选择员工，为其分配一个或多个角色并保存。
4. 员工重新登录后，仅显示角色合并后的制图环节，默认进入第一个获授权的环节。未配置任何职责的账号不显示“制图流程”。

保存职责仅替换该角色的制图权限，保留其他菜单权限。保存前重新读取当前授权，避免覆盖编辑期间新增的其他权限。首次保存缺失的职责会使用现有菜单创建接口登记“制图流程”目录和对应按钮权限；无需新增后端业务接口。失败重试时重新读取已有记录，避免重复创建。没有 system:menu:create 权限时，不会尝试创建缺失的职责。

“流程管理（全部环节和所有员工任务）”对应 `flycowerp:drawing:manage`，可进入原有上新任务管理、全量工作台、流程及流程定义页面，并查看各节点全部员工任务。此权限本身不授予角色配置能力。配置职责还需 `system:permission:assign-role-menu`，分配员工角色还需 `system:permission:assign-user-role`；后端超级管理员的 `*:*:*` 包含全部上述能力。

本次没有修改真实用户、角色、授权或流程数据；管理员需在部署后按实际员工职责配置。

## 节点与权限码

| 左侧入口 | 节点 Key | 权限码 |
| --- | --- | --- |
| AI搭配方案输出 | `aiMatchingOutput` | `flycowerp:drawing:aiMatchingOutput` |
| AI搭配方案审核 | `aiMatchingAudit` | `flycowerp:drawing:aiMatchingAudit` |
| AI图片生成任务分配 | `aiImageTaskDispatch` | `flycowerp:drawing:aiImageTaskDispatch` |
| AI图片生成（模特图） | `aiImageModelTask` | `flycowerp:drawing:aiImageModelTask` |
| AI图片审核（模特图） | `aiImageModelAudit` | `flycowerp:drawing:aiImageModelAudit` |
| AI图片生成（动作图） | `aiImageActionTask` | `flycowerp:drawing:aiImageActionTask` |
| AI图片审核（动作图） | `aiImageActionAudit` | `flycowerp:drawing:aiImageActionAudit` |
| 修图任务分配 | `retouchTaskDispatch` | `flycowerp:drawing:retouchTaskDispatch` |
| 修图制作 | `retouching` | `flycowerp:drawing:retouching` |
| 修图审核 | `retouchingAudit` | `flycowerp:drawing:retouchingAudit` |
| 页面制作任务分配 | `pageTaskDispatch` | `flycowerp:drawing:pageTaskDispatch` |
| 页面制作 | `pageProduction` | `flycowerp:drawing:pageProduction` |
| 页面审核 | `pageProductionAudit` | `flycowerp:drawing:pageProductionAudit` |
| 上新任务分配 | `launchTaskDispatch` | `flycowerp:drawing:launchTaskDispatch` |
| 上新审核 | `launchAudit` | `flycowerp:drawing:launchAudit` |

每个节点页面路径为 `/drawing/{节点 Key}`；处理任务使用同一路径的 `?taskId=...`。上新材料准备节点不在本次提供的 15 个菜单项中，保留原有管理员工作台处理能力。

## 员工任务范围

- 列表、款号查询、分页和任务选择器统一发送 `flowNodeKey=当前环节`、`currentAssigneeId=登录用户 ID`；不从 URL 接受处理人或节点筛选覆盖。管理员进入节点页时仍按节点筛选，但不限制处理人。
- 收到列表后复核每条记录的节点和处理人。后端忽略筛选或返回异常结构时，显示加载异常并清空结果，不展示其他员工的记录。
- 直接打开 taskId 时，先从受限分页中确认任务归属，再读取详情、方案和附件；不属于本人/当前节点、已流转的任务均不能继续打开或处理。
- 员工无法通过直接 URL 进入未获授权的节点或原有全量任务工作台，返回 403。冻结、解冻及全流程查看入口保留给流程管理人员。
- 图片生成、修图和页面制作等节点默认打开“商品款式”；搭配输出与审核默认打开“AI 搭配方案”。对应的保存、审核、分配操作复用现有接口和节点 Key 校验，处理中禁止切换任务。
- 后台授权修改后，重新登录或刷新页面将重新获取权限；不使用浏览器里过期的权限码生成新菜单。

## 服务端鉴权配合

本仓库为前端工程。本次实现了菜单过滤、路由拦截及任务归属复核，不能替代接口层授权。后端需在任务列表/详情、方案/款式读取及保存、审核/分配等写接口中，按登录用户的节点权限和实际流程任务处理人进行校验；不能把客户端提交的 currentAssigneeId 当作授权依据。任务在页面打开后转派或流转时，也需在提交操作时重新核对。

现有调试管理员身份的只读联调已确认：POST `/flycowerp/newProductTask/page` 传 `flowNodeKey=aiMatchingOutput`、`currentAssigneeId=1` 返回 ID=1 且节点/处理人匹配。没有使用真实员工账号执行越权请求，不据此声称服务端权限隔离已验收。

## 接口与验证

复用系统接口：

- GET `/system/permission/list-role-menus?roleId=...`
- POST `/system/permission/assign-role-menu`，请求 roleId/menuIds
- GET `/system/permission/list-user-roles?userId=...`
- POST `/system/permission/assign-user-role`，请求 userId/roleIds
- 已有角色、员工、菜单查询及菜单创建接口。

验证覆盖员工本人任务、搜索/选择、跨节点/他人 taskId 拦截、直接管理 URL 拦截、转派后失去操作、忽略筛选时停止展示、权限撤回后刷新、管理员 15 个入口和顺序、无写入的页面初始化、职责首次登记/失败重试/撤回、保留其他菜单授权及员工已有未知角色。授权和流程写操作使用浏览器模拟接口；没有对真实系统执行授权写入。职责访问策略另有 8 个单元测试，包含后端 `super_admin` 无通配符时的流程访问及普通员工隔离回归。
