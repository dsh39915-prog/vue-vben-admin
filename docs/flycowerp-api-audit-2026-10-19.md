# flycowerp 接口接入核对（2026-10-19）

来源：`http://192.168.0.140:48080/v3/api-docs/flycowerp`。本次下载最新 Swagger，与当前 web-antd 应用逐项比对。

14 组、67 个接口中，65 个已接入；另 2 个按用户范围排除。此次补齐流程定义的查询和部署，修正素材下载的 HTTP 方法及参数。

## 本次变更

| 接口 | 原情况 | 本次处理 |
| --- | --- | --- |
| GET /flycowerp/bpmnTest/nodeList | 无 API 和页面 | 新增“上新管理 → 流程定义”，按 processDefinitionKey 查询，展示后端返回的节点字段 |
| POST /flycowerp/bpmnTest/deploy | 无 API 和页面 | 表单填写 processKey/processName，确认部署，展示部署结果并刷新节点；失败保留输入，提交期间阻止重复提交和离开页面 |
| GET /flycowerp/newProductStyle/downloadMaterials | 旧版使用 POST 和图片保存请求体 | 改为 GET，仅传 procInstId/nodeTaskId/nodeKey；去掉勾选款式和图片校验前置条件 |

## 保留范围

- POST /flycowerp/newProductTask/create：此前明确不接入，本次保持。
- POST /flycowerp/newProductTask/import：本次用户再次确认继续暂停，模板问题处理完后再接入。
- 聊天、视频生成、视频素材和完整数据统计：本次 Swagger 未提供对应接口，页面继续保留占位状态。

## 核对方法与验证

- 自动比对 Swagger 的 HTTP 方法和路径；以模拟 requestClient 调用现有封装捕获端点，包含主图历史和槽位历史两种路径，并检查页面调用引用。结果 65/65 个范围内接口匹配；这表示前端接入覆盖，不代表所有后端业务均已验收通过。
- 对比上一轮 Swagger：主要契约变化是素材下载改为 GET 和三个查询参数；分页 schemas 的变动为字段排列，业务字段未变化。
- 浏览器模拟验证流程定义必填、Key 去空格和编码、动态节点字段、空列表、异常重试、部署确认、失败保留输入、提交锁定、无部署 ID 时不误报成功、部署后刷新；未实际部署服务器流程。
- 回归工作台方案保存/提交、图片上传及四类节点保存、审核/分配、冻结/解冻、节点和流转记录查询，并验证素材下载无需选择款式、使用 GET 和三个参数、false 返回可重试。写操作使用模拟接口。
- 类型检查、ESLint、oxfmt 与 git diff --check 通过。

## 实际后端响应仍有的限制

- 最新 GET 素材下载：HTTP 200，application/json，响应 `{ "code": 0, "msg": "", "data": true }`。没有文件、下载链接或文件名，前端提示“请求已完成，暂未收到下载文件”。
- 流转记录：HTTP 200，Content-Length: 0。前端显示加载异常，可重试。
- 上一轮任务接口的业务问题详见 [上新任务实测报告](launch-task-api-test-2026-10-19.md)。本次未重新执行启用、终止、删除等真实写操作，不能据本次接入核对声称这些问题已修复。

## 分组覆盖

| 分组                       | 已接入 / 总数 |
| -------------------------- | ------------- |
| 管理后台 - 上新任务        | 6 / 8         |
| 管理后台 - 图库分类管理    | 6 / 6         |
| 管理后台 - 图片上传        | 1 / 1         |
| 管理后台 - 新商品款式      | 3 / 3         |
| 管理后台 - 图库图片管理    | 4 / 4         |
| 管理后台 - 流程通用接口    | 6 / 6         |
| 管理后台 - 通用审核记录    | 2 / 2         |
| 管理后台 - AI 提示词类别   | 5 / 5         |
| 管理后台 - AI 提示词       | 5 / 5         |
| 管理后台 - AI 模型         | 9 / 9         |
| 管理后台 - AI搭配方案      | 2 / 2         |
| 管理后台 - AI 图片生成     | 4 / 4         |
| 管理后台 - AI 生图任务表   | 9 / 9         |
| 管理后台 - AI 图片生成结果 | 3 / 3         |

## 逐项清单

API 均位于 `apps/web-antd/src/api/aigc/`；完整封装与页面引用见同名 JSON 文件。

