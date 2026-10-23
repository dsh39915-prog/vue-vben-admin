# 动作图审核内容缺失修复

日期：2026-10-23。

## 原因

`workbench.vue` 只为 `aiImageModelAudit` 接入专用图片审核工作区；`aiImageActionAudit` 落入通用方案/款式页面，没有展示已经提交的动作图。

只读核对用户截图中的任务 3、款号 `JJG64886`：`newProductStyle/list?taskId=3` 的图片字段为空，但 `newProductStyle/queryMatchStyleList?styleNo=JJG64886` 对应款式 ID 3 返回 2 张模特图和 4 张动作图。提交数据存在，缺失的是审核界面接入。

## 修复

- 动作图审核与模特图审核共用双栏布局，左侧方案素材及服饰细节对照，右侧当前节点已提交图片；动作图素材池额外提供已提交模特图参考。
- 动作图结果只读取当前款式的 `aiActionImageUrls`，模特图仍读取 `aiModelImageUrls`。模糊查询按款式 ID 与款号匹配，避免其他款式图片混入。
- 校验提示、确认弹层、空态和成功提示按图片类型显示。
- 通过/驳回提交实际审核节点的 `nodeKey/procInstId/nodeTaskId`，提交前仍检查当前员工权限、分配关系及节点状态。
- 移除动作图审核的重复通用“审核任务”入口，沿用专用审核意见及附件表单。

## 验证

应用类型检查、修改文件 ESLint、差异空白检查通过；共享浏览器脚本分别以模特图与动作图模式执行并通过。覆盖多款式、多图、图片类型隔离、缺图驳回、必填意见、附件上传、失败保留输入、审批期间路由保护、状态变化拦截、员工权限和冻结只读。

脚本：`docs/testing/model-audit-workspace-2026-10-22/browser.mjs`，设置 `DRAWING_AUDIT_KIND=action` 验证动作图，设为 `model` 验证模特图。动作图的截图和请求记录保存在 `docs/testing/action-audit-workspace-2026-10-23/`。

审核写入均由浏览器模拟接口完成，未对真实任务执行通过或驳回。
