# AI 模型接口更新核对（2026-10-21）

来源：`http://192.168.0.140:48080/v3/api-docs/flycowerp`，分组“管理后台 - AI 模型”。

当前分组 10 个接口均有前端调用入口。本次新增接入服务商列表；其它接口的方法、参数、返回结构与现有实现一致。

| 接口（省略 `/admin-api/flycowerp/aiModel`） | 页面用途 |
| --- | --- |
| GET `/providerList` | **本次补齐**：查询、新增/编辑表单的服务商下拉，列表服务商名称 |
| POST `/page` | 名称、类型、服务商、状态筛选和分页，展示测试状态与调用结果 |
| GET `/detail/{id}` | 编辑回显和只读详情 |
| POST `/save`、POST `/update` | 新增与修改模型，服务商提交数字 `providerId` |
| GET `/delete/{id}` | 确认删除 |
| GET `/enable/{ids}`、GET `/disable/{ids}` | 单个及批量启停 |
| GET `/testConnection/{id}` | 提交异步测试，列表轮询 `testStatus` 和 `result` |
| GET `/sizeConfig?modelCode=…` | 图片生成表单的画质、尺寸与比例联动 |

## 本次页面变化

- 服务商返回 `{ id: number, name: string }[]`；筛选、新增、编辑均按名称选择。
- 新增模型不再默认使用服务商 ID 1，必须选择后才能保存。
- 表格显示服务商名称；历史模型的服务商未在最新列表中出现时，显示“服务商 #ID”，详情和编辑保留原值。
- 服务商读取失败提供重试入口，空列表显示“暂无服务商”。

## 验证范围

- 测试环境服务商列表真实只读请求成功，返回 9 项：火山引擎、阿里云百炼、Google Gemini、Google Vertex AI、VectorEngine、RunningHub、LinkAIhub、中创宏、OpenAI。
- 浏览器回归脚本：[browser.mjs](testing/ai-model-2026-10-21/browser.mjs)，使用模拟接口验证服务商加载失败重试、数字 ID 筛选与重置、新增必选校验、编辑和只读详情保留历史服务商、空列表，以及异步测试状态和调用结果刷新。
- 运行命令：`node docs/testing/ai-model-2026-10-21/browser.mjs`。默认使用本地 `http://127.0.0.1:5666`，可通过 `DRAWING_TEST_BASE_URL` 修改；成功后生成同目录 `result.json`。
- 本轮浏览器回归、web-antd 类型检查、修改文件的 ESLint / oxfmt 与 `git diff --check` 均通过。
- 真实环境未创建、修改、删除模型或触发模型测试。
