import fs from 'node:fs/promises';
const base=process.env.DRAWING_API_BASE || 'http://192.168.0.140:48080';
const token=process.env.DRAWING_TEST_TOKEN;
if(!token) throw Error('Set DRAWING_TEST_TOKEN to a test environment token');
const dir=new URL('../evidence/',import.meta.url);
const evidence={startedAt:new Date().toISOString(),base,mode:'live-readonly',records:[]};
async function read(path,body){
 const method=body?'POST':'GET';const begin=Date.now();
 try{
 const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'tenant-id':'1',...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
 const raw=await r.text();let response;try{response=JSON.parse(raw);}catch{response={nonJson:raw.slice(0,160),bytes:raw.length};}
 const record={method,path,...(body?{request:body}:{}),status:r.status,ms:Date.now()-begin,contentType:r.headers.get('content-type'),response};evidence.records.push(record);return response;
 }catch(e){const record={method,path,error:e.message};evidence.records.push(record);return {};}
}
const schema=await read('/v3/api-docs/flycowerp');
if(schema.paths){await fs.writeFile(new URL('swagger.json',dir),JSON.stringify(schema,null,2));evidence.records[0].response={pathCount:Object.keys(schema.paths).length};}
const info=await read('/admin-api/system/auth/get-permission-info');
if(info.data) evidence.records.at(-1).response={code:info.code,userId:info.data.user?.id,roles:info.data.roles,permissionCount:info.data.permissions?.length,drawingPermissions:info.data.permissions?.filter(x=>x.startsWith('flycowerp:drawing:')),wildcard:info.data.permissions?.includes('*:*:*')};
const page=await read('/admin-api/flycowerp/newProductTask/page',{pageNo:1,pageSize:100});
const tasks=page.data?.list??[];
const nodes=['aiMatchingOutput','aiMatchingAudit','aiImageTaskDispatch','aiImageModelTask','aiImageModelAudit','aiImageActionTask','aiImageActionAudit','retouchTaskDispatch','retouching','retouchingAudit','pageTaskDispatch','pageProduction','pageProductionAudit','launchTaskDispatch','launchAudit'];
for(const key of nodes) await read('/admin-api/flycowerp/newProductTask/page',{pageNo:1,pageSize:10,flowNodeKey:key});
for(const t of tasks.slice(0,5)){
 await read('/admin-api/flycowerp/newProductTask/get/'+t.id);
 await read('/admin-api/flycowerp/aiMatchingScheme/list?taskId='+t.id);
 await read('/admin-api/flycowerp/newProductStyle/list?taskId='+t.id);
 await read('/admin-api/flycowerp/flow/nodeDetailList?businessType=0&businessKey='+t.id);
 if(t.procInstId)await read('/admin-api/flycowerp/flow/transferRecordList?procInstId='+encodeURIComponent(t.procInstId));
 if(t.procInstId&&t.currentNodeTaskId&&t.currentNodeKey)await read('/admin-api/flycowerp/newProductStyle/downloadMaterials?'+new URLSearchParams({procInstId:t.procInstId,nodeTaskId:t.currentNodeTaskId,nodeKey:t.currentNodeKey}));
 await read('/admin-api/flycowerp/aiImageResult/dropdown/'+t.id);
}
evidence.finishedAt=new Date().toISOString();
await fs.writeFile(new URL('live-readonly.json',dir),JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence.records.map(r=>({method:r.method,path:r.path,status:r.status,code:r.response?.code,msg:r.response?.msg,total:r.response?.data?.total,listLength:Array.isArray(r.response?.data)?r.response.data.length:r.response?.data?.list?.length,error:r.error})),null,2));