| 方法 | 路径（省略 /admin-api） | 状态 | API 文件 |
| --- | --- | --- | --- |
| PUT | `/flycowerp/newProductTask/update` | 已接入 | launch.ts |
| PUT | `/flycowerp/newProductTask/terminate/{id}` | 已接入 | launch.ts |
| PUT | `/flycowerp/newProductTask/enable/{id}` | 已接入 | launch.ts |
| PUT | `/flycowerp/library-category/update` | 已接入 | library.ts |
| POST | `/flycowerp/temp-image/upload` | 已接入 | workflow.ts |
| POST | `/flycowerp/newProductTask/page` | 已接入 | launch.ts |
| POST | `/flycowerp/newProductTask/import` | 按用户确认继续暂停 | — |
| POST | `/flycowerp/newProductTask/create` | 按用户要求不接入 | — |
| POST | `/flycowerp/newProductStyle/saveImageData` | 已接入 | workflow.ts |
| POST | `/flycowerp/library-image/upload` | 已接入 | library.ts |
| POST | `/flycowerp/library-category/create` | 已接入 | library.ts |
| POST | `/flycowerp/flow/unfreeze` | 已接入 | workflow.ts |
| POST | `/flycowerp/flow/freeze` | 已接入 | workflow.ts |
| POST | `/flycowerp/flow/audit` | 已接入 | workflow.ts |
| POST | `/flycowerp/flow/assign` | 已接入 | workflow.ts |
| POST | `/flycowerp/bpmnTest/deploy` | 已接入 | process-definition.ts |
| POST | `/flycowerp/aiPromptCategory/update` | 已接入 | prompt.ts |
| POST | `/flycowerp/aiPromptCategory/save` | 已接入 | prompt.ts |
| POST | `/flycowerp/aiPromptCategory/page` | 已接入 | prompt.ts |
| POST | `/flycowerp/aiPrompt/update` | 已接入 | prompt.ts |
| POST | `/flycowerp/aiPrompt/save` | 已接入 | prompt.ts |
| POST | `/flycowerp/aiPrompt/page` | 已接入 | prompt.ts |
| POST | `/flycowerp/aiModel/update` | 已接入 | model.ts |
| POST | `/flycowerp/aiModel/save` | 已接入 | model.ts |
| POST | `/flycowerp/aiModel/page` | 已接入 | model.ts |
| POST | `/flycowerp/aiMatchingScheme/save` | 已接入 | workflow.ts |
| POST | `/flycowerp/aiImg/update` | 已接入 | image.ts |
| POST | `/flycowerp/aiImg/save` | 已接入 | image.ts |
| POST | `/flycowerp/aiImg/page` | 已接入 | image.ts |
| POST | `/flycowerp/aiImageTask/result/regenerate/{resultId}` | 已接入 | image-result.ts |
| POST | `/flycowerp/aiImageTask/result/material-enhance/{resultId}` | 已接入 | image-result.ts |
| POST | `/flycowerp/aiImageTask/page` | 已接入 | image-task.ts |
| GET | `/flycowerp/newProductTask/get/{id}` | 已接入 | launch.ts |
| GET | `/flycowerp/newProductStyle/list` | 已接入 | workflow.ts |
| GET | `/flycowerp/newProductStyle/downloadMaterials` | 已接入 | workflow.ts |
| GET | `/flycowerp/library-image/page` | 已接入 | library.ts |
| GET | `/flycowerp/library-image/get` | 已接入 | library.ts |
| GET | `/flycowerp/library-category/tree` | 已接入 | library.ts |
| GET | `/flycowerp/library-category/page` | 已接入 | library.ts |
| GET | `/flycowerp/library-category/get` | 已接入 | library.ts |
| GET | `/flycowerp/flow/transferRecordList` | 已接入 | workflow.ts |
| GET | `/flycowerp/flow/nodeDetailList` | 已接入 | workflow.ts |
| GET | `/flycowerp/bpmnTest/nodeList` | 已接入 | process-definition.ts |
| GET | `/flycowerp/aiPromptCategory/details/{id}` | 已接入 | prompt.ts |
| GET | `/flycowerp/aiPromptCategory/delete/{id}` | 已接入 | prompt.ts |
| GET | `/flycowerp/aiPrompt/details/{id}` | 已接入 | prompt.ts |
| GET | `/flycowerp/aiPrompt/delete/{id}` | 已接入 | prompt.ts |
| GET | `/flycowerp/aiModel/testConnection/{id}` | 已接入 | model.ts |
| GET | `/flycowerp/aiModel/sizeConfig` | 已接入 | model.ts |
| GET | `/flycowerp/aiModel/enable/{ids}` | 已接入 | model.ts |
| GET | `/flycowerp/aiModel/disable/{ids}` | 已接入 | model.ts |
| GET | `/flycowerp/aiModel/detail/{id}` | 已接入 | model.ts |
| GET | `/flycowerp/aiModel/delete/{id}` | 已接入 | model.ts |
| GET | `/flycowerp/aiMatchingScheme/list` | 已接入 | workflow.ts |
| GET | `/flycowerp/aiImg/details/{id}` | 已接入 | image.ts |
| GET | `/flycowerp/aiImageTask/statistics` | 已接入 | image-task.ts |
| GET | `/flycowerp/aiImageTask/start/{ids}` | 已接入 | image-task.ts |
| GET | `/flycowerp/aiImageTask/retry/{ids}` | 已接入 | image-task.ts |
| GET | `/flycowerp/aiImageTask/detail/{id}` | 已接入 | image-task.ts |
| GET | `/flycowerp/aiImageTask/cancel/{ids}` | 已接入 | image-task.ts |
| GET | `/flycowerp/aiImageResult/list/{businessKey}` | 已接入 | image-result.ts |
| GET | `/flycowerp/aiImageResult/history/{imgId}` | 已接入 | image-result.ts |
| GET | `/flycowerp/aiImageResult/history/{imgId}/{slotNo}` | 已接入 | image-result.ts |
| DELETE | `/flycowerp/newProductTask/delete/{id}` | 已接入 | launch.ts |
| DELETE | `/flycowerp/library-image/delete` | 已接入 | library.ts |
| DELETE | `/flycowerp/library-category/delete` | 已接入 | library.ts |
| DELETE | `/flycowerp/aiImageTask/delete/{id}` | 已接入 | image-task.ts |
