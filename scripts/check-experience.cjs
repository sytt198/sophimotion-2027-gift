const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),timeout:20000});
 const errors=[],checks=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5197/'),{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.body.dataset.ready==='true');
  const diag=()=>page.evaluate(()=>window.giftExperience.diagnostics());
  let d=await diag();assert.equal(d.lidAngles.left,0);assert.equal(d.lidAngles.right,0);assert.equal(d.pullTabs,0);assert.deepEqual(d.assets,{pen:'CAD',car:'CAD'});checks.push('真实CAD加载、闭盒、无拉带');
  await page.waitForTimeout(600);await page.screenshot({path:path.join(root,'preview-final-hero.png')});
  await page.click('#start-button');await page.waitForTimeout(3650);d=await diag();assert(d.lidAngles.left>0&&d.lidAngles.left<180);assert.equal(d.lidAngles.right,0);checks.push('左盖先开启，完整S归属左盖');assert.equal(d.emblemParent,'left-lid-only');
  await page.click('#play-button');const paused=(await diag()).progress;await page.waitForTimeout(300);assert(Math.abs((await diag()).progress-paused)<.003);checks.push('自动播放与暂停');
  await page.click('#explore-nav');d=await diag();assert.equal(d.lidAngles.left,180);assert.equal(d.lidAngles.right,180);assert.equal(d.explore,true);checks.push('双盖180度和探索模式');
  await page.screenshot({path:path.join(root,'preview-final-open.png')});
  for(const id of ['calendar','car','pen','keychain']){await page.click(`[data-product="${id}"]`);assert.equal((await diag()).focused,id);}
  await page.click('[data-product="keychain"]');d=await diag();assert.equal(d.focused,null);assert.equal(d.explore,true);checks.push('四产品切换及取消后旋转状态');
  await page.click('#close-box');await page.waitForTimeout(3250);d=await diag();assert.equal(d.lidAngles.left,0);assert.equal(d.lidAngles.right,0);assert.equal(d.explore,true);checks.push('合盒完成保持关闭');
  await page.click('#close-box');await page.waitForTimeout(250);await page.click('#reset-view');await page.waitForTimeout(3000);d=await diag();assert.equal(d.progress,1);assert.equal(d.explore,true);checks.push('开合过程中重置取消旧动画');
  await page.click('#close-box');await page.waitForTimeout(200);await page.click('#story-nav');await page.waitForTimeout(3300);d=await diag();assert.equal(d.progress,0);assert.equal(d.explore,false);checks.push('开合过程中导航取消旧动画');
  for(const viewport of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
   await page.setViewportSize(viewport);await page.click('#explore-nav');await page.waitForTimeout(200);
   const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('.bottom-bar button,#reset-view,#close-box')].filter(b=>b.getClientRects().length).map(b=>{const r=b.getBoundingClientRect();return {text:b.textContent,x:r.x,y:r.y,bottom:r.bottom,right:r.right};})}));
   assert.equal(layout.overflow,false,JSON.stringify(viewport));for(const c of layout.controls){assert(c.x>=0&&c.y>=0&&c.right<=viewport.width+1&&c.bottom<=viewport.height+1,JSON.stringify({viewport,c}));}
   if(viewport.width===390)await page.screenshot({path:path.join(root,'preview-final-mobile.png')});
  }checks.push('390×844、320×568、844×390 无溢出且控制可见');
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.click('#explore-nav');await page.click('#close-box');await page.waitForTimeout(80);assert.equal((await diag()).progress,0);checks.push('减少动态效果时即时切换');
  if(fs.existsSync(path.join(root,'dist/assets/2027-gift-box.mp4'))){await page.click('.bottom-bar [data-open-video]');await page.waitForFunction(()=>document.querySelector('video').readyState>=2);const media=await page.evaluate(()=>{const v=document.querySelector('video');return {duration:v.duration,width:v.videoWidth,height:v.videoHeight,error:v.error?.message};});assert(media.duration>=10&&media.width>=1280&&!media.error);checks.push(`视频可播放 ${media.width}×${media.height} / ${media.duration}s`);await page.click('#close-video');assert(await page.$eval('video',v=>v.paused));}
  assert.deepEqual(errors,[]);checks.push('无页面JavaScript错误');const report={passed:true,checks,errors};fs.writeFileSync(path.join(root,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
