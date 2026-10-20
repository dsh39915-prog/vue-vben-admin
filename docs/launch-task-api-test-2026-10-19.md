# 上新任务接口实测报告（2026-10-19）

测试环境：`http://192.168.0.140:48080/admin-api`。时间均为北京时间。

按最终确认范围，测试分页、详情、更新、启用、终止、删除 6 个接口，累计 137 次真实请求。新建不接入，Excel 导入按用户要求暂停，二者不计入本次验收结论。另通过浏览器模拟回归前端行为；模拟通过不能代表后端业务通过。

结论：基础详情读取、业务字段更新和局部更新正常；启用、删除、部分列表查询和异常处理存在可复现问题，当前不能认定六个接口全部通过。

## 接口结果

| 接口 | 结果 | 主要证据 |
| --- | --- | --- |
| POST /flycowerp/newProductTask/page | 部分通过 | 13 类筛选匹配/排除正常；流程状态、节点计划完成时间未生效；页面只包含已终止任务时返回业务码 500 |
| GET /flycowerp/newProductTask/get/{id} | 通过已测场景 | 正常返回任务字段，不存在 ID 返回 code=0、data=null |
| PUT /flycowerp/newProductTask/update | 部分通过 | 业务/逾期字段、数字 0、局部更新及空字符串描述回写正常；null 无法清空字段；不存在 ID 返回成功 |
| PUT /flycowerp/newProductTask/enable/{id} | 未通过 | 返回成功但 flowStatus 仍为 0，重复启用新建流程实例 |
| PUT /flycowerp/newProductTask/terminate/{id} | 部分通过 | 将测试任务显式设为状态 1 后，终止成功并回写 5；正常启用后的状态仍为 0，导致终止失败；不存在 ID 返回 500 |
| DELETE /flycowerp/newProductTask/delete/{id} | 未通过 | 返回 true，但详情和列表仍能查询到记录 |

所有已取得的业务响应 HTTP 状态均为 200；本文的 400/500 指响应体的业务 code。

## 问题与复现

### 1. 启用未更新状态，重复启用产生新流程（优先处理）

测试任务 ID=3，款号 JQG000002，初始 flowStatus=0。

1. PUT /flycowerp/newProductTask/enable/3，无请求体，返回 {"code":0,"msg":"","data":true}。
2. GET /flycowerp/newProductTask/get/3，flowStatus 仍为 0，procInstId 已改变。
3. 再次启用仍返回成功，procInstId 再次改变。
4. PUT /flycowerp/newProductTask/terminate/3 返回 {"code":400,"msg":"流程未启动，请勿重复操作！","data":null}。

| 步骤         | procInstId                           | flowStatus |
| ------------ | ------------------------------------ | ---------- |
| 导入后       | 7e4de498-cb8c-11f1-ae74-00e04c7b5301 | 0          |
| 第一次启用后 | bd663ca9-cb8c-11f1-ae74-00e04c7b5301 | 0          |
| 第二次启用后 | bda4a54a-cb8c-11f1-ae74-00e04c7b5301 | 0          |

对照测试：通过更新接口将该测试任务 flowStatus 设为 1 后，再启用会正确返回“流程已启动，请勿重复操作！”，且不改变 procInstId；终止可成功回写 flowStatus=5。说明启用接口的成功返回与状态转换不一致，需要后端检查。

### 2. 删除返回成功，但记录仍存在（优先处理）

对已终止的测试任务 ID=2、3 分别调用 DELETE /flycowerp/newProductTask/delete/{id}，均返回 {"code":0,"msg":"","data":true}。

随后 GET 详情仍返回完整记录，POST 分页仍包含两条测试记录；再次删除 ID=3 仍返回 true，结果不变。无论预期为物理删除还是逻辑删除，普通管理查询均未将其排除。

### 3. 列表结果只含已终止任务时返回系统异常（优先处理）

测试任务 ID=2、3 已为 flowStatus=5，原有 ID=1 保持 flowStatus=0。

以下请求均为 POST /flycowerp/newProductTask/page：

| 请求体                                           | 实际返回                  |
| ------------------------------------------------ | ------------------------- |
| {"pageNo":1,"pageSize":10,"styleNo":"JQG000001"} | code=500，msg=系统异常    |
| {"pageNo":1,"pageSize":10,"styleNo":"JQG000002"} | code=500，msg=系统异常    |
| {"pageNo":1,"pageSize":10,"styleNo":"JQG00000"}  | code=500，msg=系统异常    |
| {"pageNo":1,"pageSize":1}                        | code=500，msg=系统异常    |
| {"pageNo":2,"pageSize":1}                        | code=500，msg=系统异常    |
| {"pageNo":1,"pageSize":2}                        | code=500，msg=系统异常    |
| {"pageNo":3,"pageSize":1}                        | 成功，仅原有未终止的 ID=1 |
| {"pageNo":1,"pageSize":10}                       | 成功，包含 ID=3、2、1     |
| {"pageNo":2,"pageSize":10}                       | 成功，空列表、total=3     |

