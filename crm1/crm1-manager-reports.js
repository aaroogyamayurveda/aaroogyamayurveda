/* CRM1 Manager Reports: isolated reporting layer for daily/monthly agent, disposition and order analysis. */
(()=>{
'use strict';
const db=()=>window.sb;
const managerRoles=['super_admin','management','order_manager'];
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?'':v).replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]));
const TZ='Asia/Kolkata';
const istDate=d=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d?new Date(d):new Date());
const nextISTDate=s=>{const d=new Date(s+'T00:00:00+05:30');d.setUTCDate(d.getUTCDate()+1);return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
const istBounds=(from,to)=>{const f=from||istDate(),t=to||f;const a=new Date(f+'T00:00:00+05:30').toISOString(),b=new Date(nextISTDate(t)+'T00:00:00+05:30').toISOString();return a<=b?{start:a,end:b}:{start:b,end:a}};
const today=()=>istDate();
function page(){
 let p=$('crm1ManagerReports');
 if(p)return p;
 p=document.createElement('section');p.id='crm1ManagerReports';p.className='page';
 p.innerHTML=`<div class="title"><div><h2>📈 Manager Reports</h2><div class="sub">Agent performance, disposition summary, lead conversion and order performance</div></div></div>
 <div class="panel"><div class="crm1wf2-actions"><label>From <input id="crm1RptFrom" type="date"></label><label>To <input id="crm1RptTo" type="date"></label><button class="btn" id="crm1RptLoad">Generate Report</button></div><div id="crm1RptMsg" class="crm1wf2-msg"></div></div>
 <div class="crm1wf2-grid" id="crm1RptStats"></div>
 <div class="panel"><h3>Agent Performance</h3><div class="tablewrap"><table><thead><tr><th>Agent</th><th>Assigned</th><th>Worked</th><th>Callbacks</th><th>Orders</th><th>Converted</th></tr></thead><tbody id="crm1RptAgentBody"></tbody></table></div></div>
 <div class="panel"><h3>Disposition Summary</h3><div class="tablewrap"><table><thead><tr><th>Disposition</th><th>Count</th></tr></thead><tbody id="crm1RptDispBody"></tbody></table></div></div>
 <div class="panel"><h3>Order Summary</h3><div class="tablewrap"><table><thead><tr><th>Status</th><th>Verification</th><th>Count</th></tr></thead><tbody id="crm1RptOrderBody"></tbody></table></div></div>`;
 document.querySelector('.main')?.appendChild(p);
 $('crm1RptFrom').value=today();$('crm1RptTo').value=today();$('crm1RptLoad').onclick=load;
 return p;
}
function nav(){
 const n=$('nav');if(!n||$('crm1RptNav'))return;
 const role=String(window.profile?.role||window.state?.profile?.role||'').toLowerCase();
 if(!managerRoles.includes(role))return;
 const b=document.createElement('button');b.id='crm1RptNav';b.type='button';b.textContent='📈 Manager Reports';b.onclick=()=>show();n.appendChild(b);
}
function show(){page();document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$('crm1ManagerReports').classList.add('active');document.querySelectorAll('#nav button').forEach(b=>b.classList.remove('active'));$('crm1RptNav')?.classList.add('active');window.scrollTo(0,0);load();}
async function load(){
 const msg=$('crm1RptMsg');if(!msg)return;
 const from=$('crm1RptFrom').value||today(),to=$('crm1RptTo').value||today();
 const bounds=istBounds(from,to);
 msg.textContent='Generating report...';msg.className='crm1wf2-msg';
 try{
  const [leadsR,intR,ordersR,agentsR]=await Promise.all([
   db().from('crm_leads').select('id,assigned_to,lead_status,assigned_at,first_contact_at,created_at').gte('created_at',bounds.start).lt('created_at',bounds.end),
   db().from('crm_interactions').select('id,agent_id,status,disposition,created_at,started_at').gte('created_at',bounds.start).lt('created_at',bounds.end),
   db().from('orders').select('id,order_no,agent_id,order_status,verification_status,created_at').gte('created_at',bounds.start).lt('created_at',bounds.end),
   db().from('profiles').select('id,full_name,email').eq('is_active',true).eq('role','agent').order('full_name')
  ]);
  for(const r of [leadsR,intR,ordersR,agentsR])if(r.error)throw r.error;
  const leads=leadsR.data||[],ints=intR.data||[],orders=ordersR.data||[],agents=agentsR.data||[];
  const names=new Map(agents.map(a=>[a.id,a.full_name||a.email||a.id]));
  const assigned=leads.length;
  const worked=leads.filter(x=>x.first_contact_at||['contacted','followup','qualified','converted','lost'].includes(x.lead_status)).length;
  const callbacks=leads.filter(x=>x.lead_status==='followup').length;
  const converted=leads.filter(x=>x.lead_status==='converted').length;
  $('crm1RptStats').innerHTML=[['Leads Imported',assigned],['Worked',worked],['Follow-ups',callbacks],['Converted',converted],['Orders',orders.length],['Conversion %',assigned?((converted/assigned)*100).toFixed(1)+'%':'0%']].map(x=>`<div class="stat"><span>${x[0]}</span><div class="crm1wf2-num">${esc(x[1])}</div></div>`).join('');
  const map={};agents.forEach(a=>map[a.id]={name:names.get(a.id),assigned:0,worked:0,callbacks:0,orders:0,converted:0});
  leads.forEach(x=>{const z=map[x.assigned_to];if(!z)return;z.assigned++;if(x.first_contact_at||x.lead_status!=='assigned')z.worked++;if(x.lead_status==='followup')z.callbacks++;if(x.lead_status==='converted')z.converted++;});
  orders.forEach(x=>{if(map[x.agent_id])map[x.agent_id].orders++;});
  $('crm1RptAgentBody').innerHTML=Object.values(map).map(x=>`<tr><td>${esc(x.name)}</td><td>${x.assigned}</td><td>${x.worked}</td><td>${x.callbacks}</td><td>${x.orders}</td><td>${x.converted}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">No agent data</td></tr>';
  const disp={};ints.forEach(x=>{const k=x.disposition||x.status||'Not Dispositioned';disp[k]=(disp[k]||0)+1;});
  $('crm1RptDispBody').innerHTML=Object.entries(disp).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')||'<tr><td colspan="2" class="empty">No dispositions</td></tr>';
  const os={};orders.forEach(x=>{const k=(x.order_status||'-')+'|'+(x.verification_status||'-');os[k]=(os[k]||0)+1;});
  $('crm1RptOrderBody').innerHTML=Object.entries(os).map(([k,v])=>{const [a,b]=k.split('|');return `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td>${v}</td></tr>`}).join('')||'<tr><td colspan="3" class="empty">No orders</td></tr>';
  msg.textContent=`Report generated: ${from} to ${to} (IST)`;
 }catch(e){msg.textContent=e?.message||String(e);msg.className='crm1wf2-msg err';}
}
function boot(){
 const wait=()=>{if(db())nav();else setTimeout(wait,250)};wait();
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&/manager control/i.test(b.textContent||''))setTimeout(nav,100);},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
