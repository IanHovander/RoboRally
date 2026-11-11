import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const dir=path.dirname(fileURLToPath(import.meta.url));
const qaDir=process.argv[2]||path.join(dir,'qa');
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/Ian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
const page=await browser.newPage({viewport:{width:1200,height:1500},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const raw=JSON.parse(fs.readFileSync(path.join(dir,'ideas.json'),'utf8'));
const data=Array.isArray(raw)?raw:raw.scenarios;
const scripts=['mechanical','paper','cinematic'].filter(x=>fs.existsSync(path.join(dir,x+'.js'))).map(x=>fs.readFileSync(path.join(dir,x+'.js'),'utf8')).join('\n');
await page.setContent('<body style="margin:0;background:#101d25;color:#eff9f8;font:16px sans-serif"><main></main></body>');
await page.addScriptTag({content:scripts});
const result=await page.evaluate(data=>{
 const artists=[globalThis.RRMechanical,globalThis.RRPaper,globalThis.RRCinematic].filter(Boolean),p={bg:'#06080b',fg:'#f4efe4',muted:'#52535a',line:'#343740',robot:'#7aa8ff',other:'#ff7a6b',accent:'#ffc56e',danger:'#ff4a3a'};
 const canvas=document.createElement('canvas');canvas.width=400;canvas.height=240;const ctx=canvas.getContext('2d');
 const issues=[];let frames=0;const signatures=[];
 for(const [a,artist] of artists.entries())for(const s of data)for(let i=0;i<5;i++){
 const samples=[];for(const t of [0,.15,.3,.45,.6,.75,.85,1]){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,400,240);ctx.save();try{artist.draw(ctx,s.id,i,t,p);frames++;samples.push(canvas.toDataURL())}catch(e){issues.push(`${artist.name}/${s.id}/${i}/${t}: ${e.message}`)}ctx.restore()}
 if(new Set(samples).size<3)issues.push(`Insufficient motion ${artist.name}/${s.id}/${i}`);
 if(samples[6]!==samples[7])issues.push(`Final pose is not held ${artist.name}/${s.id}/${i}`);
 signatures.push({artist:a,scenario:s.id,idea:i,signature:samples[4],sequence:samples.join('|')});
 }
 window.qa={data,artists,p};
 const duplicateSequences=signatures.filter((v,i,a)=>a.findIndex(x=>x.sequence===v.sequence)!==i).map(({artist,scenario,idea})=>({artist,scenario,idea}));
 if(duplicateSequences.length)issues.push('Identical animation sequences: '+JSON.stringify(duplicateSequences));
 return {frames,issues,duplicateMidFrames:signatures.filter((v,i,a)=>a.findIndex(x=>x.signature===v.signature)!==i).map(({artist,scenario,idea})=>({artist,scenario,idea})),duplicateSequences};
},data);
fs.mkdirSync(qaDir,{recursive:true});
for(const s of data){
 await page.evaluate(id=>{const {data,artists,p}=window.qa,s=data.find(s=>s.id===id),main=document.querySelector('main');main.replaceChildren();const h=document.createElement('h2');h.textContent=s.title;h.style.margin='16px';main.append(h);const grid=document.createElement('div');grid.style=`display:grid;grid-template-columns:repeat(${artists.length},400px)`;main.append(grid);for(let i=0;i<5;i++)for(let a=0;a<artists.length;a++){const cell=document.createElement('div'),label=document.createElement('div');label.textContent=`${i+1} · ${s.ideas.find(x=>x.id===s.selected[i]).title} · ${artists[a].name}`;label.style='height:40px;padding:4px 10px;box-sizing:border-box';const c=document.createElement('canvas');c.width=400;c.height=240;artists[a].draw(c.getContext('2d'),id,i,.56,p);cell.append(label,c);grid.append(cell)}},s.id);
 await page.screenshot({path:path.join(qaDir,s.id+'.png'),fullPage:true});
}
await page.setViewportSize({width:1600,height:1500});
for(let offset=0;offset<data.length;offset+=4){
 await page.evaluate(offset=>{const {data,artists,p}=window.qa,artist=artists.at(-1),main=document.querySelector('main');main.replaceChildren();const grid=document.createElement('div');grid.style='display:grid;grid-template-columns:repeat(4,400px)';main.append(grid);for(let i=0;i<5;i++)for(const s of data.slice(offset,offset+4)){const cell=document.createElement('div'),label=document.createElement('div');label.textContent=`${s.id} · ${i+1} · ${s.ideas.find(x=>x.id===s.selected[i]).title}`;label.style='height:40px;padding:4px 10px;box-sizing:border-box';const c=document.createElement('canvas');c.width=400;c.height=240;artist.draw(c.getContext('2d'),s.id,i,.52,p);cell.append(label,c);grid.append(cell)}},offset);
 await page.screenshot({path:path.join(qaDir,'last-artist-'+offset+'.png'),fullPage:true});
}
result.browserErrors=errors;fs.writeFileSync(path.join(qaDir,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
if(result.issues.length||errors.length)process.exitCode=1;
}finally{await browser.close()}
