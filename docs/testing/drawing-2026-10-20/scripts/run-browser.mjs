import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const suites=[["all-nodes.mjs","all-nodes"],["codex-prototype-implementation-check.mjs","implementation"],["codex-prototype-employee-check.mjs","employee"],["codex-batch-assign-check.mjs","batch"],["codex-material-download-check.mjs","material"],["codex-drawing-admin-check.mjs","admin"],["codex-super-admin-flow-check.mjs","super-admin"],["state-and-errors.mjs","state"],["replay-live.mjs","replay"]];
const results=[];for(const [script,name]of suites){const r=spawnSync(process.execPath,[fileURLToPath(new URL(script,import.meta.url))],{encoding:'utf8',timeout:240000,env:process.env});const output=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(new URL('../evidence/'+name+'.txt',import.meta.url),output);results.push({script,exitCode:r.status,error:r.error?.message});console.log(name,r.status===0?'PASS':'FAIL');}
fs.writeFileSync(new URL('../evidence/browser-rerun.json',import.meta.url),JSON.stringify(results,null,2));if(results.some(r=>r.exitCode!==0))process.exitCode=1;
