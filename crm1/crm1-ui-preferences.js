/* CRM1 UI preferences: visual-only enhancement layer. Does not change auth, DB, roles or order logic. */
(function(){
  'use strict';
  const STORAGE_THEME='crm1_theme', STORAGE_FONT='crm1_font_size';
  const $=id=>document.getElementById(id);
  const themes={
    emerald:{label:'Emerald Pro',vars:{'--g':'#164b30','--g2':'#246743','--bg':'#f4f7f4','--card':'#ffffff','--text':'#18241d','--muted':'#69756e','--border':'#dfe7e1','--gold':'#b8862b','--red':'#b43b35','--blue':'#245f86'}},
    midnight:{label:'Midnight',vars:{'--g':'#7dd3a8','--g2':'#4ade80','--bg':'#0f1720','--card':'#17212b','--text':'#e8eef3','--muted':'#a7b4bf','--border':'#2b3945','--gold':'#e7c56a','--red':'#fb7185','--blue':'#60a5fa'}},
    ocean:{label:'Ocean Blue',vars:{'--g':'#155e75','--g2':'#0e7490','--bg':'#f1f7fb','--card':'#ffffff','--text':'#172b3a','--muted':'#64748b','--border':'#d7e4ed','--gold':'#b7791f','--red':'#dc3f3f','--blue':'#2563eb'}}
  };
  function injectStyle(){
    if($('crm1UIPreferencesStyle'))return;
    const s=document.createElement('style');s.id='crm1UIPreferencesStyle';
    s.textContent=`
      [id="crm1StartCall"]{background:#166534!important;color:#fff!important;border-color:#166534!important}
      [id="crm1EndCall"]{background:#fff!important;color:#b91c1c!important;border:1px solid #b91c1c!important}
      [id="crm1EndCall"]:disabled{opacity:.55!important}
      [id="crm1StartCall"].crm-call-active-start{opacity:.42!important;filter:saturate(.55)!important;box-shadow:none!important}
      [id="crm1EndCall"].crm-call-active-end{background:#dc2626!important;color:#fff!important;border-color:#dc2626!important;box-shadow:0 4px 12px rgba(220,38,38,.22)!important}
      .crm1-preferences{display:flex;align-items:center;gap:7px;margin-left:10px;vertical-align:middle;flex-wrap:wrap;justify-content:flex-end}
      .crm1-pref-group{display:flex;align-items:center;gap:3px;background:rgba(255,255,255,.78);border:1px solid var(--border,#dfe7e1);border-radius:10px;padding:3px;box-shadow:0 2px 8px rgba(0,0,0,.04)}
      .crm1-pref-label{font-size:11px!important;font-weight:800!important;color:var(--muted,#69756e)!important;padding:0 5px;white-space:nowrap}
      .crm1-pref-btn{border:0!important;background:transparent!important;color:var(--g,#164b30)!important;border-radius:7px!important;padding:6px 8px!important;font-weight:800!important;font-size:12px!important;line-height:1!important;min-width:31px;box-shadow:none!important;transform:none!important}
      .crm1-pref-btn:hover{background:rgba(22,101,52,.09)!important}
      .crm1-pref-btn.active{background:var(--g,#164b30)!important;color:#fff!important}
      .crm1-theme-menu{position:fixed;top:60px;right:18px;z-index:10050;display:none;width:210px;background:var(--card,#fff);color:var(--text,#18241d);border:1px solid var(--border,#dfe7e1);border-radius:14px;padding:9px;box-shadow:0 16px 40px rgba(0,0,0,.18)}
      .crm1-theme-menu.open{display:block}.crm1-theme-option{width:100%;display:flex;align-items:center;gap:9px;border:0;background:transparent;color:inherit;padding:9px;border-radius:9px;text-align:left;cursor:pointer;font-weight:800}.crm1-theme-option:hover{background:rgba(100,116,139,.10)}
      .crm1-theme-dot{width:14px;height:14px;border-radius:50%;display:inline-block;flex:none;border:1px solid rgba(0,0,0,.12)}.crm1-theme-dot.emerald{background:#166534}.crm1-theme-dot.midnight{background:#17212b}.crm1-theme-dot.ocean{background:#0f766e}
      body.crm1-theme-midnight{background:#0f1720!important;color:#e8eef3!important}body.crm1-theme-midnight .top{background:#111b25!important;border-color:#2b3945!important}body.crm1-theme-midnight .top strong,body.crm1-theme-midnight .title h2,body.crm1-theme-midnight .panel h3,body.crm1-theme-midnight th{color:#7dd3a8!important}body.crm1-theme-midnight .panel,body.crm1-theme-midnight .stat,body.crm1-theme-midnight table,body.crm1-theme-midnight .modalbox,body.crm1-theme-midnight .crm-table-toolbar,body.crm1-theme-midnight .crm-v2-toolbar,body.crm1-theme-midnight .crm1-pref-group{background:#17212b!important;color:#e8eef3!important;border-color:#2b3945!important}body.crm1-theme-midnight th{background:#202d39!important}body.crm1-theme-midnight td{border-color:#263440!important}body.crm1-theme-midnight input,body.crm1-theme-midnight select,body.crm1-theme-midnight textarea{background:#111b25!important;color:#e8eef3!important;border-color:#334454!important}body.crm1-theme-midnight .side{background:#0b1219!important}body.crm1-theme-midnight .crm1-theme-menu{background:#17212b!important;color:#e8eef3!important;border-color:#2b3945!important}
      body.crm1-theme-ocean .side{background:#0b4f66!important}body.crm1-theme-ocean .top strong,body.crm1-theme-ocean .title h2,body.crm1-theme-ocean .panel h3,body.crm1-theme-ocean th{color:#155e75!important}body.crm1-theme-ocean .btn{background:#0f766e!important}body.crm1-theme-ocean .btn.alt{color:#0f766e!important;border-color:#0f766e!important;background:#fff!important}body.crm1-theme-ocean th{background:#edf6fb!important}
      #app.crm1-font-small{zoom:.92}#app.crm1-font-normal{zoom:1}#app.crm1-font-large{zoom:1.08}
      @media(max-width:700px){.crm1-preferences{margin-left:5px}.crm1-theme-menu{right:8px;top:62px}.crm1-pref-label{display:none}.crm1-pref-group{gap:1px}.crm1-pref-btn{padding:6px 7px!important}}
    `;document.head.appendChild(s);
  }
  function applyTheme(name){
    const key=themes[name]?name:'emerald',theme=themes[key];
    Object.entries(theme.vars).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
    document.body.classList.remove('crm1-theme-emerald','crm1-theme-midnight','crm1-theme-ocean');document.body.classList.add('crm1-theme-'+key);
    localStorage.setItem(STORAGE_THEME,key);
    document.querySelectorAll('.crm1-theme-option').forEach(b=>b.classList.toggle('active',b.dataset.theme===key));
    const label=$('crm1ThemeCurrent');if(label)label.textContent=theme.label;
  }
  function applyFont(size){
    const value=['small','normal','large'].includes(size)?size:'normal',app=$('app');if(!app)return;
    app.classList.remove('crm1-font-small','crm1-font-normal','crm1-font-large');app.classList.add('crm1-font-'+value);localStorage.setItem(STORAGE_FONT,value);
    document.querySelectorAll('[data-font-size]').forEach(b=>b.classList.toggle('active',b.dataset.fontSize===value));
  }
  function setCallState(active){
    document.querySelectorAll('[id="crm1StartCall"]').forEach(b=>b.classList.toggle('crm-call-active-start',active));
    document.querySelectorAll('[id="crm1EndCall"]').forEach(b=>b.classList.toggle('crm-call-active-end',active));
  }
  function bindCallButtons(){
    document.querySelectorAll('[id="crm1StartCall"],[id="crm1EndCall"]').forEach(btn=>{
      if(btn.dataset.crmCallVisualBound==='1')return;btn.dataset.crmCallVisualBound='1';
      btn.addEventListener('click',()=>{
        const text=String(btn.textContent||btn.value||btn.getAttribute('aria-label')||btn.title||'').toLowerCase();
        if(text.includes('start'))setTimeout(()=>{if([...document.querySelectorAll('[id="crm1EndCall"]')].some(x=>!x.disabled))setCallState(true)},100);
        else if(text.includes('end'))setTimeout(()=>setCallState(false),100);
      },true);
    });
  }
  function injectControls(){
    if(!$('app')||!$('userInfo')||$('crm1Preferences'))return false;
    const host=$('userInfo').parentElement;if(!host)return false;
    const wrap=document.createElement('span');wrap.id='crm1Preferences';wrap.className='crm1-preferences';
    wrap.innerHTML='<span class="crm1-pref-group"><span class="crm1-pref-label">Theme</span><button type="button" class="crm1-pref-btn" id="crm1ThemeBtn" aria-label="Theme" title="Choose theme">🎨</button></span><span class="crm1-pref-group"><span class="crm1-pref-label">Text</span><button type="button" class="crm1-pref-btn" data-font-size="small" title="Small text">A−</button><button type="button" class="crm1-pref-btn" data-font-size="normal" title="Normal text">A</button><button type="button" class="crm1-pref-btn" data-font-size="large" title="Large text">A+</button></span>';
    host.appendChild(wrap);
    const menu=document.createElement('div');menu.id='crm1ThemeMenu';menu.className='crm1-theme-menu';
    menu.innerHTML='<div style="font-weight:900;padding:5px 7px 7px">Choose Theme</div>'+Object.entries(themes).map(([key,t])=>'<button type="button" class="crm1-theme-option" data-theme="'+key+'"><span class="crm1-theme-dot '+key+'"></span><span>'+t.label+'</span></button>').join('')+'<div id="crm1ThemeCurrent" style="font-size:11px;color:var(--muted);padding:6px 7px 2px"></div>';
    document.body.appendChild(menu);
    $('crm1ThemeBtn').onclick=e=>{e.stopPropagation();menu.classList.toggle('open')};
    menu.querySelectorAll('.crm1-theme-option').forEach(b=>b.onclick=()=>{applyTheme(b.dataset.theme);menu.classList.remove('open')});
    wrap.querySelectorAll('[data-font-size]').forEach(b=>b.onclick=()=>applyFont(b.dataset.fontSize));
    if(!window.crm1UIPrefDocClickBound){window.crm1UIPrefDocClickBound=true;document.addEventListener('click',e=>{if(!e.target.closest('#crm1ThemeMenu,#crm1ThemeBtn'))menu.classList.remove('open')});}
    applyTheme(localStorage.getItem(STORAGE_THEME)||'emerald');applyFont(localStorage.getItem(STORAGE_FONT)||'normal');return true;
  }
  function boot(){
    injectStyle();bindCallButtons();injectControls();
    window.addEventListener('crm1CallStarted',()=>setCallState(true));window.addEventListener('crm1CallEnded',()=>setCallState(false));window.addEventListener('crm1WorkspaceReset',()=>setCallState(false));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)bindCallButtons()});
    /* Observe only DOM additions for newly rendered call buttons. Never re-run theme/font application from the observer. */
    const observer=new MutationObserver(()=>bindCallButtons());observer.observe(document.body,{childList:true,subtree:true});
    setCallState(false);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
