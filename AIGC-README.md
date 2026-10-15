# AIGC 管理端初始框架

本项目基于 Vue Vben Admin 的 `apps/web-antd` 应用搭建，保留了登录、权限、标签页、国际化、主题和请求拦截器等基础能力。

## 已搭建的业务骨架

- AIGC 工作台
- 上新任务、人工任务工作台、流程管理
- 图片生成、多模态聊天、视频生成
- 提示词分类与模板
- 图片、视频素材管理
- AI 生成任务中心
- 图片、视频统计
- AI 模型管理
- 系统管理：用户、角色、菜单、部门、岗位、租户、字典、参数和公告
- 系统运维：日志、在线用户、定时任务、数据/服务/缓存监控
- AIGC API 与 TypeScript 数据类型目录

## 本地启动

```bash
pnpm install
pnpm dev:antd
```

开发地址默认为 `http://localhost:5666`。开发环境保留 Vben Nitro Mock，方便先验证登录和页面；生产打包暂时请求 `http://192.168.0.140:48080/admin-api`。

## 目录约定

```text
apps/web-antd/src/
  api/aigc/              AIGC 后端接口与类型
  router/routes/modules/ AIGC 菜单与路由
  views/aigc/            AIGC 页面
```

## 对接后端时需要调整

1. 将开发环境 `.env.development` 的 `VITE_GLOB_API_URL` 改为后端地址，并关闭 `VITE_NITRO_MOCK`。
2. 按芋道后端的登录、刷新 Token 及租户头规则调整 `src/api/core` 和 `src/api/request.ts`。
3. 将任务列表中的演示数据替换为 `api/aigc/launch.ts` 的真实接口。
4. 人工任务页面根据稳定的 `taskDefinitionKey` 加载节点表单，不要根据中文节点名判断。
5. 图片和视频生成进度使用 SSE/WebSocket，HTTP 轮询作为降级方案。

## AI 提示词接口接入

- 提示词类别：`/prompt/categories`，支持名称查询、新增、编辑、详情和确认删除。
- AI 提示词：`/prompt/templates`，支持类别、用户提示词、时间范围查询，以及新增、编辑、详情和确认删除。表单包含名称、类别、用户提示词、系统提示词、参考图地址和描述。
- 接口定义：`apps/web-antd/src/api/aigc/prompt.ts`，使用 `/flycowerp/aiPromptCategory` 和 `/flycowerp/aiPrompt` 下的真实接口，并复用项目登录令牌和错误处理。
- 类别列表返回完整数组，名称查询和分页在前端完成；提示词列表提交 `page`、`pageSize` 查询，返回 `records/total/current/size`，管理页使用总条数分页，生图表单读取 `records` 并按 `total` 判断是否可以加载更多模板。
- 开发环境接口地址：`http://192.168.0.140:48080/admin-api`。生产打包暂时同样使用该地址，后续可在 `.env.production` 中调整。

## AI 模型与图片生成接口接入

- 模型管理：`/system/ai-model`，支持分页查询、新增、编辑、详情、删除、异步连接测试及批量启停。列表展示调用结果及测试状态（0 未测试、1 测试中、2 测试成功、3 测试失败）；提交后禁用该模型的重复测试，当前页存在测试中模型时每 3 秒刷新，完成、离开页面或卸载后停止，浏览器隐藏时暂停请求。模型状态使用 0 禁用、1 启用；凭据仅在详情和编辑表单的密码输入框中展示。
- 图片生成：`/generation/image`，支持查询、暂存、提交生成和编辑。联动已接入的提示词类别与模板、启用的图片模型及模型尺寸配置。参考图支持逐行填写，发送时转换为后端使用的逗号分隔格式。保存支持流程任务标识 `businessKey`、预览原图 `previewOriginalImg` 和预览参考图 `previewReferenceImg`，预览参考图同样以逗号分隔提交；编辑时回显并保留。列表、图片详情与任务详情优先使用对应预览图，缺失时逐张回退到原始图片，预览地址不替代生成请求中的原图和参考图地址。
- 生图任务：`/task-center`，支持分页查询、统计、任务详情、进度、错误信息以及单个或批量启动、重试、取消；删除使用 DELETE。等待和运行中的任务每 5 秒刷新，关闭自动刷新、离开页面或卸载时停止，浏览器隐藏时暂停请求。
- 图片生成结果：`/generation/results`，复用生图列表中的当前结果，通过图片 ID 或槽位查询历史版本，支持单张重新生成和材质增强。图片生成页和任务中心也可直接打开结果。结果图片使用 `originalUrl`、`previewUrl`、`thumbnailUrl`：列表优先加载缩略图，放大查看使用预览图，原图链接指向原图地址；缺少缩略图或预览图时回退到可用地址，当前结果和历史版本使用同一规则。
- 流程任务图片查询：图片生成结果页增加“按流程任务查询”页签，调用 `GET /flycowerp/aiImageResult/list/{businessKey}`，按生图记录展示完整分组及图片，不分页。Key 保留字符串格式并进行 URL 路径编码；支持通过 `/generation/results?businessKey=...` 自动查询。每组可打开对应生图记录的结果与历史，缩略图、预览图和原图使用同一地址回退规则。
- 四组接口统一放在 `api/aigc/model.ts`、`image.ts`、`image-task.ts` 和 `image-result.ts`，列表使用后端的 `records/total/current/size` 格式；继续复用登录令牌与统一错误处理。
- 服务商没有提供列表接口，模型表单按 Swagger 输入服务商 ID。尺寸接口返回空配置时可手动填写模型支持的画质、尺寸和比例。
- 联调时发现任务统计接口全部返回 0，但任务列表存在记录；统计卡片展示接口返回值，需要后端核对统计口径。
- 浏览器写入验证使用模拟数据，真实服务器仅验证列表、详情、尺寸配置和历史读取，不实际创建生图任务或修改已有数据。

## 图库接口接入

- 素材管理 → 分类管理（`/asset/categories`）：按库类型、分类名称和状态查询，支持新增、编辑、详情和确认删除。分类保存字段为 `libraryType/categoryName`，库类型使用 0 道具库、1 模特库、2 场景库；接口未提供父分类编辑字段。
- 素材管理 → 图片素材（`/asset/images`）：按库类型、分类、图片名称和状态查询，支持上传、详情、预览、原图查看和确认删除；分类选项由 `/flycowerp/library-category/tree?libraryType=...` 加载，切换库类型清空原分类。后端暂未提供图片编辑或启停接口。
- API 定义为 `api/aigc/library.ts`，分类使用 `/flycowerp/library-category`，图片使用 `/flycowerp/library-image`。分页为 GET `pageNo/pageSize`，返回 `list/total`；分类创建使用 POST，更新使用 PUT，删除使用 DELETE 并通过查询参数传 ID。
- 上传使用 POST `/flycowerp/library-image/upload`，`libraryType/categoryId/imageName` 作为查询参数，文件按 multipart 的 `file` 字段提交，沿用统一鉴权与错误处理。Swagger 暂未声明文件请求体；当前按项目标准文件字段接入，真实上传需后端确认该字段。上传和删除的浏览器验证使用模拟接口，不改动服务器现有图库。
- 列表优先显示缩略图，放大使用预览图，原图链接使用原图地址；缺少对应地址时回退到可用图片。`categoryName` 为空时用分类数据补全，仍无法匹配时显示分类 ID。
- 开发环境后端切换到本次提供的 `http://192.168.0.140:48080/admin-api`，生产打包暂时同样使用该地址。
