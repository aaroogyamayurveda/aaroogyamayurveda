import { sb, esc, money, currentProfile } from '../data.js';
import { mountManagement } from './management-ui.js';

const ROLES = ['super_admin','admin','manager','assistant_manager','team_leader'];
const ROLE_LIST = ['super_admin','admin','manager','assistant_manager','team_leader','agent','qa','verification','warehouse','dispatch','dealer_manager','accounts','mis','management_readonly'];
const CONFIGS = {
  teams:{title:'Teams',table:'crm2_teams',fields:[['name','Name','text'],['manager_id','Manager ID','text'],['active','Active','check']]},
  dispositions:{title:'Dispositions',table:'disposition_levels',fields:[['level_no','Level','number'],['name','Name','text'],['parent_id','Parent ID','text'],['active','Active','check']]},
  campaigns:{title:'Campaigns',table:'campaigns',fields:[['name','Name','text'],['source_id','Source ID','text'],['tv_channel','TV Channel','text'],['program','Program','text'],['time_slot','Time Slot','text'],['ad_identifier','Ad Identifier','text'],['spend','Spend','number'],['active','Active','check']]},
  products:{title:'Products',table:'products',fields:[['sku','SKU','text'],['name','Name','text'],['cost','Cost','number'],['mrp','MRP','number'],['selling_price','Selling Price','number'],['active','Active','check']]},
  warehouses:{title:'Warehouses',table:'warehouses',fields:[['code','Code','text'],['name','Name','text'],['address','Address','text'],['state','State','text'],['city','City','text'],['active','Active','check']]},
  couriers:{title:'Couriers',table:'couriers',fields:[['name','Name','text'],['active','Active','check']]}
};

