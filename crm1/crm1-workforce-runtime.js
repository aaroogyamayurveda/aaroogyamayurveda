/* CRM1 workforce runtime loader: load workforce modules only after auth is available. */
(function(){
  'use strict';
  var started=false,reportStarted=false;
  function addReports(){
    if(reportStarted||!window.sb)return;
    window.sb.auth.getUser().then(function(r){
      if(!r||!r.data||!r.data.user||reportStarted)return;
      window.sb.from('profiles').select('role').eq('id',r.data.user.id).maybeSingle().then(function(p){
        var role=p.data&&p.data.role;
        if(['super_admin','management','order_manager'].indexOf(role)<0)return;
        reportStarted=true;
        var nav=document.getElementById('nav'); if(!nav)return;
        if(!document.getElementById('crm1NavManagerReports')){
          var b=document.createElement('button');b.id='crm1NavManagerReports';b.type='button';b.textContent='📈 Manager Reports';nav.appendChild(b);
          b.onclick=function(){
            var pages=document.querySelectorAll('.page');for(var i=0;i<pages.length;i++)pages[i].classList.remove('active');
            var p=document.getElementById('crm1ManagerReports');
            if(!p){p=document.createElement('section');p.id='crm1ManagerReports';p.className='page';p.innerHTML='<div class="title"><div><h2>Manager Reports</h2><div class="sub">Agent performance, dispositions and orders</div></div></div><div class="panel"><button class="btn" id="crm1RptRun">Generate Today Report</button><div id="crm1RptMsg" style="margin-top:8px"></div></div><div class="crm-adv-grid"><div class="stat"><span>Leads</span><b id="rptLeads">0</b></div><div class="stat"><span>Worked</span><b id="rptWorked">0</b></div><div class="stat"><span>Follow-ups</span><b id="rptFollowups">0</b></div><div class="stat"><span>Converted</span><b id="rptConverted">0</b></div><div class="stat"><span>Orders</span><b id="rptOrders">0</b></div></div><div class="panel"><h3>Agent Performance</h3><div class="tablewrap"><table><thead><tr><th>Agent</th><th>Assigned</th><th>Worked</th><th>Follow-ups</th><th>Converted</th><th>Orders</th></tr></thead><tbody id="rptAgents"></tbody></table></div></div>';
              document.querySelector('.main')?.appendChild(p);
            }
            p.classList.add('active');
            document.querySelectorAll('#nav button').forEach(function(x){x.classList.remove('active')});b.classList.add('active');
            runReport();
          };
        }
        var runReport=function(){
          var d=new Date().toISOString().slice(0,10),from=d+'T00:00:00',to=d+'T23:59:59.999';
          Promise.all([
            window.sb.from('crm_leads').select('id,assigned_to,lead_status,first_contact_at').gte('created_at',from).lte('created_at',to),
            window.sb.from('orders').select('id,agent_id,created_at').gte('created_at',from).lte('created_at',to),
            window.sb.from('profiles').select('id,full_name,email').eq('is_active',true).eq('role','agent')
          ]).then(function(rs){
            if(rs[0].error)throw rs[0].error;if(rs[1].error)throw rs[1].error;
            var leads=rs[0].data||[],orders=rs[1].data||[],agents=rs[2].data||[],worked=leads.filter(function(x){return !!x.first_contact_at||['contacted','followup','qualified','converted','lost'].indexOf(x.lead_status)>=0}),follow=leads.filter(function(x){return x.lead_status==='followup'}),conv=leads.filter(function(x){return x.lead_status==='converted'});
            document.getElementById('rptLeads').textContent=leads.length;document.getElementById('rptWorked').textContent=worked.length;document.getElementById('rptFollowups').textContent=follow.length;document.getElementById('rptConverted').textContent=conv.length;document.getElementById('rptOrders').textContent=orders.length;
            var map={};agents.forEach(function(a){map[a.id]={name:a.full_name||a.email,assigned:0,worked:0,follow:0,converted:0,orders:0}});leads.forEach(function(x){var z=map[x.assigned_to];if(!z)return;z.assigned++;if(worked.indexOf(x)>=0)z.worked++;if(x.lead_status==='followup')z.follow++;if(x.lead_status==='converted')z.converted++});orders.forEach(function(x){var z=map[x.agent_id];if(z)z.orders++});
            document.getElementById('rptAgents').innerHTML=Object.keys(map).map(function(k){var x=map[k];return '<tr><td>'+x.name+'</td><td>'+x.assigned+'</td><td>'+x.worked+'</td><td>'+x.follow+'</td><td>'+x.converted+'</td><td>'+x.orders+'</td></tr>'}).join('')||'<tr><td colspan="6">No agent data</td></tr>';
            document.getElementById('crm1RptMsg').textContent='Today report generated: '+d;
          }).catch(function(e){document.getElementById('crm1RptMsg').textContent='Report error: '+(e.message||e)});
        };
        if(document.getElementById('crm1NavManagerReports')){document.getElementById('crm1NavManagerReports').onclick();}
      });
    });
  }
  function load(){
    if(started)return;
    var sb=window.sb;if(!sb)return;
    sb.auth.getUser().then(function(r){
      if(!r||!r.data||!r.data.user||started)return;
      started=true;
      var s=document.createElement('script');s.src='./crm1-workforce-v2.js?v=4';s.async=false;
      s.onload=function(){window.dispatchEvent(new CustomEvent('crm1WorkforceReady'));setTimeout(addReports,300);};
      s.onerror=function(){console.error('CRM1 workforce module failed to load');started=false;};
      document.head.appendChild(s);
    }).catch(function(){});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
  window.addEventListener('crm1SupabaseReady',load);
  if(window.sb&&window.sb.auth){window.sb.auth.onAuthStateChange(function(event,session){if(event==='SIGNED_IN'&&session)setTimeout(function(){load();addReports()},100);});}
  setTimeout(function(){load();addReports()},800);
})();
