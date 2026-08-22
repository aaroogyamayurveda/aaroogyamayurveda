/* CRM1 production workforce: CSV import -> batch -> agent assignment -> today's calling queue -> manager control. */
(function(){
  'use strict';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const db=()=>window.sb;
  let me=null, profile=null;
  const managerRoles=['super_admin','management','order_manager'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const today=()=>new Date().toISOString().slice(0,10);

  function navButton(id,label,roles){
    const nav=document.getElementById('nav');
    if(!nav||document.getElementById('crm1WNav_'+id)||!roles.includes(profile?.role))return;
    const b=document.createElement('button');b.type='button';b.id='crm1WNav_'+id;b.textContent=label;b.dataset.crm1Workforce='1';
    b.onclick=()=>openPage(id);
    nav.appendChild(b);
  }
  function page(id,title,sub,html){
    let p=document.getElementById(id);
    if(!p){p=document.createElement('section');p.id=id;p.className='page';p.innerHTML=`<div class="title"><div><h2>${title}</h2><div class="sub">${sub}</div></div></div>${html}`;document.querySelector('.main')?.appendChild(p);}
    return p;
  }
  function openPage(id){
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    document.querySelectorAll('#nav button').forEach(b=>b.classList.remove('active'));
    document.getElementById('crm1WNav_'+id)?.classList.add('active');
    window.scrollTo(0,0);
    if(id==='crm1ManagerControl')loadManagerControl();
    if(id==='crm1LeadImport')renderImport();
    if(id==='crm1LeadAssignment')renderAssignment();
    if(id==='crm1TodayQueue')loadTodayQueue();
  }
  function style(){
    if(document.getElementById('crm1WorkforceStyle'))return;
    const s=document.createElement('style');s.id='crm1WorkforceStyle';s.textContent=`
      .crm1wf-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:16px}
      .crm1wf-grid .stat{background:#fff}
      .crm1wf-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
      .crm1wf-actions select,.crm1wf-actions input{padding:9px;border:1px solid #d8dee8;border-radius:9px;background:#fff}
      .crm1wf-message{min-height:20px;margin:8px 0;color:#166534;font-size:13px}
      .crm1wf-message.err{color:#b43b35}.crm1wf-muted{font-size:12px;color:#6b7280}
      .crm1wf-num{font-size:25px;font-weight:800;color:#164b30}
      .crm1wf-call-btn{white-space:nowrap}.crm1wf-mobile{font-weight:700;cursor:pointer;color:#164b30;text-decoration:underline}
      @media(max-width:1000px){.crm1wf-grid{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:650px){.crm1wf-grid{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(s);
  }

  function parseCsv(text){
    const lines=String(text||'').replace(/\r/g,'').split('\n').filter(x=>x.trim());
    if(!lines.length)throw new Error('CSV file is empty.');
    const parseLine=line=>{let out=[],cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(c===','&&!q){out.push(cur.trim());cur='';}else cur+=c;}out.push(cur.trim());return out};
    const norm=s=>String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
    const head=parseLine(lines.shift()).map(norm);
    const find=(...names)=>{for(const n of names){const i=head.indexOf(norm(n));if(i>=0)return i}return -1};
    const idx={mobile:find('Mobile','Mobile Number','Phone','Phone Number'),name:find('Customer Name','Name','Lead Name'),product:find('Product Name','Product'),address:find('Address','Customer Address'),city:find('City'),state:find('State'),pincode:find('Pincode','Pin Code','PIN','Pin')};
    if(idx.mobile<0)throw new Error('CSV me Mobile / Mobile Number column nahi mila.');
    return lines.map(parseLine).map(a=>({mobile:String(a[idx.mobile]||'').replace(/\D/g,''),lead_name:a[idx.name]||'',product_name:a[idx.product]||'',address:a[idx.address]||'',city:a[idx.city]||'',state:a[idx.state]||'',pincode:String(a[idx.pincode]||'').replace(/\D/g,''),source:'csv'}));
  }
  async function hashValue(value){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}

  async function initSession(){
    if(!me||profile?.role==='super_admin')return;
    const key='crm1_agent_session_'+me.id+'_'+today();
    let sessionKey=localStorage.getItem(key);
    if(!sessionKey){sessionKey=crypto.randomUUID();localStorage.setItem(key,sessionKey)}
    await db().from('crm_agent_sessions').upsert({user_id:me.id,session_key:sessionKey,last_seen_at:new Date().toISOString(),logout_at:null},{onConflict:'session_key'});
    setInterval(()=>db().from('crm_agent_sessions').update({last_seen_at:new Date().toISOString(),logout_at:null}).eq('session_key',sessionKey),60000);
  }

  async function getAgents(){const {data,error}=await db().from('profiles').select('id,full_name,email,role,is_active').eq('is_active',true).in('role',['agent','management','order_manager','super_admin']).order('full_name');if(error)throw error;return data||[]}
  async function getBatches(){const {data,error}=await db().from('crm_lead_batches').select('id,file_name,created_at,total_records,valid_records,invalid_records').order('created_at',{ascending:false});if(error)throw error;return data||[]}

  function renderImport(){
    const p=page('crm1LeadImport','Lead CSV Upload','Import daily calling leads into the production CRM1 queue',`<div class="panel"><div class="crm1wf-actions"><input id="crm1WFile" type="file" accept=".csv,text/csv"><button class="btn" id="crm1WPreview">Preview CSV</button></div><div id="crm1WImportMsg" class="crm1wf-message"></div><div id="crm1WPreviewBox"></div></div>`);
    p.querySelector('#crm1WPreview').onclick=previewImport;
  }
  async function previewImport(){
    const p=document.getElementById('crm1LeadImport');const f=p?.querySelector('#crm1WFile')?.files?.[0];const msg=p?.querySelector('#crm1WImportMsg');const box=p?.querySelector('#crm1WPreviewBox');
    try{if(!f)throw new Error('Pehle CSV file select karein.');const rows=parseCsv(await f.text());const seen=new Set(),valid=[],invalid=[];for(const r of rows){if(!/^[6-9]\d{9}$/.test(r.mobile)||seen.has(r.mobile)){invalid.push(r);continue}seen.add(r.mobile);valid.push(r)}
      const sourceKey=await hashValue(f.name+'|'+valid.map(x=>[x.mobile,x.lead_name,x.product_name,x.address,x.city,x.state,x.pincode].join('|')).sort().join('||'));
      window.crm1WImport={rows,valid,invalid,sourceKey,fileName:f.name};
      msg.textContent=`Total ${rows.length} | Valid ${valid.length} | Invalid/Duplicate ${invalid.length}`;msg.className='crm1wf-message';
      box.innerHTML=`<div class="crm1wf-actions"><button class="btn" id="crm1WImportBtn">Import Valid Leads</button></div><div class="tablewrap"><table><thead><tr><th>Mobile</th><th>Customer</th><th>Product</th><th>City</th><th>State</th><th>Pincode</th></tr></thead><tbody>${valid.slice(0,200).map(x=>`<tr><td>${esc(x.mobile)}</td><td>${esc(x.lead_name)}</td><td>${esc(x.product_name)}</td><td>${esc(x.city)}</td><td>${esc(x.state)}</td><td>${esc(x.pincode)}</td></tr>`).join('')}</tbody></table></div>`;
      box.querySelector('#crm1WImportBtn').onclick=importValid;
    }catch(e){msg.textContent=e.message||String(e);msg.className='crm1wf-message err';box.innerHTML=''}
  }
  async function importValid(){
    const x=window.crm1WImport,msg=document.getElementById('crm1WImportMsg');if(!x)return;
    try{msg.textContent='Checking duplicate batch…';const {data:existing,error:ee}=await db().from('crm_lead_batches').select('id,file_name,created_at').eq('source_key',x.sourceKey).maybeSingle();if(ee)throw ee;if(existing){msg.textContent=`This exact CSV batch is already imported (${new Date(existing.created_at).toLocaleString('en-IN')}). Duplicate skipped.`;return}
      const batchPayload={file_name:x.fileName,source_key:x.sourceKey,total_records:x.rows.length,valid_records:x.valid.length,invalid_records:x.invalid.length,uploaded_by:me.id};
      const {data:b,error:be}=await db().from('crm_lead_batches').insert(batchPayload).select('id').single();if(be)throw be;
      const payload=x.valid.map(r=>({lead_name:r.lead_name||'Customer',mobile:r.mobile,product_name:r.product_name||null,address:r.address||null,city:r.city||null,state:r.state||null,pincode:r.pincode||null,source:'csv',lead_status:'new',assigned_to:null,batch_id:b.id,created_by:me.id,updated_at:new Date().toISOString()}));
      const {error:le}=await db().from('crm_leads').insert(payload);if(le)throw le;
      msg.textContent=`Batch imported successfully. ${x.valid.length} leads saved.`;window.crm1WImport=null;loadAssignmentData();
    }catch(e){msg.textContent=e.message||String(e);msg.className='crm1wf-message err'}
  }

  function renderAssignment(){
    const p=page('crm1LeadAssignment','Lead Assignment','Assign imported leads to individual agents for today’s calling queue',`<div class="panel"><div class="crm1wf-actions"><select id="crm1WBatch"><option value="">Loading batches…</option></select><select id="crm1WAgent"><option value="">Select Agent</option></select><button class="btn" id="crm1WLoadAssign">Load Leads</button><button class="btn" id="crm1WAssign">Assign Selected</button></div><div id="crm1WAssignMsg" class="crm1wf-message"></div><div id="crm1WAssignTable"></div></div>`);
    p.querySelector('#crm1WLoadAssign').onclick=loadAssignmentData;p.querySelector('#crm1WAssign').onclick=assignSelected;loadAssignmentData();loadAgentSelect();
  }
  async function loadAgentSelect(){try{const a=await getAgents();const s=document.getElementById('crm1WAgent');if(s)s.innerHTML='<option value="">Select Agent</option>'+a.filter(x=>x.role==='agent').map(x=>`<option value="${esc(x.id)}">${esc(x.full_name||x.email)}</option>`).join('')}catch(e){}}
  async function loadAssignmentData(){
    const bs=document.getElementById('crm1WBatch'),t=document.getElementById('crm1WAssignTable');if(!bs||!t)return;
    try{const b=await getBatches();bs.innerHTML='<option value="">Select Batch</option>'+b.map(x=>`<option value="${x.id}">${esc(x.file_name)} — ${new Date(x.created_at).toLocaleString('en-IN')} (${x.valid_records})</option>`).join('');
      if(bs.value)t.innerHTML='';
      const id=bs.value;if(!id){t.innerHTML='<div class="empty">Select a batch and Load Leads.</div>';return}
      const {data,error}=await db().from('crm_leads').select('id,mobile,lead_name,product_name,city,state,pincode,lead_status').eq('batch_id',id).is('assigned_to',null).in('lead_status',['new','assigned']).order('created_at',{ascending:true}).limit(1000);if(error)throw error;
      t.innerHTML=`<p>${data.length} unassigned leads</p><table><thead><tr><th><input id="crm1WCheckAll" type="checkbox"></th><th>Mobile</th><th>Customer</th><th>Product</th><th>City</th><th>State</th></tr></thead><tbody>${data.map(x=>`<tr><td><input class="crm1WLeadCheck" type="checkbox" value="${x.id}"></td><td>${esc(x.mobile)}</td><td>${esc(x.lead_name)}</td><td>${esc(x.product_name||'')}</td><td>${esc(x.city||'')}</td><td>${esc(x.state||'')}</td></tr>`).join('')}</tbody></table>`;
      t.querySelector('#crm1WCheckAll')?.addEventListener('change',e=>t.querySelectorAll('.crm1WLeadCheck').forEach(c=>c.checked=e.target.checked));
    }catch(e){t.innerHTML=`<div class="crm1wf-message err">${esc(e.message||e)}</div>`}
  }
  async function assignSelected(){
    const agent=document.getElementById('crm1WAgent')?.value,ids=[...document.querySelectorAll('.crm1WLeadCheck:checked')].map(x=>x.value),msg=document.getElementById('crm1WAssignMsg');
    if(!agent){msg.textContent='Select an agent first.';msg.className='crm1wf-message err';return}if(!ids.length){msg.textContent='Select at least one lead.';msg.className='crm1wf-message err';return}
    try{const now=new Date().toISOString();const {error}=await db().from('crm_leads').update({assigned_to:agent,assigned_at:now,lead_status:'assigned',updated_at:now}).in('id',ids);if(error)throw error;const rows=ids.map(id=>({lead_id:id,agent_id:agent,assigned_by:me.id,assignment_date:today(),status:'assigned'}));const {error:e}=await db().from('crm_lead_assignments').insert(rows);if(e)throw e;msg.textContent=`${ids.length} leads assigned successfully.`;msg.className='crm1wf-message';loadAssignmentData();}catch(e){msg.textContent=e.message||String(e);msg.className='crm1wf-message err'}
  }

  function renderTodayQueue(){page('crm1TodayQueue', 'Today’s Calling Queue','Customers assigned to you for manual outbound calling', '<div class="panel"><div id="crm1WQueueSummary" class="crm1wf-message"></div><div id="crm1WQueueTable"></div></div>');loadTodayQueue()}
  async function loadTodayQueue(){
    const box=document.getElementById('crm1WQueueTable'),summary=document.getElementById('crm1WQueueSummary');if(!box)return;
    try{const {data,error}=await db().from('crm_leads').select('id,customer_id,mobile,lead_name,product_name,address,city,state,pincode,lead_status,priority,assigned_at,next_followup_at,last_contact_at').eq('assigned_to',me.id).in('lead_status',['assigned','contacted','followup','qualified']).order('assigned_at',{ascending:true});if(error)throw error;summary.textContent=`${data.length} active leads in your queue.`;summary.className='crm1wf-message';box.innerHTML=`<table><thead><tr><th>Mobile</th><th>Customer</th><th>Product</th><th>City</th><th>State</th><th>Status</th><th>Action</th></tr></thead><tbody>${data.map(x=>`<tr><td><span class="crm1wf-mobile" data-mobile="${esc(x.mobile)}">${esc(x.mobile)}</span></td><td>${esc(x.lead_name||'')}</td><td>${esc(x.product_name||'')}</td><td>${esc(x.city||'')}</td><td>${esc(x.state||'')}</td><td><span class="pill">${esc(x.lead_status||'')}</span></td><td><button class="btn crm1wf-call-btn" data-id="${x.id}">Open Customer</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty">No leads assigned.</td></tr>'}</tbody></table>`;
      box.querySelectorAll('.crm1wf-call-btn').forEach(b=>b.onclick=()=>openLead(b.dataset.id));
    }catch(e){summary.textContent=e.message||String(e);summary.className='crm1wf-message err'}
  }
  async function openLead(id){
    const {data:lead,error}=await db().from('crm_leads').select('*').eq('id',id).single();if(error){alert(error.message);return}
    const now=new Date().toISOString();await db().from('crm_leads').update({lead_status:'contacted',first_contact_at:lead.first_contact_at||now,last_contact_at:now,updated_at:now}).eq('id',id);
    const ctx={lead_id:lead.id,customer_id:lead.customer_id||null,customer_name:lead.lead_name,mobile:lead.mobile,product_name:lead.product_name,pincode:lead.pincode,address:lead.address,city:lead.city,state:lead.state};
    sessionStorage.setItem('crm1_queue_lead_context',JSON.stringify(ctx));
    window.crm1SetCallContext?.({lead_id:lead.id,customer_id:lead.customer_id||null});
    if(window.crm1OpenCallWorkspace)window.crm1OpenCallWorkspace(lead.mobile||'',{lead_id:lead.id,customer_id:lead.customer_id||null});
    const p=document.getElementById('createOrderPage');if(p){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));p.classList.add('active');p.scrollIntoView({block:'start'});window.dispatchEvent(new CustomEvent('crm1QueueLeadOpened',{detail:ctx}));}
    await sleep(200);applyQueueContext();
  }
  async function applyQueueContext(){
    let lead=null;try{lead=JSON.parse(sessionStorage.getItem('crm1_queue_lead_context')||'null')}catch{};if(!lead)return;
    const form=document.getElementById('createOrderPageForm');if(!form)return;
    const set=(el,v)=>{if(el&&v!=null){el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true))}}};
    set(form.elements.customer_name,lead.customer_name);set(document.getElementById('pageMobile'),lead.mobile);set(document.getElementById('orderPincode'),lead.pincode);set(form.elements.address,lead.address);await chooseProduct(lead.product_name);
    for(let i=0;i<20;i++){const st=document.getElementById('orderState'),city=document.getElementById('orderCity');if(st&&st.options.length>1&&lead.state){const so=[...st.options].find(o=>o.text.trim().toLowerCase()===String(lead.state).trim().toLowerCase()||o.value===lead.state);if(so){st.value=so.value;st.dispatchEvent(new Event('change',{bubbles:true}));await sleep(300);if(city&&city.options.length>1&&lead.city){const co=[...city.options].find(o=>o.text.trim().toLowerCase()===String(lead.city).trim().toLowerCase()||o.value===lead.city);if(co){city.value=co.value;city.dispatchEvent(new Event('change',{bubbles:true))};}}}break}await sleep(250)}
    let badge=document.getElementById('crm1QueueLeadBadge');if(!badge){badge=document.createElement('div');badge.id='crm1QueueLeadBadge';badge.style.cssText='margin:0 0 14px;padding:11px 13px;border-radius:10px;background:#edf5ea;color:#164b30;border:1px solid #d8e7d3;font-size:13px;font-weight:700;';form.insertBefore(badge,form.firstChild)}badge.textContent=`Calling Queue Lead • ${lead.mobile||''}${lead.customer_name?` • ${lead.customer_name}`:''}${lead.product_name?` • ${lead.product_name}`:''}`;
  }
  async function chooseProduct(name){if(!name)return;const sel=document.getElementById('pageProduct');if(!sel)return;for(let i=0;i<30;i++){const o=[...sel.options].find(o=>String(o.textContent||'').toLowerCase().includes(String(name).toLowerCase()));if(o){sel.value=o.value;sel.dispatchEvent(new Event('change',{bubbles:true));return}await sleep(200)}}

  async function loadManagerControl(){
    const ids={assigned:'crm1WMAssigned',worked:'crm1WMWorked',pending:'crm1WMPending',callbacks:'crm1WMCallbacks',orders:'crm1WMOrders',agents:'crm1WMAgents'};
    try{const d=today(),start=d+'T00:00:00';const {data:leads=[]}=await db().from('crm_leads').select('id,assigned_to,lead_status,assigned_at,first_contact_at,last_contact_at').gte('assigned_at',start);const {count:orders}=await db().from('orders').select('*',{count:'exact',head:true}).gte('created_at',start);const {data:sessions=[]}=await db().from('crm_agent_sessions').select('user_id,login_at,last_seen_at').gte('login_at',start);const {data:agents=[]}=await db().from('profiles').select('id,full_name,email,role,is_active').eq('is_active',true).eq('role','agent');
      document.getElementById(ids.assigned).textContent=leads.length;document.getElementById(ids.worked).textContent=leads.filter(x=>x.first_contact_at||['contacted','followup','qualified','converted','lost'].includes(x.lead_status)).length;document.getElementById(ids.pending).textContent=leads.filter(x=>x.lead_status==='assigned').length;document.getElementById(ids.callbacks).textContent=leads.filter(x=>x.lead_status==='followup').length;document.getElementById(ids.orders).textContent=orders||0;document.getElementById(ids.agents).textContent=new Set(sessions.map(x=>x.user_id)).size;
      const map=agents.reduce((o,a)=>(o[a.id]={name:a.full_name||a.email,assigned:0,worked:0,pending:0,callback:0},o),{});leads.forEach(x=>{if(!map[x.assigned_to])return;map[x.assigned_to].assigned++;if(x.lead_status==='assigned')map[x.assigned_to].pending++;else map[x.assigned_to].worked++;if(x.lead_status==='followup')map[x.assigned_to].callback++});const body=document.getElementById('crm1WMRows');body.innerHTML=Object.values(map).map(x=>`<tr><td>${esc(x.name)}</td><td>${x.assigned}</td><td>${x.worked}</td><td>${x.pending}</td><td>${x.callback}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No agent activity today.</td></tr>';
    }catch(e){const box=document.getElementById('crm1WMMsg');if(box){box.textContent=e.message||String(e);box.className='crm1wf-message err'}}
  }
  function renderManager(){page('crm1ManagerControl','Manager Daily Control','Daily attendance, lead allocation, calling work and orders',`<div class="crm1wf-grid"><div class="stat"><span>Agents Logged In Today</span><div id="crm1WMAgents" class="crm1wf-num">0</div></div><div class="stat"><span>Assigned Today</span><div id="crm1WMAssigned" class="crm1wf-num">0</div></div><div class="stat"><span>Worked</span><div id="crm1WMWorked" class="crm1wf-num">0</div></div><div class="stat"><span>Pending</span><div id="crm1WMPending" class="crm1wf-num">0</div></div><div class="stat"><span>Callbacks</span><div id="crm1WMCallbacks" class="crm1wf-num">0</div></div><div class="stat"><span>Orders Today</span><div id="crm1WMOrders" class="crm1wf-num">0</div></div></div><div class="panel"><div id="crm1WMMsg" class="crm1wf-message"></div><table><thead><tr><th>Agent</th><th>Assigned</th><th>Worked</th><th>Pending</th><th>Callbacks</th></tr></thead><tbody id="crm1WMRows"></tbody></table></div>`);loadManagerControl()}

  async function boot(){
    for(let i=0;i<30&&!window.sb;i++)await sleep(200);if(!window.sb)return;const {data:{user}}=await db().auth.getUser();if(!user)return;me=user;const {data:p}=await db().from('profiles').select('id,full_name,email,role,is_active').eq('id',user.id).maybeSingle();profile=p||{};style();await initSession();
    if(managerRoles.includes(profile.role)){navButton('crm1ManagerControl','📊 Manager Control',managerRoles);navButton('crm1LeadImport','📥 Lead Import',managerRoles);navButton('crm1LeadAssignment','👥 Lead Assignment',managerRoles)}
    navButton('crm1TodayQueue','📞 Today\'s Calling Queue',['agent','management','order_manager','super_admin']);
    renderManager();renderImport();renderAssignment();renderTodayQueue();
    // Default page: retain existing CRM1 dashboard; modules only appear through navigation.
    window.addEventListener('crm1DataChanged',()=>{loadTodayQueue();if(managerRoles.includes(profile.role))loadManagerControl()});
    window.addEventListener('crm1QueueLeadOpened',()=>setTimeout(applyQueueContext,150));
    const existingOpen=window.crm1OpenCallWorkspace;
    void existingOpen;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();