该表现与结果中是否包含未终止任务相关，具体异常原因需要服务端日志确认，不能仅归因为分页尺寸。

### 4. 流程状态筛选未生效

POST /flycowerp/newProductTask/page：

```json
{
  "pageNo": 1,
  "pageSize": 100,
  "styleNo": "JQG65453",
  "flowNodeKey": "aiImageModelTask",
  "flowStatus": 5
}
```

实际返回 ID=1，flowStatus=0、currentNodeStatus=0，total=1。按状态 5 查询应排除该记录。不传 flowNodeKey 时同样未排除，已在测试环境重启后复测。

### 5. 节点计划完成时间筛选未生效

POST /flycowerp/newProductTask/page：

```json
{
  "pageNo": 1,
  "pageSize": 100,
  "styleNo": "JQG65453",
  "flowNodeKey": "aiImageModelTask",
  "flowNodePlanEndTimes": ["2099-01-01 00:00:00", "2099-01-02 00:00:00"]
}
```

仍返回 currentNodePlanEndTime=null 的 ID=1，total=1。该记录不应落入 2099 年的查询区间。不传 flowNodeKey 时结果相同，已复测。

### 6. 更新 null 无法清空字段

先对 ID=3 设置 launchTime、productDeadline、visualLevel，回读确认保存成功；再 PUT /flycowerp/newProductTask/update：

```json
{ "id": 3, "launchTime": null, "productDeadline": null, "visualLevel": null }
```

返回成功，但回读仍为：

```json
{
  "launchTime": "2026-10-30 10:00:00",
  "productDeadline": "2026-11-01 18:00:00",
  "visualLevel": 0
}
```

Swagger 未定义清空协议；当前页面允许清空并提交 null，因而与后端实际行为不匹配。需后端明确支持清空的字段与请求方式。未提交字段保留原值的局部更新行为本身正常。

### 7. 更新不存在任务返回成功

PUT /flycowerp/newProductTask/update：

```json
{ "id": 2147483647, "category": "接口测试品类" }
```

返回 {"code":0,"msg":"","data":true}。相同 ID 的 GET 详情为 null。建议更新前检查存在性，或依据更新行数返回业务错误，避免界面误报保存成功。

### 8. 启用、终止不存在任务返回系统异常

PUT /flycowerp/newProductTask/enable/2147483647 和 PUT /flycowerp/newProductTask/terminate/2147483647 均返回 {"code":500,"msg":"系统异常","data":null}，应明确返回任务不存在的业务错误。

## 已验证正常的场景

- 款号、开发年份季节、品类、主推平台、视觉层级、日期逾期、耗时逾期、处理人 ID、节点 Key，以及上新时间、流程开始时间、商品要求货期、创建时间共 13 类筛选，匹配和排除行为正常。
- 耗时逾期查询按 Swagger 使用字符串 "0"/"1"，其他状态为数字；数字 0 可正确保存与查询。
- 详情与更新后的业务字段一致；局部更新不会清空未提交字段；逾期描述可保存空字符串。
- 缺少更新 ID、非法分页参数、错误日期格式可返回参数错误。
- 草稿终止被拒绝；状态 1 的测试任务可终止到 5；重复终止、终止后启用均被拒绝。
- 不存在记录的详情返回 null。

## 测试数据与清理结果

| ID  | 款号      | 最终状态 | 清理结果                           |
| --- | --------- | -------- | ---------------------------------- |
| 1   | JQG65453  | 原状     | 测试前后比对一致，没有修改原有任务 |
| 2   | JQG000001 | 5 已终止 | 删除返回成功但记录仍在，需后端清理 |
| 3   | JQG000002 | 5 已终止 | 删除返回成功但记录仍在，需后端清理 |

ID=2、3 在暂停导入指令到达之前由本次导入调用生成。接到暂停指令后未再调用导入或新建。为测试终止并清理当前关联流程，曾仅对这两个测试任务通过更新接口显式设 flowStatus=1，再终止为 5。

当前关联流程 3505ac57-cb8c-11f1-ae74-00e04c7b5301（ID=2）和 bda4a54a-cb8c-11f1-ae74-00e04c7b5301（ID=3）已收到终止成功响应。ID=3 的前两个流程实例 7e4de498-cb8c-11f1-ae74-00e04c7b5301、bd663ca9-cb8c-11f1-ae74-00e04c7b5301 已被后续启用覆盖关联；现有六个接口无法单独查询或清理这些旧流程实例，需后端核对其残留状态并清理。

## 前端范围与验证

已移除手动新建、Excel 导入入口及相关调用，保留六个当前接口。浏览器模拟回归覆盖查询、编辑、错误重试、启用/终止/删除确认和新建/导入入口不存在；ESLint、TypeScript 类型检查及页面模拟回归均通过。

详细请求、响应、UTC 原始时间戳及测试前后快照见 [实测证据 JSON](./launch-task-api-test-2026-10-19-evidence.json)，其中未包含认证头或 Token。