const $ = id => document.getElementById(id);
const activate = id => document.querySelectorAll('[data-page]').forEach(x => x.classList.toggle('active', x.dataset.page === id));
const table = (headers, rows) => `<div class="tablewrap"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}" class="muted">No records found.</td></tr>`}</tbody></table></div>`;
const inputFor = ([key,label,type]) => `<div class="field"><label>${esc(label)}</label>${type === 'check' ? `<input id="ar_${key}" type="checkbox" checked>` : `<input id="ar_${key}" type="${type === 'number' ? 'number' : 'text'}">`}</div>`;

export async function mountAdminRuntime(main){
  const me = await currentProfile();
  if(!me || !ROLES.includes(me.role)){ main.innerHTML='<section class="panel error">Access denied.</section>'; return; }
  activate('admin');
  home(main);
}

function home(main){
  main.innerHTML = `<div class="title"><h2>Admin & Configuration</h2></div><section class="panel"><p id="arMsg" class="msg"></p><div class="cards"><button class="btn" data-ar="users">Users & Roles</button><button class="btn" data-ar="assignments">Lead Assignment</button><button class="btn" data-ar="mis">MIS Drilldown</button>${Object.entries(CONFIGS).map(([k,v])=>`<button class="btn" data-ar="${k}">${v.title}</button>`).join('')}</div></section>`;
  document.querySelectorAll('[data-ar]').forEach(b=>b.onclick=()=>{const k=b.dataset.ar;if(k==='users')users(main);else if(k==='assignments'){activate('management_assignments');mountManagement(main,'assignments')}else if(k==='mis'){activate('management_mis');mountManagement(main,'mis')}else configPage(main,k)});
}

async function configPage(main,key){
  const c=CONFIGS[key];
  const order=c.table==='disposition_levels'?'level_no':'created_at';
  const {data,error}=await sb.from(c.table).select('*').order(order,{ascending:true}).limit(300);
  const rows=(data||[]).map(r=>`<tr><td>${esc(String(r.id).slice(0,8))}</td>${c.fields.map(([f,,t])=>`<td>${t==='check'?(r[f]?'Yes':'No'):t==='number'?money(r[f]):esc(r[f]??'')}</td>`).join('')}<td><button class="btn alt" data-ar-edit="${r.id}">Load</button></td></tr>`);
  main.innerHTML=`<div class="title"><h2>${esc(c.title)}</h2><button class="btn alt" id="arBack">Admin Home</button></div><section class="panel"><form id="arCfg" class="grid2">${c.fields.map(inputFor).join('')}<button class="btn">Add</button><div id="arMsg" class="msg"></div></form></section><section class="panel">${error?`<p class="error">${esc(error.message)}</p>`:table(['ID',...c.fields.map(x=>x[1]),'Action'],rows)}</section>`;
  $('arBack').onclick=()=>home(main);
  $('arCfg').onsubmit=async e=>{e.preventDefault();const record={};c.fields.forEach(([f,,t])=>{const x=$(`ar_${f}`);record[f]=t==='check'?x.checked:t==='number'?Number(x.value||0):x.value.trim()||null});const {error:e2}=await sb.from(c.table).insert(record);if(e2)$('arMsg').textContent=e2.message;else configPage(main,key)};
  document.querySelectorAll('[data-ar-edit]').forEach(b=>b.onclick=async()=>{const {data:r}=await sb.from(c.table).select('*').eq('id',b.dataset.arEdit).single();if(!r)return;c.fields.forEach(([f,,t])=>{const x=$(`ar_${f}`);if(t==='check')x.checked=!!r[f];else x.value=r[f]??'';});});
}

async function users(main){
  const [{data:profiles,error},{data:teams}]=await Promise.all([sb.from('crm2_user_profiles').select('id,full_name,role,team_id,active').order('created_at',{ascending:false}).limit(300),sb.from('crm2_teams').select('id,name').eq('active',true).order('name')]);
  const rows=(profiles||[]).map(r=>`<tr><td>${esc(r.full_name||'')}</td><td>${esc(r.role)}</td><td>${esc((teams||[]).find(x=>x.id===r.team_id)?.name||'')}</td><td>${r.active?'Active':'Inactive'}</td><td><button class="btn alt" data-ar-user="${r.id}">Load</button></td></tr>`);
  main.innerHTML=`<div class="title"><h2>Users & Roles</h2><button class="btn alt" id="arBack">Admin Home</button></div><section class="panel"><p class="muted">Manage existing CRM2 Auth-linked profiles.</p><form id="arUser" class="grid2"><div class="field"><label>User ID</label><input id="ar_uid" required></div><div class="field"><label>Full Name</label><input id="ar_un"></div><div class="field"><label>Role</label><select id="ar_ur">${ROLE_LIST.map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Team ID</label><input id="ar_ut"></div><div class="field"><label>Active</label><input id="ar_ua" type="checkbox" checked></div><button class="btn">Update Profile</button><div id="arMsg" class="msg"></div></form></section><section class="panel">${error?`<p class="error">${esc(error.message)}</p>`:table(['Name','Role','Team','Status','Action'],rows)}</section>`;
  $('arBack').onclick=()=>home(main);
  $('arUser').onsubmit=async e=>{e.preventDefault();const {error:e2}=await sb.from('crm2_user_profiles').update({full_name:$('ar_un').value.trim()||null,role:$('ar_ur').value,team_id:$('ar_ut').value.trim()||null,active:$('ar_ua').checked}).eq('id',$('ar_uid').value.trim());$('arMsg').textContent=e2?e2.message:'Profile updated';if(!e2)users(main)};
  document.querySelectorAll('[data-ar-user]').forEach(b=>b.onclick=async()=>{const {data:r}=await sb.from('crm2_user_profiles').select('id,full_name,role,team_id,active').eq('id',b.dataset.arUser).single();if(!r)return;$('ar_uid').value=r.id;$('ar_un').value=r.full_name||'';$('ar_ur').value=r.role;$('ar_ut').value=r.team_id||'';$('ar_ua').checked=!!r.active;});
}
