# 系统管理接口核对与补齐（2026-10-20）

核对来源：`http://192.168.0.140:48080/v3/api-docs/system`。本次指定的八组共 **62 个接口**，均已提供匹配 HTTP 方法的 API 封装和相应页面能力。精简列表的旧、新路径属于别名，页面使用其中一个，保留另一别名供兼容使用。

## 原有缺口与本次补充

| 模块 | 接口数 | 页面与补充内容 |
| --- | --: | --- |
| 用户 | 16 | 用户管理增加手机号、部门、角色、时间筛选；单人及勾选用户详情；启停、密码重置、批量删除；模板下载、Excel 导入及导入失败原因；按筛选导出。编辑不发送密码或后端只读字段。 |
| 用户个人中心 | 3 | 基本资料真实读取及保存，头像地址、昵称、手机号、邮箱、性别；角色/岗位为 null 时正常显示；保存同步顶栏昵称与头像；旧/新密码及确认校验；失败保留输入。移除页面中的演示安全状态和无接口的通知设置页签。 |
| 角色 | 9 | 补角色编码与时间筛选、导出、批量删除；沿用 CRUD、分配菜单及数据权限。 |
| 菜单 | 8 | 沿用已完成的完整字段树表、CRUD、批量删除及上级校验。 |
| 部门 | 8 | 树形列表、CRUD、批量删除；禁止自身或子部门作为父级；负责人可按昵称远程搜索，并回显精简列表外的已有负责人。 |
| 权限 | 5 | 沿用用户角色、角色菜单、角色数据范围的读取和分配；保留未知已有授权，不使用角色名称代替权限码。 |
| 认证 | 10 | 原有账号登录、权限读取、登出及刷新令牌保留；补短信登录、验证码发送、注册、找回密码、第三方授权及回调。所有登录方式共用令牌、用户信息和权限初始化，初始化失败清理半完成状态。 |
| 登录日志 | 3 | 增加 IP 与时间筛选、成功/失败筛选、结构化详情及导出；失败结果显示后端字典含义。 |

## 契约差异与处理

- 登录日志查询 `status` 是 Boolean：成功 `true`，失败 `false`；不能套用账号正常/停用的 0/1。已真实验证两种值均可筛选。
- 日期数组按重复参数发送，例如 `createTime=开始&createTime=结束`；真实日志时间筛选已返回成功。
- 用户导入以 multipart 上传 `file`，`updateSupport` 放在查询参数；返回展示新增、更新数量和逐用户失败原因。本次用户导入与此前暂停的上新任务导入无关，**上新任务 Excel 导入仍暂停**。
- 模板和三个导出接口实际返回 XLSX ZIP 字节，当前服务未返回 Content-Type/文件名头。前端识别文件头并使用 .xlsx 文件名；JSON/文本错误不会保存为 Excel。
- 保存、启停、重置密码和删除遇到业务 Boolean=false 时保留表单或勾选，不误报成功；在途写入禁止重复提交与跳转。
- 用户/角色/菜单沿用现有权限过滤；部门与登录日志新增查询路由权限、对应操作权限。仅查询权限不会看到修改、删除、导入、导出和授权按钮。
- 认证页面原滑块仅有本地布尔值，不能满足服务端 CAPTCHA。新增 AJ-Captcha 的 get/check 和 AES ECB/PKCS7 参数，验证通过后才发送 captchaVerification。取消、失败和过期均不能绕过图片校验。依赖 crypto-js 4.2.0 复用现有锁文件中的版本。
- 短信场景使用芋道上游 SmsSceneEnum 的后台场景：登录 21、找回密码 23（Swagger 示例 1 属于会员场景）。来源：<https://github.com/YunaiV/ruoyi-vue-pro/blob/master/yudao-module-system/src/main/java/cn/iocoder/yudao/module/system/enums/sms/SmsSceneEnum.java>。若项目自定义枚举，需后端同步对应约定。
- 第三方授权从服务端获取地址，回调使用当前路由基址；在当前会话保存 type/state，有效期 10 分钟，回调校验 state 后交换令牌。第三方平台账号、回调白名单和短信模板/渠道由后端环境配置，前端不模拟授权成功。Swagger 无独立二维码轮询接口，原静态二维码入口改为引导至第三方授权。
- 保持本地路由和已有员工制图节点权限体系。后端菜单授权仍在重新登录后生效；前端按钮和导航校验不能替代服务端授权。

## 验证范围

真实服务器仅执行读取、模板下载和导出；未创建账号、修改密码、删除业务记录、发送短信或修改真实角色授权。读取已验证用户、个人资料、角色、部门及登录日志，三个导出和用户模板均返回有效 XLSX 字节。证据摘要仅保存状态、数量、文件类型与长度，不保存用户表格或个人资料。

本地浏览器通过模拟接口验证写操作：用户筛选/详情/批量详情、CRUD、启停、密码重置、导入 multipart 参数及结果、模板与导出；角色筛选/导出/批量删除；部门树和父级保护/负责人搜索及回显/保存及批量删除；日志布尔筛选/详情/导出/失败重试；个人资料与密码校验/保存重试；账号/注册/短信/密码找回、后端图片验证、第三方回调及错误 state 拦截。

外部短信实际投递、真实第三方平台授权与手动图片拼合的服务端验收仍需使用环境配置和测试账号完成；上述链路已完成前端调用与模拟契约验证。

