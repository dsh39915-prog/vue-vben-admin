# AI 图片生成接口校对（2026-10-24）

依据 `http://192.168.0.140:48080/v3/api-docs/flycowerp` 核对该模块全部四个接口：

- POST `/admin-api/flycowerp/aiImg/save`
- POST `/admin-api/flycowerp/aiImg/update`
- POST `/admin-api/flycowerp/aiImg/page`
- GET `/admin-api/flycowerp/aiImg/details/{id}`

## 对接调整

- `AiImgSaveReqVO` 的 `required` 为 `styleNo`。保存类型改为必填字符串；普通生图的新建、编辑，无论暂存还是生成均检查空值和纯空格，发送去首尾空格后的款号。模特图、动作图从当前款式带入款号，缺失时提示，不发送无效生图请求。
- 此校验仅针对 `aiImg/save`、`aiImg/update`；流程通用草稿保存仍允许未完成的表单。
- 补齐响应字段 `operator`、`createUserId`，操作人及创建人 ID 支持字符串形式。生图列表、全部结果列表和结果详情展示操作人，名称为空时使用操作人 ID；详情补充创建人 ID。
- 分页继续使用 `page/pageSize`、款号 `styleNo`、来源 `sourcePage` 及原有筛选。保存、修改仍传款式 `styleId` 和原图/参考图的原图、预览、缩略地址；来源枚举为 0/1/3/4/5/6。
- 返回的 `results` 仍为结果对象数组，包含槽位、来源结果、尺寸及原图/预览图/缩略图地址，无需调整已有结果展示及历史查询。

## 验证

- 真实接口只读验证：分页和记录 29 的详情均 `code=0`，包含 `styleNo/operatorId/operator/createUserId/sourcePage` 及三种结果图片地址。分页中操作人为“管理员”，详情中 `operator=null`，前端按 ID 回退显示。
- 扩展并通过现有浏览器回归 `docs/testing/image-source-page-2026-10-22/browser.mjs`：新建/编辑空白款号不发保存请求、输入保留、款号去空格、操作人名称及 ID 回退、完整创建人 ID 显示、普通单图/批量和模特图/动作图生成、六种来源筛选。
- 主应用类型检查、修改文件 ESLint、`git diff --check` 通过。顺带补齐上新分配入口的节点空值判断，消除类型检查发现的可空引用。
- 写入均使用模拟接口，未创建真实生图任务。
