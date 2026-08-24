/* CRM1 Follow-ups: authoritative active-queue guard. Legacy renders may replace rows at any time; this guard always keeps only active records without hiding the page. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
let observer=null,timer=null,cleaning=false,suppressObserver=false,cache=[],cacheAt=0,loadPromise=null;
const TTL=15000;
const active=()=>$('followups')?.classList.contains('active');
const isActive=s=>['pending','open','scheduled','followup'].includes(String(s||'').trim().toLowerCase());
const norm=s=>String(s||'').toLowerCase().replace(/[,.]/g,'').replace(/\s+/g,' ').trim();
const istKey=v=>{const d=new Date(v);return Number.isNaN(d)?'':norm(new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(d))};
function col(t,n){return[...t.querySelectorAll('thead th')].findIndex(h=>new RegExp('^'+n+'$','i').test(h.textContent.trim()))}
async function hasSession(db){try{const r=await db.auth.getSession();return !!r?.data?.session}catch(_){return false}}
async function load(force=false){
 const db=window.sb;if(!db)return cache;
 if(!(await hasSession(db)))return cache;
 if(!force&&cache.length&&Date.now()-cacheAt<TTL)return cache;
 if(loadPromise)return loadPromise;
 loadPromise=db.from('followups').select('id,order_id,customer_id,followup_at,status,note,notes,customers(customer_name,mobile)').in('status',['pending','open','scheduled','followup']).order('followup_at',{ascending:true}).limit(1000)
 .then(({data,error})=>{if(!error){cache=data||[];cacheAt=Date.now()}else console.warn('Follow-up preload failed',error);return cache})
 .catch(e=>{console.warn(e);return cache}).finally(()=>loadPromise=null);
 return loadPromise;
}
function setCard(root,label,n){for(const e of root.querySelectorAll('*'))if((e.textContent||'').trim().toLowerCase()===label){const b=e.parentElement?.querySelector('b');if(b)b.textContent=n;return}}
function counts(root,data){
 const s=new Date();s.setHours(0,0,0,0);const e=new Date(s);e.setDate(e.getDate()+1);let o=0,t=0,u=0;
 (data||[]).forEach(x=>{const d=new Date(x.followup_at);if(d<s)o++;else if(d<e)t++;else u++});
 setCard(root,'overdue',o);setCard(root,'today',t);setCard(root,'upcoming',u);
}
function enforceActiveRows(table){
 const si=col(table,'Status');if(si<0)return;
 for(const tr of [...table.querySelectorAll('tbody tr')]){
  const cells=tr.querySelectorAll('td');if(!cells.length)continue;
  const status=String(cells[si]?.textContent||'').trim().toLowerCase();
  if(status&&!isActive(status))tr.remove();
 }
}
function enrich(table,data){
 const ci=col(table,'Customer');let wi=col(table,'When'),mi=col(table,'Mobile');if(ci<0||wi<0)return;
 if(mi<0){const heads=[...table.querySelectorAll('thead th')],h=document.createElement('th');h.textContent='Mobile';heads[ci].after(h);for(const tr of table.querySelectorAll('tbody tr')){const td=tr.querySelectorAll('td')[ci];if(td){const m=document.createElement('td');m.textContent='-';td.after(m)}}mi=ci+1;if(wi>ci)wi++}
 const pool=(data||[]).map(x=>({...x,_used:false,_key:istKey(x.followup_at)})),ni=col(table,'Note');
 for(const tr of table.querySelectorAll('tbody tr')){
  const c=tr.querySelectorAll('td');if(c.length<=wi)continue;
  const key=norm(c[wi]?.textContent),note=ni>=0?norm(c[ni]?.textContent):'';
  let x=pool.find(v=>!v._used&&v._key===key);if(!x&&note)x=pool.find(v=>!v._used&&norm(v.note||v.notes)===note);
  if(!x)continue;x._used=true;
  const cc=tr.querySelectorAll('td')[ci],mc=tr.querySelectorAll('td')[mi];
  const name=x.customers?.customer_name||'-',mobile=x.customers?.mobile||'-';
  if(cc&&cc.textContent!==name)cc.textContent=name;if(mc&&mc.textContent!==mobile)mc.textContent=mobile;
 }
}
async function clean(){
 if(cleaning||!active())return;
 const root=$('followupsContent'),table=root?.querySelector('table');if(!root||!table)return;
 cleaning=true;suppressObserver=true;
 try{const data=await load();if(!active())return;enforceActiveRows(table);enrich(table,data);counts(root,data);root.style.removeProperty('visibility');}
 finally{cleaning=false;setTimeout(()=>{suppressObserver=false},0)}
}
function schedule(ms=0){clearTimeout(timer);timer=setTimeout(clean,ms)}
function begin(){const root=$('followupsContent');if(!root)return;schedule(0);load().then(()=>{if(active())schedule(0)});}
document.addEventListener('click',e=>{const b=e.target.closest('button,a');if(b&&/follow-ups/i.test(b.textContent||''))begin()},true);
function observe(){
 const root=$('followupsContent');if(!root||observer)return;
 observer=new MutationObserver(()=>{if(!suppressObserver&&active())schedule(20)});
 observer.observe(root,{childList:true,subtree:true,characterData:true});
}
async function boot(){
 const db=window.sb;
 if(!db){setTimeout(boot,500);return}
 if(!(await hasSession(db))){setTimeout(boot,500);return}
 observe();
 if(active())begin();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.crm1CleanFollowups=begin;
})();
