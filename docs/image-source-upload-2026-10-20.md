# 图片生成原图/参考图上传（2026-10-20）

新建和编辑图片生成表单将原图、预览原图、参考图、预览参考图的手工地址输入替换为图片区。原图可上传、替换、预览和移除；参考图可多选上传、预览、前后移动和移除。

调用 `POST /admin-api/flycowerp/temp-image/upload`，通过现有带认证的 requestClient 以 multipart/form-data 上传 `file`。只有成功返回完整三级地址后，才更新表单对象；失败或地址缺失时保留原有图片，可重新选择上传。

| 上传返回 | 原图保存字段 | 参考图保存字段 |
| --- | --- | --- |
| originalUrl | originalImg | referenceImg |
| previewUrl | previewOriginalImg | previewReferenceImg |
| thumbnailUrl | smallOriginalImg | smallReferenceImg |

参考图按选择顺序串行上传，三个字段都按同一图片顺序以逗号连接；移动和移除时作为同一组操作。界面显示缩略图，点击查看预览图，缺少预览/缩略图的旧数据回退使用原图。保留原有保存/更新接口及暂存、生成状态含义。

上传期间禁用暂存、生成、关闭弹窗及页面路由切换；保存失败保留已上传图片。选择提示词自带参考图时清除之前的预览/缩略图地址，避免显示旧图。

验证：模拟浏览器覆盖 multipart 文件和认证头、上传期间阻止提交/关闭/跳转、多图顺序、排序/移除后的六字段映射、失败与不完整响应保留、非图片阻止、保存失败重试、新建/编辑回显、旧数据回退、预览及生成请求；浏览器无运行时异常。TypeScript、ESLint、格式检查、生产打包通过。没有调用真实收费生图。

复测（在项目根目录、开发服务默认 5666 端口运行）：

```powershell
node docs/testing/image-source-upload-2026-10-20/scripts/browser.mjs
```

测试复用前次制图测试的浏览器基础工具，所有上传、保存和生成请求均模拟；[请求与断言证据](./testing/image-source-upload-2026-10-20/evidence/browser.json)、[页面截图](./testing/image-source-upload-2026-10-20/evidence/editor-upload.png)。截图图片为测试占位图。
