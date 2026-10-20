import fs from 'node:fs/promises';
const base=process.env.DRAWING_API_BASE||'http://192.168.0.140:48080',token=process.env.DRAWING_TEST_TOKEN;if(!token)throw Error('Set DRAWING_TEST_TOKEN');
const evidence=[];const headers={Authorization:'Bearer '+token,'tenant-id':'1','content-type':'application/json'};
for(const id of ['1','999999']){
 const body={pageNo:1,pageSize:10,flowNodeKey:'aiImageModelTask',currentAssigneeId:id};const r=await fetch(base+'/admin-api/flycowerp/newProductTask/page',{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});evidence.push({case:'assignee-filter',request:body,status:r.status,response:await r.json()});
}
const snapshot=JSON.parse(await fs.readFile(new URL('../evidence/live-readonly.json',import.meta.url),'utf8'));
const schemes=snapshot.records.find(r=>r.path.endsWith('aiMatchingScheme/list?taskId=1')).response.data;
const urls=[...new Set(schemes.map(s=>JSON.parse(s.aiMatchingImageUrl).originalUrl))];
for(const url of urls){try{const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(20000)});evidence.push({case:'scheme-image-reachable',method:'HEAD',url,status:r.status,contentType:r.headers.get('content-type')});}catch(e){evidence.push({case:'scheme-image-reachable',url,error:e.message});}}
await fs.writeFile(new URL('../evidence/live-supplement.json',import.meta.url),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence.map(e=>({...e,response:e.response?{code:e.response.code,total:e.response.data?.total}:undefined})),null,2));
