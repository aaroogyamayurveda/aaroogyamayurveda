/* CRM1 Agent Order Search customer/mobile repair.
   Only affects Agent users on Order Search. Keeps the existing search/scope intact and enriches
   visible result rows from the canonical orders -> customers relation. */
(function(){
'use strict';
if(window.__crm1AgentOrderSearchCustomerMobileFixV1)return;
window.__crm1AgentOrderSearchCustomerMobileFixV1=true;
var db=null,userId=null,isAgent=false,busy=false,lastSignature='';
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})}
async function resolve(){
 db=window.sb||null;
 for(var i=0;i<80&&!db?.auth;i++){await sleep(250);db=window.sb||null}
 if(!db?.auth)return false;
 try{
  var u=await db.auth.getUser();userId=u?.data?.user?.id||null;if(!userId)return false;
  var p=await db.from('profiles').select('id,role').eq('id',userId).maybeSingle();
  if(p.error||!p.data)return false;
  isAgent=String(p.data.role||'').toLowerCase()==='agent';
  return isAgent;
 }catch(e){return false}
}
function searchPage(){
 var main=document.querySelector('main');
 if(!main)return false;
 var h=main.querySelector('h2');
 return !!(h&&/order search/i.test((h.textContent||'').trim()));
}
function resultTable(){
 if(!searchPage())return null;
 var tables=Array.from(document.querySelectorAll('main table'));
 return tables.find(function(t){
  var h=(t.querySelector('thead')?.innerText||'').replace(/\s+/g,' ').toLowerCase();
  return h.includes('customer')&&h.includes('mobile')&&h.includes('product');
 })||tables[0]||null;
}
function orderNos(table){
 return Array.from(table?.querySelectorAll('tbody tr')||[]).map(function(r){
  if(!r.cells||r.cells.length<8)return null;
  var v=(r.cells[0].innerText||'').trim().replace(/^#/,'');
  return /^\d+$/.test(v)?Number(v):null;
 }).filter(function(v){return v!=null});
}
async function enrich(){
 if(!isAgent||busy||!db||!searchPage())return;
 var table=resultTable();if(!table)return;
 var nums=orderNos(table);if(!nums.length)return;
 var sig=nums.join(',')+'|'+table.innerText.slice(0,1200);if(sig===lastSignature)return;lastSignature=sig;busy=true;
 try{
  var ordersRes=await db.from('orders').select('order_no,customer_id').in('order_no',nums).eq('agent_id',userId);
  if(ordersRes.error)throw ordersRes.error;
  var orders=ordersRes.data||[];
  var ids=orders.map(function(o){return o.customer_id}).filter(Boolean);
  var customers=[];
  if(ids.length){
   var cr=await db.from('customers').select('id,customer_name,mobile').in('id',ids);if(!cr.error)customers=cr.data||[];
  }
  var cmap={};customers.forEach(function(c){cmap[String(c.id)]=c});
  var omap={};orders.forEach(function(o){omap[String(o.order_no)]=o});
  Array.from(table.querySelectorAll('tbody tr')).forEach(function(r){
   if(!r.cells||r.cells.length<8)return;
   var no=(r.cells[0].innerText||'').trim().replace(/^#/,'');var o=omap[no];if(!o||!o.customer_id)return;var c=cmap[String(o.customer_id)];if(!c)return;
   var name=String(c.customer_name||'').trim()||'-',mobile=String(c.mobile||'').trim()||'-';
   if((r.cells[1].innerText||'').trim()==='-'||(r.cells[1].innerText||'').trim()==='')r.cells[1].textContent=name;
   if((r.cells[2].innerText||'').trim()==='-'||(r.cells[2].innerText||'').trim()==='')r.cells[2].textContent=mobile;
  });
 }catch(e){console.warn('CRM1 Agent Order Search customer/mobile enrichment:',e)}finally{busy=false}
}
function observe(){
 if(document.body.dataset.crm1AgentOrderSearchFixObserved)return;document.body.dataset.crm1AgentOrderSearchFixObserved='1';
 new MutationObserver(function(){if(isAgent&&searchPage())setTimeout(enrich,0)}).observe(document.body,{childList:true,subtree:true});
}
async function init(){if(!(await resolve()))return;observe();[0,250,750,1500,3000,5000].forEach(function(ms){setTimeout(enrich,ms)});setInterval(function(){if(isAgent&&searchPage())enrich()},1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