已通过：修改文件 ESLint 与格式检查、`pnpm --filter @vben/web-antd typecheck`、权限/树形结构单元测试（2 个文件、8 项）、生产构建（生成 dist 与 dist.zip）。浏览器回归同时通过原有菜单 CRUD、角色菜单/数据/用户授权、只读账号和撤权直链拦截，以及员工节点导航、本人任务隔离和转派后权限回收。原开发端口 5666 的登录与基础布局模块已确认正常加载。

## 完整接口清单

| 分组 | 方法 | 路径 | 页面能力 |
| --- | --- | --- | --- |
| 用户 | PUT | `/system/user/update` | 修改用户 |
| 用户 | PUT | `/system/user/update-status` | 修改用户状态 |
| 用户 | PUT | `/system/user/update-password` | 重置用户密码 |
| 用户 | POST | `/system/user/import` | 导入用户 |
| 用户 | POST | `/system/user/create` | 新增用户 |
| 用户 | GET | `/system/user/page` | 获得用户分页列表 |
| 用户 | GET | `/system/user/list` | 获得用户详情列表 |
| 用户 | GET | `/system/user/list-by-nickname` | 按昵称模糊搜索用户精简信息 |
| 用户 | GET | `/system/user/list-all-simple` | 获取用户精简信息列表（兼容别名） |
| 用户 | GET | `/system/user/simple-list` | 获取用户精简信息列表 |
| 用户 | GET | `/system/user/get` | 获得用户详情 |
| 用户 | GET | `/system/user/get-simple` | 获得用户精简信息 |
| 用户 | GET | `/system/user/get-import-template` | 获得导入用户模板 |
| 用户 | GET | `/system/user/export-excel` | 导出用户 |
| 用户 | DELETE | `/system/user/delete` | 删除用户 |
| 用户 | DELETE | `/system/user/delete-list` | 批量删除用户 |
| 用户个人中心 | PUT | `/system/user/profile/update` | 修改用户个人信息 |
| 用户个人中心 | PUT | `/system/user/profile/update-password` | 修改用户个人密码 |
| 用户个人中心 | GET | `/system/user/profile/get` | 获得登录用户信息 |
| 角色 | PUT | `/system/role/update` | 修改角色 |
| 角色 | POST | `/system/role/create` | 创建角色 |
| 角色 | GET | `/system/role/page` | 获得角色分页 |
| 角色 | GET | `/system/role/list-all-simple` | 获取角色精简信息列表（兼容别名） |
| 角色 | GET | `/system/role/simple-list` | 获取角色精简信息列表 |
| 角色 | GET | `/system/role/get` | 获得角色信息 |
| 角色 | GET | `/system/role/export-excel` | 导出角色 Excel |
| 角色 | DELETE | `/system/role/delete` | 删除角色 |
| 角色 | DELETE | `/system/role/delete-list` | 批量删除角色 |
| 菜单 | PUT | `/system/menu/update` | 修改菜单 |
| 菜单 | POST | `/system/menu/create` | 创建菜单 |
| 菜单 | GET | `/system/menu/list` | 获取菜单列表 |
| 菜单 | GET | `/system/menu/list-all-simple` | 获取菜单精简信息列表（兼容别名） |
| 菜单 | GET | `/system/menu/simple-list` | 获取菜单精简信息列表 |
| 菜单 | GET | `/system/menu/get` | 获取菜单信息 |
| 菜单 | DELETE | `/system/menu/delete` | 删除菜单 |
| 菜单 | DELETE | `/system/menu/delete-list` | 批量删除菜单 |
| 部门 | PUT | `/system/dept/update` | 更新部门 |
| 部门 | POST | `/system/dept/create` | 创建部门 |
| 部门 | GET | `/system/dept/list` | 获取部门列表 |
| 部门 | GET | `/system/dept/list-all-simple` | 获取部门精简信息列表（兼容别名） |
| 部门 | GET | `/system/dept/simple-list` | 获取部门精简信息列表 |
| 部门 | GET | `/system/dept/get` | 获得部门信息 |
| 部门 | DELETE | `/system/dept/delete` | 删除部门 |
| 部门 | DELETE | `/system/dept/delete-list` | 批量删除部门 |
| 权限 | POST | `/system/permission/assign-user-role` | 赋予用户角色 |
| 权限 | POST | `/system/permission/assign-role-menu` | 赋予角色菜单 |
| 权限 | POST | `/system/permission/assign-role-data-scope` | 赋予角色数据权限 |
| 权限 | GET | `/system/permission/list-user-roles` | 获得管理员拥有的角色编号列表 |
| 权限 | GET | `/system/permission/list-role-menus` | 获得角色拥有的菜单编号 |
| 认证 | POST | `/system/auth/social-login` | 社交快捷登录，使用 code 授权码 |
| 认证 | POST | `/system/auth/sms-login` | 使用短信验证码登录 |
| 认证 | POST | `/system/auth/send-sms-code` | 发送手机验证码 |
| 认证 | POST | `/system/auth/reset-password` | 重置密码 |
| 认证 | POST | `/system/auth/register` | 注册用户 |
| 认证 | POST | `/system/auth/refresh-token` | 刷新令牌 |
| 认证 | POST | `/system/auth/logout` | 登出系统 |
| 认证 | POST | `/system/auth/login` | 使用账号密码登录 |
| 认证 | GET | `/system/auth/social-auth-redirect` | 社交授权的跳转 |
| 认证 | GET | `/system/auth/get-permission-info` | 获取登录用户的权限信息 |
| 登录日志 | GET | `/system/login-log/page` | 获得登录日志分页列表 |
| 登录日志 | GET | `/system/login-log/get` | 获得登录日志 |
| 登录日志 | GET | `/system/login-log/export-excel` | 导出登录日志 Excel |
