const {createServer}=require('node:http'),{readFile}=require('node:fs/promises'),{join,extname}=require('node:path'),assert=require('node:assert/strict');
(async()=>{
const chromium=require('/tmp/v-browser/node_modules/@sparticuz/chromium'), puppeteer=require('/tmp/v-browser/node_modules/puppeteer-core');
const server=createServer(async(req,res)=>{try{const p=decodeURI(req.url.split('?')[0]);const body=await readFile(join('public',p));res.setHeader('content-type',({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp'})[extname(p)]||'text/plain');res.end(body)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await puppeteer.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:true});try{
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('http://127.0.0.1')?r.continue():r.abort());
await page.goto('http://127.0.0.1:'+server.address().port+'/victories/index.html',{waitUntil:'domcontentloaded'});
await page.waitForSelector('.v-caption strong',{timeout:6000});
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
for(const width of [360,390,430])for(const count of [6,9]){
await page.setViewport({width,height:800});await page.select('#cap',String(count));await page.click('[data-p=s]');
await page.waitForFunction(n=>document.querySelectorAll('#app .seat').length===n&&document.querySelector('#ledger')?.textContent.includes('498'),{},count);
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
assert.equal(await page.$$eval('.v-amount',els=>els.length),2);
const layout=await page.evaluate(()=>{const box=e=>e.getBoundingClientRect(),c=box(document.querySelector('.v-caption')),ss=[...document.querySelectorAll('.seat .box')].map(box);return {outside:ss.some(r=>r.left<-.1||r.right>innerWidth+.1),overlap:ss.some(r=>c.left<r.right&&c.right>r.left&&c.top<r.bottom&&c.bottom>r.top)}});
assert(!layout.outside);if(layout.overlap)throw Error('Result overlaps a seat '+width+' '+count);
console.log('VIEWPORT_PASS',width,count,'odd split + side, reduced motion')}
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
await page.click('[data-p=a]');await page.waitForFunction(()=>document.querySelector('.v-caption')?.textContent.includes('Culoare'));await page.waitForSelector('.v-art text');await page.click('[data-p=n]');await page.waitForSelector('.v-orbit');await page.waitForSelector('.v-amount');for(let k=0;k<10;k++){await page.select('#mode','normal');await page.select('#kind',String(k));await page.waitForFunction(()=>document.querySelector('.v-art')!==null);assert.equal(await page.$$eval('.v-summary .v-card',els=>els.length),5)}
await page.evaluate(async()=>{const {present,clearVictory}=await import('/victories/live.mjs');const fixtures=await (await fetch('/victories/hands-9.json')).json();const st=fixtures['4-allin'];st.handNo=800;clearVictory();const prior=structuredClone(st);prior.hand.done=false;prior.lastResult=null;present(prior);present(st);present(st);window.testResult=st});
await page.waitForSelector('.v-amount');await page.evaluate(async()=>{const m=await import('/victories/live.mjs');m.present(window.testResult);const s=structuredClone(window.testResult);s.handNo++;s.hand.done=false;s.lastResult=null;m.present(s)});assert.equal(await page.$$eval('.v-layer',els=>els.length),0);
assert.deepEqual(errors,[]);console.log('BROWSER_PASS ten effects, next hand cleanup, repeated state, three presets, real seats, no page errors');
await page.goto('http://127.0.0.1:'+server.address().port+'/victories/index.html?tur=1',{waitUntil:'domcontentloaded'});
await page.waitForSelector('.v-amount');await page.click('#tourPlay');const frozen=await page.$eval('#scenes',e=>e.value);await new Promise(r=>setTimeout(r,5200));assert.equal(await page.$eval('#scenes',e=>e.value),frozen);await page.click('#tourPlay');await page.waitForFunction(()=>document.querySelector('#scenes').value==='1',{timeout:7000});
for(let i=0;i<17;i++){await page.select('#scenes',String(i));await page.waitForSelector('.v-caption strong');assert(await page.$eval('.v-caption strong',e=>e.textContent.length>0))}
await page.waitForFunction(()=>document.querySelector('#tourPlay').textContent==='Reia turul',{timeout:15000});assert.deepEqual(errors,[]);console.log('TOUR_PASS 17 scenes, autoplay, pause/resume, selection, last payout and stop');
console.log('BROWSER_PASS three presets, real seats, no page errors');
}finally{await browser.close();server.close()}})().catch(e=>{console.error(e);process.exit(1)});
