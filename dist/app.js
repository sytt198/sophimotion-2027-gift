import {createGiftScene} from './gift-scene.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const chapters=[
  {at:0,title:'把灵感，<br>装进新一年。',description:'四件日常好物，一次完整开启。',detail:'',label:''},
  {at:.14,title:'向两侧展开，<br>让惊喜登场。',description:'左盖先启，右盖随行。完整的银色 S，伴随双翼打开。',detail:'双翼 180° 展开 · 黑色盒身 · 银色边角',label:'01 / 开启'},
  {at:.43,title:'把每一天，<br>留给新想法。',description:'日历与便签并排收纳，为新一年的计划留一处位置。',detail:'2027 日历 · 可折叠底座 · 便签区',label:'02 / 日历'},
  {at:.57,title:'让灵感，<br>向前一步。',description:'蓝白拼搭小车，在桌面上延续创造的乐趣。',detail:'四轮造型 · 108 × 101 × 60.64 mm',label:'03 / 小车'},
  {at:.69,title:'落在纸上，<br>带在身边。',description:'一支 3D 打印笔，一枚 NFC 钥匙扣。让灵感从桌面延伸到日常。',detail:'141 mm 造型笔 · 蓝白 NFC 钥匙扣',label:'04 / 随行'},
  {at:.87,title:'每一件，<br>都恰到好处。',description:'四件产品，各归其位。克莱因蓝点亮黑色内托，指槽让拿取更从容。',detail:'2027 / SOPHIMOTION',label:'05 / 完整礼盒'}
];
const productInfo={calendar:{title:'为每一天，<br>留下新想法。',text:'日历、便签与折叠底座，组成桌面上的灵感角落。',detail:'收纳尺寸拟定 170 × 130 × 22 mm'},car:{title:'蓝白之间，<br>向前出发。',text:'四只蓝色轮胎、白色轮毂，保留你的小车外观与建模比例。',detail:'CAD 尺寸 108 × 101 × 60.64 mm'},pen:{title:'把想法，<br>握在手里。',text:'流线造型的 3D 打印笔，以克莱因蓝呼应整套礼盒。',detail:'CAD 尺寸 141 × 16.42 × 13.53 mm'},keychain:{title:'让灵感，<br>随身而行。',text:'蓝白配色的 NFC 钥匙扣，收进专属轮廓内托。',detail:'壳体拟定 88 × 28 × 12 mm · 银色钥匙环'}};
let scene,progress=0,chapter=-1,playing=false,playFrom=0,playStart=0,exploring=false,selected=null,lastTime=0,closing=false,transitionFrame=0,transitionEpoch=0;
function cancelTransition(){transitionEpoch++;cancelAnimationFrame(transitionFrame);transitionFrame=0;}
const copy=$('.story-copy'),start=$('#start-button'),play=$('#play-button');
function updateCopy(p,force=false){
  const i=chapters.findLastIndex(x=>p>=x.at);if(i===chapter&&!force)return;chapter=i;
  const c=chapters[i];copy.classList.toggle('is-chapter',i!==0);$('.year').hidden=i!==0;$('.chapter-label').hidden=i===0;$('.chapter-label').textContent=c.label;
  $('h1').innerHTML=c.title;$('.description').textContent=c.description;$('.detail-line').hidden=!c.detail;$('.detail-line').textContent=c.detail;
  start.hidden=i>0&&i<5;start.querySelector('span').textContent=i===5?'自由探索':'开启礼盒';
  $$('.chapter-rail button').forEach((b,n)=>{if(n===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  $('#product-selector').hidden=!exploring;$('#scroll-prompt').hidden=exploring;
}
function scrollRange(){return Math.max(1,$('#story').offsetHeight-innerHeight)}
function readProgress(){return Math.max(0,Math.min(1,scrollY/scrollRange()))}
function setProgress(p){progress=Math.max(0,Math.min(1,p));scene?.setProgress(progress);$('#progress-fill').style.transform=`scaleX(${progress})`;if(!exploring)updateCopy(progress);document.body.dataset.progress=progress.toFixed(3);}
function stopPlay(){playing=false;play.querySelector('span').textContent=progress>.98?'重新播放':'自动播放';play.setAttribute('aria-label','自动播放礼盒开合');}
function goTo(p,smooth=true){cancelTransition();stopPlay();if(exploring)exitExplore();window.scrollTo({top:p*scrollRange(),behavior:smooth&&!reduce?'smooth':'instant'});if(reduce||!smooth)setProgress(p);}
function startPlay(){if(!scene)return;cancelTransition();if(exploring)exitExplore();if(playing){stopPlay();return;}playFrom=progress>.97?0:progress;playing=true;playStart=performance.now();play.querySelector('span').textContent='暂停播放';play.setAttribute('aria-label','暂停播放');}
function enterExplore(){if(!scene)return;cancelTransition();stopPlay();closing=false;exploring=true;selected=null;window.scrollTo({top:scrollRange(),behavior:'instant'});setProgress(1);scene.setExplore(true);document.body.classList.add('is-exploring');$('#explore-nav').classList.add('is-active');$('#story-nav').classList.remove('is-active');updateCopy(1,true);start.hidden=true;$('#explore-hint').hidden=false;$('#product-selector').hidden=false;$('#scroll-prompt').hidden=true;$('#close-box').textContent='合上礼盒';$$('[data-product]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});}
function exitExplore(){cancelTransition();exploring=false;selected=null;closing=false;scene?.setExplore(false);document.body.classList.remove('is-exploring');$('#explore-hint').hidden=true;$('#explore-nav').classList.remove('is-active');$('#story-nav').classList.add('is-active');updateCopy(progress,true);}
function selectProduct(id){cancelTransition();if(!exploring)enterExplore();closing=false;progress=1;$('#close-box').textContent='合上礼盒';selected=selected===id?null:id;scene.focusProduct(selected);$$('[data-product]').forEach(b=>{const active=b.dataset.product===selected;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});if(selected){const c=productInfo[selected];$('h1').innerHTML=c.title;$('.description').textContent=c.text;$('.detail-line').textContent=c.detail;$('.chapter-label').textContent='2027 / 产品细节';}else updateCopy(1,true);start.hidden=true;}
start.addEventListener('click',()=>progress>=.87?enterExplore():startPlay());play.addEventListener('click',startPlay);
$('#story-nav').addEventListener('click',()=>goTo(0));$('.brand').addEventListener('click',e=>{e.preventDefault();goTo(0)});$('#explore-nav').addEventListener('click',enterExplore);
$$('[data-progress]').forEach(b=>b.addEventListener('click',()=>goTo(Number(b.dataset.progress))));$$('[data-product]').forEach(b=>b.addEventListener('click',()=>selectProduct(b.dataset.product)));
$('#reset-view').addEventListener('click',()=>{cancelTransition();scene.setExplore(false);setProgress(1);scene.setExplore(true);selected=null;closing=false;updateCopy(1,true);start.hidden=true;$('#close-box').textContent='合上礼盒';$$('[data-product]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});});
$('#close-box').addEventListener('click',()=>{cancelTransition();const epoch=transitionEpoch;selected=null;closing=!closing;$('#close-box').textContent=closing?'打开礼盒':'合上礼盒';$$('[data-product]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});const from=progress,to=closing?0:1,stamp=performance.now();scene.setExplore(false);updateCopy(1,true);start.hidden=true;const animate=now=>{if(epoch!==transitionEpoch)return;const t=reduce?1:Math.min(1,(now-stamp)/3000);setProgress(from+(to-from)*t);scene.render();if(t<1)transitionFrame=requestAnimationFrame(animate);else{transitionFrame=0;scene.setExplore(true);if(closing){$('h1').innerHTML='让灵感，<br>好好珍藏。';$('.description').textContent='右盖先合，左盖落定。完整的银色 S，再次连接双翼。';}else updateCopy(1,true);start.hidden=true;}};transitionFrame=requestAnimationFrame(animate);});
addEventListener('scroll',()=>{if(!playing&&!exploring)setProgress(readProgress())},{passive:true});
addEventListener('wheel',()=>{if(playing)stopPlay()},{passive:true});addEventListener('touchstart',()=>{if(playing)stopPlay()},{passive:true});
addEventListener('keydown',e=>{if(e.target.matches('button,a,input,video')||$('#video-dialog').open)return;if(e.key===' '){e.preventDefault();startPlay();}if(e.key==='Home'){goTo(0)}if(e.key==='End'){goTo(1)}if(e.key==='Escape'&&exploring){exitExplore();goTo(1,false)}});
const dialog=$('#video-dialog'),video=$('#gift-video');$$('[data-open-video]').forEach(b=>b.addEventListener('click',()=>{stopPlay();dialog.showModal();video.play().catch(()=>{});}));$('#close-video').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>video.pause());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
function resize(){const r=$('#scene-wrap').getBoundingClientRect();scene?.resize(r.width,r.height);if(!playing&&!exploring)setProgress(readProgress());}
new ResizeObserver(resize).observe($('#scene-wrap'));
function frame(now){if(playing){const p=playFrom+(now-playStart)/18000;setProgress(p);window.scrollTo({top:progress*scrollRange(),behavior:'instant'});if(p>=1){stopPlay();}}if(scene&&(!document.hidden)&&now-lastTime>1000/45){scene.render();lastTime=now;}requestAnimationFrame(frame)}
try{scene=await createGiftScene({canvas:$('#gift-canvas'),quality:innerWidth<700?'medium':'high'});resize();setProgress(readProgress());$('#load-state').classList.add('loaded');document.body.dataset.ready='true';requestAnimationFrame(frame);window.giftExperience={scene,setProgress,enterExplore,goTo,diagnostics:()=>({progress,chapter,exploring,playing,selected,...scene.diagnostics?.()})};}catch(error){console.error('礼盒场景加载失败',error);$('#load-state').hidden=true;$('#webgl-fallback').hidden=false;start.disabled=true;play.disabled=true;document.body.dataset.ready='fallback';}
