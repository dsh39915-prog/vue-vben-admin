# 模特图节点整体草稿保存

日期：2026-10-22。

后续扩展：动作图节点复用同一工作区与草稿结构，`nodeKey` 和 `formType` 使用 `aiImageActionTask`；读取时校验当前节点，不与模特图草稿混用。见 `action-generation-workspace-2026-10-22.md`。

## 交互

- 移除各款式“暂存参数”，在全部款式下方统一“取消 / 保存 / 提交”。独立生图管理弹窗继续沿用原有暂存入口。
- 保存不调用表单必填校验，允许空提示词、未选模型、数量清空、未选图片、空备注及未上传附件。
- 整体保存所有款式右侧参数、历史跨批次选图、上传的最终模特图、当前批次筛选、展开款式、备注及附件。未展开款式的已有草稿也会保留。
- 重新进入节点处理页读取草稿；按字符串款式 ID 恢复，保留大整数精度，不把其他款式的草稿混入当前款式。
- 保存失败保留当前输入；草稿读取失败或格式错误时禁止编辑和覆盖，支持重新加载。上传、生图及保存期间禁止重复操作和切换任务。
- 提交仍调用节点图片提交接口，并检查选图、图片地址、备注及附件限制。保存不推进流程、不创建生图任务。

## 接口及数据

接口前缀为 `/admin-api`。

- `POST /flycowerp/flow/draft/save`：传 `procInstId`、`nodeTaskId`、`nodeKey`、`formDataJson`。返回草稿 ID，以 `code=0` 判断成功。
- `GET /flycowerp/flow/draft/get`：仅传 `procInstId`、`nodeKey`。返回 JSON 字符串，空字符串或 null 表示无草稿。

`formDataJson` 保存以下结构：

```json
{
  "version": 1,
  "formType": "aiImageModelTask",
  "activeStyleId": "款式ID",
  "styles": [
    {
      "styleId": "款式ID",
      "generation": {},
      "selectedImages": [],
      "historyBatchId": "all"
    }
  ],
  "remarkInfoVO": { "contentText": "", "imageUrls": [] }
}
```

`generation` 为右侧生图表单值，包括原图/参考图三种地址、提示词及模板、模型、画质、尺寸、比例、数量；数量允许 null。`selectedImages` 为最终选图对象数组，保存原图、预览及缩略图地址。批次筛选为 `all` 或批次 ID。读取校验仅检查存储结构与字段类型，不要求业务必填项。

## 验证及边界

- 模拟接口浏览器回归：空表单保存、空数量恢复、两款式参数及历史选图恢复、上传及备注附件恢复、未展开款式再次保存、保存失败重试、保存中离开保护、损坏/读取失败草稿防覆盖、提交校验、取消返回列表。
- 类型检查、修改源码 ESLint 与格式检查、生产构建、补丁空白检查。
- 脚本、截图及请求记录见 `docs/testing/model-generation-workspace-2026-10-22/`。浏览器使用模拟接口，未推进真实业务流程；未验证后端草稿实际落库。
- 后续用户确认制作节点驳回复用通用审核接口，已在底部接入；见 `model-generation-reject-2026-10-22.md`，整体保存仍独立调用草稿接口。
