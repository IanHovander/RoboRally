import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const {chromium}=createRequire(import.meta.url)('C:/Users/Ian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(pathToFileURL(path.join(dir,'standalone.html')).href);
await page.locator('[data-play]').click();
if(await page.locator('canvas').count()!==40)throw Error('Awards must show 40 studies');
await page.locator('[data-mode]').selectOption('studies');
if(await page.locator('canvas').count()!==15)throw Error('Scenario must show 15 studies');
for(const s of await page.locator('[data-scenario] option').evaluateAll(es=>es.map(e=>e.value))){await page.locator('[data-scenario]').selectOption(s);await page.locator('[data-time]').fill('560');}
await page.locator('[data-mode]').selectOption('ideas');
if(await page.locator('li').count()!==50)throw Error('Scenario must show 50 ideas');
await page.locator('[data-mode]').selectOption('awards');
for(const width of [320,736,1100]){await page.setViewportSize({width,height:900});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('Horizontal overflow at '+width);}
console.log(JSON.stringify({awards:40,studiesPerScenario:15,ideasPerScenario:50,scenarios:20,widths:[320,736,1100],errors}));
if(errors.length)process.exitCode=1;
if(process.argv[2])await page.screenshot({path:process.argv[2],fullPage:false});
}finally{await browser.close()}
