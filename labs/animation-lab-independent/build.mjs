import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(fs.readFileSync(path.join(dir,'ideas.json'),'utf8'));
const scenarios=Array.isArray(data)?data:data.scenarios;
const awards=JSON.parse(fs.readFileSync(path.join(dir,'awards.json'),'utf8'));
if(scenarios.length!==20)throw Error('Expected 20 scenarios');
for(const s of scenarios){if(s.ideas.length!==50||s.selected.length!==5)throw Error('Incomplete '+s.id);if(new Set(s.ideas.map(i=>i.id)).size!==50)throw Error('Duplicate IDs '+s.id);for(const id of s.selected)if(!s.ideas.some(i=>i.id===id))throw Error('Missing selected '+id);if(!awards[s.id])throw Error('Missing awards '+s.id)}
const renderers=['mechanical','paper','cinematic'].map(x=>fs.readFileSync(path.join(dir,x+'.js'),'utf8')).join('\n');
const escape=x=>JSON.stringify(x).replaceAll('<','\\u003c');
const html=fs.readFileSync(path.join(dir,'gallery.html'),'utf8').replace('__RENDERERS__',()=>renderers).replace('__DATA__',()=>escape(scenarios)).replace('__AWARDS__',()=>escape(awards));
const out=process.argv[2]||path.join(dir,'preview.html');
fs.writeFileSync(out,html);
const preview=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Independent Robo Rally animation studies</title><style>:root{color-scheme:dark;--background:#12232c;--foreground:#eef5ef;--muted-foreground:#9bb0ad;--border:#34515b;--blue:#6bdcd6;--orange:#fbb46a;--green:#c0d889;--red:#f27988;--primary:#eef5ef;--primary-foreground:#12232c}body{background:var(--background);color:var(--foreground);font:16px/1.45 system-ui;margin:24px auto;padding:0 20px;max-width:1024px}button,input,select{font:inherit}select,button{background:#243a44;color:var(--foreground);padding:10px;border:1px solid var(--border);border-radius:6px}label{display:block}.form-select,.form-range{display:block;width:100%;box-sizing:border-box}.text-small{font-size:14px}h3{font-weight:500}</style>${html}</html>`;
fs.writeFileSync(path.join(dir,'standalone.html'),preview);
if(Buffer.byteLength(html)>1e6)throw Error('Fragment exceeds 1 MB');
console.log(`${scenarios.length*50} ideas, ${scenarios.length*5*3} animated studies, ${Object.keys(awards).length*2} award selections. ${Buffer.byteLength(html)} bytes. ${out}`);
