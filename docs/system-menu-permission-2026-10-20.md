# 菜单与权限接口接入（2026-10-20）

依据当前 `system` Swagger 的“管理后台 - 菜单”“管理后台 - 权限”。菜单管理使用独立树表页面，用户和角色管理增加通用授权入口，保留已有制图职责功能。

## 页面入口

| 入口 | 功能 | 操作权限码 |
| --- | --- | --- |
| 系统管理 → 菜单管理 `/system/menu` | 名称/状态查询、目录/菜单/按钮树、展开/折叠、详情编辑、新增子项、单项/批量删除 | 查询 `system:menu:query`；新增/编辑/删除分别为 `system:menu:create/update/delete` |
| 系统管理 → 用户管理 → 分配角色 | 读取当前角色、选择及移除角色，可提交空列表移除全部角色 | `system:permission:assign-user-role` |
| 系统管理 → 角色管理 → 菜单权限 | 读取菜单树及现有授权，独立勾选菜单和按钮 | `system:permission:assign-role-menu` |
| 系统管理 → 角色管理 → 数据权限 | 全部、指定部门、本部门、本部门及以下、仅本人 | `system:permission:assign-role-data-scope` |

用户、角色管理列表分别要求 `system:user:query`、`system:role:query`。导航及直接访问检查查询权限，操作按钮及事件处理再次检查对应权限。支持 `*:*:*`；不依据角色名称推断超级权限。现有制图节点权限码、员工本人任务范围不变。

## 接口

- 菜单：`GET /system/menu/list`、`GET /system/menu/get?id=...`、`POST /system/menu/create`、`PUT /system/menu/update`、`DELETE /system/menu/delete?id=...`、`DELETE /system/menu/delete-list?ids=1,2`。
- 上级菜单和授权树：`GET /system/menu/list-all-simple`；`/system/menu/simple-list` 是 Swagger 同义接口，保留现有封装，不重复请求。
- 用户角色：`GET /system/permission/list-user-roles?userId=...`，`POST /system/permission/assign-user-role`，请求 `{userId,roleIds}`。
- 角色菜单：`GET /system/permission/list-role-menus?roleId=...`，`POST /system/permission/assign-role-menu`，请求 `{roleId,menuIds}`。
- 数据权限：读取 `/system/role/get?id=...` 及 `/system/dept/simple-list`；`POST /system/permission/assign-role-data-scope`，请求 `{roleId,dataScope,dataScopeDeptIds}`。五种范围已与真实 `system_data_scope` 字典核对：1 全部、2 指定部门、3 本部门、4 本部门及以下、5 仅本人。指定部门至少选一项，其余范围发送空部门数组。

## 行为说明

- 菜单按 `parentId` 建树并按 `sort/id` 排序；查询只返回子项时仍展示匹配项，不因缺少父项丢失结果。初始折叠，避免一次渲染两千余条菜单。
- 上级菜单排除按钮、当前节点及其后代；有子项时不能改成按钮。保存覆盖名称、层级、类型、排序、状态、权限码、路由、图标、组件路径/名称、显示/缓存/总是显示；不回传创建时间等只读字段。名称和字段长度遵循 Swagger，按类型显示及清理不适用字段。
- 菜单树授权使用独立勾选，不通过父节点自动增加子权限。未出现在精简列表中的已有授权会提示并保留；“清空已列菜单”只清理已显示菜单。已分配但未返回的角色、部门同样保留可见占位，避免无意清除。
- 读取失败禁止保存并提供重试；HTTP/业务失败保留输入、授权选择和删除勾选；Boolean 必须为 true 才视为写入成功。写入时锁定提交、关闭弹窗及切换页面，避免重复和错配。
- 登录继续通过 `/system/auth/get-permission-info` 获得权限码。当前导航采用项目本地路由，按权限过滤相关系统入口；未切换成后端全量动态路由。后端菜单包含大量未在本项目实现的 ERP 等模块，修改组件路径不会自动创建页面。授权更新在相关用户重新登录后读取生效。

## 验证记录

真实环境只读验证全部 HTTP 200、code=0：菜单列表和两种精简列表各 2061 项；按“菜单”及 status=0 查询 10 项；菜单 1 详情；角色 2 菜单授权 678 项；用户 1 角色 2 项；角色 2 数据范围为 2（原部门列表为 null，界面按空选择读取，保存时要求补选）。没有执行真实新增、修改、删除或角色授权。

本地 Chrome 使用模拟数据验证：

- 树形展示和缺父项搜索、条件字段与必填、组件名称回显、菜单新增/编辑/单删/批删及请求参数。
- 读取失败阻止保存、Boolean false 保留编辑/勾选并可重试。
- 菜单授权读取重试、独立勾选不扩大子权限、未知授权保留、角色预选及空角色提交。
- 指定部门必填、五种数据范围、非指定范围清空请求中的部门 ID。
- 授权保存中重复提交、取消及路由切换拦截。
- 查询权限账号没有写入/授权按钮；撤回查询权限及新登录直接链接禁止访问，未发列表请求。
- 原有员工制图本人范围及跨节点权限回归；页面无运行异常或 Form model 警告。

菜单树的排序、缺父项保留、循环/重复/不安全编号拦截、空授权与异常授权校验有单元测试；同时运行原制图权限单测。完成应用类型检查、修改文件 ESLint 与生产打包。
