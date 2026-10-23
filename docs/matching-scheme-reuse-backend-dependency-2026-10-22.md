# 应用辅服饰 AI 图片

更新：2026-10-23。原接口依赖已解除，用户确认仅复用 `aiModelImageUrls` 和 `aiActionImageUrls`。

辅服饰的 `aiModelImageUrls` 或 `aiActionImageUrls` 至少一组有图片时显示“应用AI搭配方案”按钮，两组均为空时隐藏；已移除对旧标记字段的依赖。点击重新调用 `GET /admin-api/flycowerp/newProductStyle/queryMatchStyleList?styleNo=...`，按款号、款式 ID 和服饰图地址核对结果，避免模糊查询匹配到其他款式。

将模特图、动作图按原图地址去重后填入空白的“AI生成图片”区域，保留原图、预览图、缩略图，并设置来源辅服饰款号和 `isMain=0`。该区域已有图片时保留全部原内容，不追加或替换。其他素材字段、主辅服饰和方案身份均不变。

应用结果随整体方案保存到通用流程草稿，重开后恢复；提交仍执行原有必填校验。查询失败可重试，款式匹配不唯一或没有可复用图片时提示原因并保留现有方案。

测试代码：`apps/web-antd/src/views/aigc/launch/matching-scheme-apply.test.ts` 和 `docs/testing/matching-style-search-2026-10-22/browser.mjs`。

验证通过：5 项合并逻辑测试、应用类型检查、修改文件 ESLint，以及本地浏览器模拟接口回归。浏览器覆盖模糊查询、精确匹配辅服饰、查询失败重试、模特图和动作图去重、已有图片保留、草稿保存并重开恢复；未写入真实业务任务。

移除标记字段后的回归通过：接口不返回旧标记，仅模特图有数据、仅动作图有数据时显示应用按钮；两组为空、为 `null` 或缺失时隐藏。两组都有图片时仍支持合并去重、保留已有内容及草稿恢复。
