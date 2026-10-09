const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const docs=path.join(__dirname,'../docs');

function app(){
 const elements=new Map(),classes=new Set(),focus=[];
 const get=id=>{
  if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',open:false,events:{},classList:{contains:()=>false},
   addEventListener(name,handler){this.events[name]=handler},focus(){focus.push(id)},showModal(){this.open=true},
   close(){this.open=false;this.events.close?.()},getBoundingClientRect(){return {left:10,right:310,top:20,bottom:500}}});
  return elements.get(id);
 };
 const ctx={document:{getElementById:get,querySelectorAll:()=>[],contains:()=>true,activeElement:null,
  body:{classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}}},
  localStorage:{getItem:()=>null},requestAnimationFrame:()=>{},window:{addEventListener:()=>{},scrollTo:()=>{}},navigator:{}};
 vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(path.join(docs,'tokyo30-details.js'),'utf8'),ctx);
 const html=fs.readFileSync(path.join(docs,'index.html'),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 vm.runInContext(script,ctx);
 return {ctx,get,classes,focus,run:code=>vm.runInContext(code,ctx)};
}

test('all 15 labeled restaurants have complete, reachable source summaries',()=>{
 const a=app();
 const ids=a.run('[...tokyo30Recommended]');
 assert.equal(ids.length,15);
 for(const id of ids){
  const detail=a.run(`tokyo30Details[${JSON.stringify(id)}]`);
  for(const key of ['pages','price','reservation','payment','caution'])assert.ok(detail[key],`${id}: ${key}`);
  assert.ok(detail.menus.length&&detail.tips.length);
  assert.ok(a.run(`D.some(d=>mealsForDay(d.id).some(g=>g[1].includes(${JSON.stringify(id)})))`));
  const card=a.run(`mealCard(${JSON.stringify(id)},'도쿄')`);
  assert.ok(card.includes('data-restaurant-details="'+id+'"'));
  assert.ok(card.includes('aria-haspopup="dialog"'));
 }
 assert.equal(a.run("restaurantSummaryHTML('suzuki')"),'');
 assert.equal(a.run("openRestaurantDetails('missing')"),false);
});

test('every summary opens, shows source and planning fields, and restores focus',()=>{
 const a=app();
 a.ctx.trigger={focus:()=>a.focus.push('trigger')};
 for(const id of a.run('[...tokyo30Recommended]')){
  assert.equal(a.run(`openRestaurantDetails(${JSON.stringify(id)},trigger)`),true);
  assert.equal(a.get('restaurant-detail').open,true);
  assert.ok(a.classes.has('restaurant-modal-open'));
  assert.ok(a.get('restaurant-detail-source').textContent.includes('2025년 9월'));
  const body=a.get('restaurant-detail-body').innerHTML;
  for(const text of ['추천 메뉴','먹는 법','가격 · 자료 기준','예약·대기','현금·카드','현재 웹사이트의 방문 준비','Google Maps'])assert.ok(body.includes(text),`${id}: ${text}`);
  a.get('restaurant-detail-close').events.click();
  assert.equal(a.get('restaurant-detail').open,false);
  assert.equal(a.classes.has('restaurant-modal-open'),false);
  assert.equal(a.focus.at(-1),'trigger');
 }
});

test('card delegation works after date changes and does not intercept external links',()=>{
 const a=app(),click=a.get('foodview').events.click;
 const card={dataset:{restaurant:'katsukami2'},querySelector:()=>({focus:()=>{}})};
 click({target:{closest:selector=>selector==='a'?{}:card}});
 assert.equal(a.get('restaurant-detail').open,false);
 for(let day=0;day<3;day++){
  a.run(`current=${day};render()`);
  click({target:{closest:selector=>selector==='a'?null:card}});
  assert.equal(a.get('restaurant-detail-title').textContent,'긴자 카츠카미 니');
  const dialog=a.get('restaurant-detail');
  dialog.events.click({target:dialog,clientX:100,clientY:100});
  assert.equal(dialog.open,true,'click inside dialog must not dismiss it');
  dialog.events.click({target:dialog,clientX:0,clientY:0});
  assert.equal(dialog.open,false,'backdrop click dismisses dialog');
 }
});

test('source/current differences, branch substitution, and unknown payments are explicit',()=>{
 const a=app();
 assert.ok(a.run("restaurantSummaryHTML('hikiniku')").includes('기치조지점'));
 assert.ok(a.run("restaurantSummaryHTML('hikiniku')").includes('시부야점'));
 assert.ok(a.run("restaurantSummaryHTML('katsukami2')").includes('16세'));
 assert.ok(a.run("restaurantSummaryHTML('tsujihan')").includes('¥1,650'));
 assert.ok(a.run("restaurantSummaryHTML('tsujihan')").includes('¥1,350–3,900'));
 assert.ok(a.run("tokyo30Details.moheji.payment").includes('미기재'));
 assert.ok(a.run("tokyo30Details.kaneko.payment").includes('현금만'));
 assert.ok(a.run("tokyo30Details.toritake.payment").includes('카드'));
});

test('all source text is escaped and summaries are part of the offline shell',()=>{
 const a=app();
 a.run("tokyo30Details.sama.menus.push('<img src=x onerror=alert(1)>')");
 const summary=a.run("restaurantSummaryHTML('sama')");
 assert.ok(summary.includes('&lt;img'));
 assert.equal(summary.includes('<img src=x'),false);
 const sw=fs.readFileSync(path.join(docs,'sw.js'),'utf8');
 new vm.Script(sw);
 const shell=JSON.parse(vm.runInNewContext(sw.slice(0,sw.indexOf('self.addEventListener'))+'JSON.stringify(SHELL)'));
 assert.ok(shell.includes('./tokyo30-details.js'));
 for(const file of shell)assert.ok(fs.existsSync(path.join(docs,file.split('?')[0])),file);
 assert.ok(sw.includes('v10-tokyo30-photo-refresh'));
 const html=fs.readFileSync(path.join(docs,'index.html'),'utf8');
 assert.ok(html.includes('src="./tokyo30-details.js?v=20261009-photos-2"'));
 assert.ok(shell.includes('./tokyo30-details.js?v=20261009-photos-2'));
 assert.ok(sw.includes("request.destination==='script'"));
 assert.ok(sw.includes("fetch(request,{cache:'no-cache'})"));
});

test('each source popup shows exactly one real PDF photo, including the branch warning',()=>{
 const a=app(),paths=new Set();
 const sw=fs.readFileSync(path.join(docs,'sw.js'),'utf8');
 const shell=JSON.parse(vm.runInNewContext(sw.slice(0,sw.indexOf('self.addEventListener'))+'JSON.stringify(SHELL)'));
 for(const id of a.run('[...tokyo30Recommended]')){
  const detail=a.run(`tokyo30Details[${JSON.stringify(id)}]`);
  const html=a.run(`restaurantSummaryHTML(${JSON.stringify(id)})`);
  assert.equal((html.match(/<img /g)||[]).length,1);
  assert.ok(html.includes('src="'+detail.photo+'"'));
  assert.ok(html.includes('도쿄 30끼 원문 사진 · '+detail.photoPage+'쪽'));
  assert.ok(detail.photoAlt);
  assert.ok(shell.includes(detail.photo));
  const bytes=fs.readFileSync(path.join(docs,detail.photo));
  assert.equal(bytes.readUInt16BE(0),0xffd8);
  paths.add(detail.photo);
 }
 assert.equal(paths.size,15);
 assert.ok(a.run("restaurantSummaryHTML('hikiniku')").includes('기치조지점 사진 (일정은 시부야점)'));
});
