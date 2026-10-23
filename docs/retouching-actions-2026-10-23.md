# 修图制作：保存、提交与驳回

2026-10-23 核对最新 Swagger，修图制作补齐底部“驳回 / 保存款式图片 / 提交”操作。

- 保存使用 `/flycowerp/flow/draft/save`，重新进入通过 `/flycowerp/flow/draft/get` 恢复；不校验必填项，不需要勾选款式，不推进流程。全量保存各款式精修模特图、精修动作图、备注和附件；失败保留输入，损坏草稿禁止覆盖。
- 提交使用 `/flycowerp/newProductStyle/saveImageData`，携带当前流程上下文及 `items[].styleId/retouchedModelImageUrls/retouchedActionImageUrls`。至少上传一张本次修图并填写备注；未上传图片的款式跳过。图片保留临时文件 ID 和三种地址，不添加未约定的 status 字段。
- 驳回沿用制作节点通用审核约定，调用 `/flycowerp/flow/audit`，`nodeKey=retouching`、`auditStatus=2`，携带必填原因与附件。无需上传图片，确认后由后端执行退回上一节点，成功后返回修图任务列表。
- 三类写入前重新校验员工任务范围和节点任务 ID；上传或请求期间防止重复操作及切换任务。只读详情不读取编辑草稿、不展示提交或驳回操作。
- 页面制作仍保留原有勾选款式与保存方式。

验证：主应用类型检查、修改文件 ESLint/格式检查、补丁空白检查通过。浏览器使用模拟接口验证空表单保存、草稿往返恢复、多款式提交、备注附件、大整数 ID、失败保留、节点变化拦截、无图片驳回、处理中导航保护、损坏草稿及只读限制，并检查页面制作原有勾选入口。详见 [验证脚本](./testing/retouching-actions-2026-10-23/browser.mjs) 和 [结果](./testing/retouching-actions-2026-10-23/result.json)。未修改真实流程任务，实际流转由后端执行。
