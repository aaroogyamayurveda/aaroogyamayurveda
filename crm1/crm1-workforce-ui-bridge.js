/* CRM1 workforce UI bridge: guarantee Manager/Agent workforce navigation is present after CRM auth and after legacy nav rebuilds. */
(function(){
  'use strict';
  var managerRoles=['super_admin','management','order_manager'];
  var agentRoles=['agent','management','order_manager','super_admin'];
  var wait=function(ms){return new Promise(function(r){setTimeout(r,ms);});};
  var userId=null, navObserverStarted=false;

  function navText(b){return String(b&&b.textContent||'').replace(/\s+/g,' ').trim().replace(/^[^A-Za-z]+/,'').trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];});}

  function canonicalizeNav(){
    var nav=document.getElementById('nav');
    if(!nav)return;
    var keep={
      'Lead Assignment':'crm1W2Nav_crm1W2Assignment',
      'Lead Import':'crm1W2Nav_crm1W2Import',
      'Manager Control':'crm1W2Nav_crm1W2Manager',
      "Today's Calling Queue":'crm1W2Nav_crm1W2Queue'
    };
    Object.keys(keep).forEach(function(label){
      var matches=Array.prototype.filter.call(nav.querySelectorAll('button'),function(b){return navText(b)===label;});
      if(matches.length){
        matches.forEach(function(b,i){if(i>0)b.remove();});
        if(matches[0].id!==keep[label])matches[0].remove();
      }
    });
  }

  function queuePage(){
    var p=document.getElementById('crm1W2Queue');
    if(!p){
      var main=document.querySelector('.main');
      if(!main)return null;
      p=document.createElement('section');
      p.id='crm1W2Queue';p.className='page';
      p.innerHTML='<div class="title"><div><h2>Today\'s Calling Queue</h2><div class="sub">Customers assigned to you for manual outbound calling</div></div></div><div class="panel"><div id="crm1W2_queueMsg" class="crm1wf2-msg"></div><div id="crm1W2_queueTable"></div></div>';
      main.appendChild(p);
    }
    return p;
  }

  function openQueue(){
    var p=queuePage();
    if(!p)return;
    document.querySelectorAll('.main .page').forEach(function(x){x.classList.remove('active');});
    p.classList.add('active');
    document.querySelectorAll('#nav button').forEach(function(b){b.classList.remove('active');});
    var b=document.getElementById('crm1W2Nav_crm1W2Queue');if(b)b.classList.add('active');
    window.scrollTo(0,0);
    var box=document.getElementById('crm1W2_queueTable'),msg=document.getElementById('crm1W2_queueMsg');
    if(!box||!window.sb)return;
    msg.textContent='Loading queue...';
    window.sb.from('crm_leads').select('id,mobile,lead_name,product_name,city,state,lead_status').eq('assigned_to',userId).in('lead_status',['assigned','contacted','followup','qualified']).order('assigned_at',{ascending:true}).then(function(r){
      if(r.error)throw r.error;
      var data=r.data||[];
      msg.textContent=data.length+' active leads in your queue.';
      box.innerHTML='<table><thead><tr><th>Mobile</th><th>Customer</th><th>Product</th><th>City</th><th>State</th><th>Status</th></tr></thead><tbody>'+(data.map(function(x){return'<tr><td>'+esc(x.mobile)+'</td><td>'+esc(x.lead_name||'')+'</td><td>'+esc(x.product_name||'')+'</td><td>'+esc(x.city||'')+'</td><td>'+esc(x.state||'')+'</td><td><span class="pill">'+esc(x.lead_status||'')+'</span></td></tr>';}).join('')||'<tr><td colspan="6" class="empty">No leads assigned.</td></tr>')+'</tbody></table>';
    }).catch(function(e){msg.textContent='Queue error: '+(e.message||String(e));msg.className='crm1wf2-msg err';box.innerHTML='';});
  }

  function addButton(id,label){
    var nav=document.getElementById('nav');
    if(!nav)return;
    var b=document.getElementById(id);
    if(!b){
      b=document.createElement('button');
      b.type='button'; b.id=id; b.textContent=label;
      b.dataset.crm1WorkforceNav='1';
      nav.appendChild(b);
    }
    b.onclick=function(e){
      if(e){e.preventDefault();e.stopPropagation();}
      if(id==='crm1W2Nav_crm1W2Queue'){openQueue();return;}
      var target=id.replace('crm1W2Nav_','');
      if(window.crm1WorkforceOpenPage){window.crm1WorkforceOpenPage(target);return;}
      setTimeout(function(){if(window.crm1WorkforceOpenPage)window.crm1WorkforceOpenPage(target);},150);
    };
  }

  async function profileFor(user){
    try{
      var r=await window.sb.from('profiles').select('id,full_name,email,role,is_active').eq('id',user.id).maybeSingle();
      return r.data||null;
    }catch(e){return null;}
  }

  async function ensure(){
    if(!window.sb||!window.sb.auth)return;
    var r=await window.sb.auth.getUser();
    var user=r&&r.data&&r.data.user;
    if(!user){userId=null;return;}
    userId=user.id;
    var p=await profileFor(user); if(!p)return;
    canonicalizeNav();
    if(managerRoles.indexOf(p.role)>=0){
      addButton('crm1W2Nav_crm1W2Manager','📊 Manager Control');
      addButton('crm1W2Nav_crm1W2Import','📥 Lead Import');
      addButton('crm1W2Nav_crm1W2Assignment','👥 Lead Assignment');
    }
    if(agentRoles.indexOf(p.role)>=0) addButton('crm1W2Nav_crm1W2Queue',"📞 Today's Calling Queue");
  }

  function observe(){
    if(navObserverStarted)return; navObserverStarted=true;
    var start=function(){
      var nav=document.getElementById('nav');
      if(!nav)return;
      new MutationObserver(function(){setTimeout(ensure,50);}).observe(nav,{childList:true,subtree:true});
      ensure();
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  }

  function loadWorkforce(){
    if(window.__crm1WorkforceV2Injected)return Promise.resolve();
    window.__crm1WorkforceV2Injected='loading';
    return new Promise(function(resolve,reject){
      var s=document.createElement('script'); s.src='./crm1-workforce-v2.js?v=7'; s.async=false;
      s.onload=function(){window.__crm1WorkforceV2Injected='loaded';setTimeout(ensure,120);resolve();};
      s.onerror=function(){window.__crm1WorkforceV2Injected=null;reject(new Error('CRM1 workforce module failed to load'));};
      document.head.appendChild(s);
    });
  }

  async function start(){
    for(var i=0;i<80;i++){if(window.sb&&window.sb.auth)break;await wait(250);}
    if(!window.sb||!window.sb.auth)return;
    observe();
    try{var r=await window.sb.auth.getUser();if(r&&r.data&&r.data.user){await loadWorkforce();await ensure();}}catch(e){}
    window.sb.auth.onAuthStateChange(function(event,session){
      if(session&&session.user){setTimeout(async function(){try{await loadWorkforce();await ensure();}catch(e){}},50);}
      if(event==='SIGNED_OUT'){userId=null;window.__crm1WorkforceV2Injected=null;}
    });
    setTimeout(ensure,800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();