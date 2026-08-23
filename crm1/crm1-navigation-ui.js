/* CRM1 Navigation UI v2: preserve every nav item, stable dashboard default, independent sidebar/main scrolling. */
(function(){
  'use strict';
  var started=false, userInteracted=false, rebuildTimer=null, observer=null;
  var LS_MODE='crm1.nav.viewMode',LS_GROUPS='crm1.nav.groups',LS_SIDESCROLL='crm1.nav.sidebarScroll';
  var $=function(id){return document.getElementById(id)};

  var GROUPS=[
    {id:'home',title:'HOME',keys:['dashboard']},
    {id:'orders',title:'ORDERS & DELIVERY',keys:['create order','order search','order assignment','verification queue','order timeline','courier orders','dealer orders']},
    {id:'customers',title:'CUSTOMERS & LEADS',keys:['customer 360','lead management','lead assignment','lead / enquiry manager','follow-ups']},
    {id:'calling',title:'CALLING & TELEPHONY',keys:["today's calling queue",'telephony bridge','telephony admin','call console']},
    {id:'operations',title:'OPERATIONS',keys:['pin auto assignment','inventory','delivery partners','settlements']},
    {id:'reports',title:'REPORTS & PERFORMANCE',keys:['reports','advanced reports','agent performance','manager reports','qa & dispositions','conversion workbench']},
    {id:'management',title:'MANAGEMENT',keys:['user management','manager control','campaigns','lead import']}
  ];

  function norm(s){return String(s||'').replace(/\s+/g,' ').trim().toLowerCase()}
  function labelOf(b){return norm(b&&b.textContent)}
  function groupFor(label){
    for(var i=0;i<GROUPS.length;i++){
      if(GROUPS[i].keys.some(function(k){return label===k||label.indexOf(k)!==-1||k.indexOf(label)!==-1}))return GROUPS[i];
    }
    return {id:'other',title:'OTHER',keys:[]};
  }
  function readGroups(){try{return JSON.parse(localStorage.getItem(LS_GROUPS)||'{}')}catch(e){return {}}}
  function saveGroups(s){try{localStorage.setItem(LS_GROUPS,JSON.stringify(s))}catch(e){}}
  function mode(){try{return localStorage.getItem(LS_MODE)||'sidebar'}catch(e){return 'sidebar'}}

  function addStyles(){
    if($('crm1NavigationUIStyleV2'))return;
    var s=document.createElement('style');s.id='crm1NavigationUIStyleV2';
    s.textContent=`
      .layout.crm1-nav-layout{height:calc(100vh - 68px);min-height:0;overflow:hidden;grid-template-columns:235px minmax(0,1fr)}
      .side.crm1-nav-side{height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;position:relative;padding-top:14px;padding-bottom:22px}
      .main.crm1-nav-main{height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;scroll-behavior:auto}
      .crm1-nav-group{margin:0 0 8px;padding:0 2px}.crm1-nav-group-title{display:flex;align-items:center;justify-content:space-between;padding:10px 10px 5px;color:#a9c4b3;font-size:10px;font-weight:900;letter-spacing:.08em;cursor:pointer;user-select:none}.crm1-nav-group-title span:last-child{font-size:12px;opacity:.75}.crm1-nav-group-body{display:block}.crm1-nav-group.collapsed .crm1-nav-group-body{display:none}
      .crm1-nav-side .crm1-nav-group-body>button{margin:2px 0;padding:10px 11px}.crm1-nav-icon{display:inline-flex;width:24px;justify-content:center;margin-right:5px;font-size:15px;vertical-align:middle}.crm1-nav-label{vertical-align:middle}
      .crm1-view-btn{margin-left:8px;border:1px solid var(--border);background:#fff;color:var(--g);border-radius:9px;padding:8px 11px;font-weight:800}.crm1-view-menu{position:fixed;right:18px;top:57px;z-index:300;background:#fff;border:1px solid var(--border);border-radius:12px;box-shadow:0 16px 35px #0002;padding:8px;min-width:170px;display:none}.crm1-view-menu.open{display:block}.crm1-view-menu button{display:block;width:100%;text-align:left;border:0;background:#fff;border-radius:8px;padding:9px 10px;color:var(--text);cursor:pointer}.crm1-view-menu button:hover{background:#f4f7f4}.crm1-view-menu .active{background:#eef5ef;color:var(--g);font-weight:800}
      .app.crm1-compact .layout.crm1-nav-layout{grid-template-columns:76px minmax(0,1fr)}.app.crm1-compact .side.crm1-nav-side{overflow-x:hidden}.app.crm1-compact .crm1-nav-group-title{justify-content:center;padding-left:3px;padding-right:3px}.app.crm1-compact .crm1-nav-group-title span:first-child{font-size:0}.app.crm1-compact .crm1-nav-group-title span:first-child:after{content:'•';font-size:12px}.app.crm1-compact .side button{white-space:nowrap;text-align:center;padding:10px 6px}.app.crm1-compact .crm1-nav-icon{width:auto;margin:0}.app.crm1-compact .crm1-nav-label{display:none}
      .crm1-topnav{display:none;background:#123c27;color:#fff;position:sticky;top:0;z-index:15;box-shadow:0 2px 8px #0002;padding:6px 10px;overflow-x:auto;white-space:nowrap}.crm1-topnav-group{display:inline-flex;align-items:center;gap:4px;margin-right:12px}.crm1-topnav-title{color:#a9c4b3;font-size:9px;font-weight:900;letter-spacing:.06em;margin:0 3px}.crm1-topnav button{border:0;background:transparent;color:#eef7f0;border-radius:7px;padding:8px 9px;font-weight:700;cursor:pointer;white-space:nowrap}.crm1-topnav button.active,.crm1-topnav button:hover{background:#ffffff18}
      .app.crm1-topbar .side.crm1-nav-side{display:none}.app.crm1-topbar .layout.crm1-nav-layout{display:block;height:calc(100vh - 68px)}.app.crm1-topbar .main.crm1-nav-main{height:calc(100vh - 68px);max-width:none;padding-top:20px}.app.crm1-topbar .crm1-topnav{display:block}
      @media(max-width:850px){.layout.crm1-nav-layout{height:auto;min-height:calc(100vh - 68px);overflow:visible;display:grid;grid-template-columns:1fr}.side.crm1-nav-side{height:auto;max-height:260px;overflow:auto;position:static}.main.crm1-nav-main{height:auto;overflow:visible}.crm1-topnav{position:sticky;top:68px}.app.crm1-topbar .layout.crm1-nav-layout{height:auto}.app.crm1-topbar .main.crm1-nav-main{height:auto}.app.crm1-compact .layout.crm1-nav-layout{grid-template-columns:1fr}.app.crm1-compact .side.crm1-nav-side{max-height:180px}.crm1-view-menu{right:10px}}
    `;
    document.head.appendChild(s);
  }

  function collectButtons(){
    var nav=$('nav');if(!nav)return [];
    return Array.prototype.filter.call(nav.querySelectorAll('button'),function(b){
      if(b.id==='crm1ViewBtn'||b.closest('#crm1ViewMenu'))return false;
      if(b.closest('#crm1TopNav'))return false;
      if(b.classList.contains('crm1-nav-group-toggle'))return false;
      return true;
    });
  }

  function normalizeButton(b){
    if(b.dataset.crm1Wrapped==='1')return;
    var raw=String(b.textContent||'').trim();
    if(!raw)return;
    var first=Array.from(raw)[0]||'•';
    var rest=raw.slice(first.length).trim();
    b.innerHTML='<span class="crm1-nav-icon">'+first+'</span><span class="crm1-nav-label">'+rest+'</span>';
    b.dataset.crm1Wrapped='1';
  }

  function rebuildGroups(){
    var nav=$('nav');if(!nav)return;
    var buttons=collectButtons();if(!buttons.length)return;
    buttons.forEach(normalizeButton);
    var groups={};
    buttons.forEach(function(b){var g=groupFor(labelOf(b));(groups[g.id]||(groups[g.id]=[])).push(b)});

    nav.querySelectorAll('.crm1-nav-group').forEach(function(x){x.remove()});
    buttons.forEach(function(b){if(b.parentElement===nav)b.remove()});

    var saved=readGroups(), ordered=GROUPS.concat([{id:'other',title:'OTHER',keys:[]}]);
    ordered.forEach(function(g){
      var items=groups[g.id]||[];if(!items.length)return;
      var wrap=document.createElement('div');wrap.className='crm1-nav-group';wrap.dataset.group=g.id;
      var head=document.createElement('div');head.className='crm1-nav-group-title';
      head.innerHTML='<span>'+g.title+'</span><span>'+(saved[g.id]?'›':'⌄')+'</span>';
      var body=document.createElement('div');body.className='crm1-nav-group-body';
      items.forEach(function(b){body.appendChild(b)});
      wrap.appendChild(head);wrap.appendChild(body);nav.appendChild(wrap);
      if(saved[g.id]===true)wrap.classList.add('collapsed');
      head.onclick=function(){var c=wrap.classList.toggle('collapsed');head.lastElementChild.textContent=c?'›':'⌄';var st=readGroups();st[g.id]=c;saveGroups(st)};
    });
  }

  function scheduleRebuild(){clearTimeout(rebuildTimer);rebuildTimer=setTimeout(function(){rebuildGroups();preserveSidebarScroll();syncTopbar()},60)}

  function ensureViewControl(){
    var top=document.querySelector('.top');if(!top||$('crm1ViewBtn'))return;
    var host=top.querySelector('div:last-child');if(!host)return;
    var btn=document.createElement('button');btn.id='crm1ViewBtn';btn.className='crm1-view-btn';btn.type='button';btn.textContent='☷ View';host.insertBefore(btn,host.querySelector('#logout')||null);
    var menu=document.createElement('div');menu.id='crm1ViewMenu';menu.className='crm1-view-menu';menu.innerHTML='<button data-mode="sidebar">▤ Sidebar View</button><button data-mode="compact">▥ Compact Sidebar</button><button data-mode="topbar">☰ Top Bar View</button>';
    document.body.appendChild(menu);
    btn.onclick=function(e){e.stopPropagation();menu.classList.toggle('open');refreshModeButtons()};
    menu.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;try{localStorage.setItem(LS_MODE,b.dataset.mode)}catch(x){}applyMode(b.dataset.mode);menu.classList.remove('open')});
    document.addEventListener('click',function(e){if(!menu.contains(e.target)&&e.target!==btn)menu.classList.remove('open')});
  }
  function refreshModeButtons(){var m=mode();$('crm1ViewMenu')?.querySelectorAll('button').forEach(function(b){b.classList.toggle('active',b.dataset.mode===m)})}
  function buildTopbar(){
    var old=$('crm1TopNav');if(old)old.remove();
    var nav=$('nav');if(!nav)return;
    var t=document.createElement('div');t.id='crm1TopNav';t.className='crm1-topnav';
    nav.querySelectorAll('.crm1-nav-group').forEach(function(g){
      var tg=document.createElement('div');tg.className='crm1-topnav-group';
      var title=document.createElement('span');title.className='crm1-topnav-title';title.textContent=g.querySelector('.crm1-nav-group-title span')?.textContent||'';tg.appendChild(title);
      g.querySelectorAll('button').forEach(function(orig){var c=document.createElement('button');c.type='button';c.dataset.origId=orig.id;c.innerHTML=orig.innerHTML;c.className=orig.className;c.onclick=function(){userInteracted=true;orig.click()};tg.appendChild(c)});
      t.appendChild(tg);
    });
    document.querySelector('.main')?.parentElement?.before(t);syncTopbar();
  }
  function syncTopbar(){var nav=$('nav'),t=$('crm1TopNav');if(!nav||!t)return;t.querySelectorAll('button[data-orig-id]').forEach(function(b){var o=$(b.dataset.origId);b.classList.toggle('active',!!o&&o.classList.contains('active'))})}
  function applyMode(v){var app=$('app');if(!app)return;app.classList.remove('crm1-compact','crm1-topbar');if(v==='compact')app.classList.add('crm1-compact');if(v==='topbar')app.classList.add('crm1-topbar');refreshModeButtons();buildTopbar()}

  function side(){return $('nav')?.closest('.side')}
  function main(){return document.querySelector('.main')}
  function preserveSidebarScroll(){var s=side();if(!s)return;var pos=Number(localStorage.getItem(LS_SIDESCROLL)||0);if(Number.isFinite(pos))s.scrollTop=pos}
  function saveSidebarScroll(){var s=side();if(s)try{localStorage.setItem(LS_SIDESCROLL,String(s.scrollTop))}catch(e){}}
  function resetMainScroll(){var m=main();if(m)m.scrollTop=0;window.scrollTo(0,0)}

  function bindScrollAndNavigation(){
    var s=side(),m=main();
    if(s)s.addEventListener('scroll',saveSidebarScroll,{passive:true});
    document.addEventListener('click',function(e){
      var btn=e.target.closest&&e.target.closest('#nav button');if(!btn)return;
      userInteracted=true;saveSidebarScroll();var pos=s?s.scrollTop:0;
      requestAnimationFrame(function(){if(s)s.scrollTop=pos;resetMainScroll();syncTopbar()});
    },true);
    if(observer)return;
    observer=new MutationObserver(function(){scheduleRebuild()});
    var nav=$('nav');if(nav)observer.observe(nav,{childList:true,subtree:true});
    if(m)m.addEventListener('scroll',function(){},{passive:true});
  }

  function findDashboardButton(){
    var all=collectButtons();
    return all.find(function(b){return /dashboard/i.test(String(b.textContent||''))})||null;
  }
  function forceDashboard(){
    if(userInteracted)return;
    var dash=$('dashboard');if(!dash)return;
    var active=document.querySelector('.main .page.active');
    if(active&&active.id==='dashboard')return;
    var b=findDashboardButton();if(b){b.click();resetMainScroll()}
  }

  function init(){
    if(started)return;started=true;addStyles();
    var layout=document.querySelector('.layout'),s=side(),m=main();
    if(layout)layout.classList.add('crm1-nav-layout');if(s)s.classList.add('crm1-nav-side');if(m)m.classList.add('crm1-nav-main');
    ensureViewControl();rebuildGroups();bindScrollAndNavigation();applyMode(mode());preserveSidebarScroll();
    setTimeout(function(){rebuildGroups();preserveSidebarScroll();forceDashboard()},250);
    setTimeout(function(){if(!userInteracted){rebuildGroups();preserveSidebarScroll();forceDashboard()}},1000);
    setTimeout(function(){if(!userInteracted){rebuildGroups();preserveSidebarScroll();forceDashboard()}},1800);
    var app=$('app');if(app){var appObs=new MutationObserver(function(){syncTopbar()});appObs.observe(app,{subtree:true,attributes:true,attributeFilter:['class']})}
  }

  function wait(){var tries=0,t=setInterval(function(){if($('app')&&$('nav')&&collectButtons().length){clearInterval(t);init()}if(++tries>160)clearInterval(t)},100)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wait,{once:true});else wait();
})();