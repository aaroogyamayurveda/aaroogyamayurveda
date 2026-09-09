/* CRM1: Keep the existing callback follow-up value intact, but expose separate date and time controls. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  function sync(){
    const extra=$('cdExtra'), old=$('cdFollow');
    if(!extra||!old||$('cdFollowDate')||$('cdFollowTime'))return;
    const current=old.value||'';
    const date=document.createElement('input');
    date.id='cdFollowDate';
    date.type='date';
    date.required=true;
    const time=document.createElement('input');
    time.id='cdFollowTime';
    time.type='time';
    time.required=true;
    const hidden=document.createElement('input');
    hidden.id='cdFollow';
    hidden.type='hidden';
    hidden.value=current;
    const wrap=old.parentElement;
    if(!wrap)return;
    wrap.innerHTML='<label>Next Follow-up Date & Time *</label>';
    const row=document.createElement('div');
    row.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:10px';
    row.appendChild(date); row.appendChild(time); row.appendChild(hidden);
    wrap.appendChild(row);
    if(current){
      const m=current.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
      if(m){date.value=m[1];time.value=m[2];}
    }
    const update=()=>{hidden.value=(date.value&&time.value)?date.value+'T'+time.value:''};
    date.addEventListener('change',update);time.addEventListener('change',update);
  }
  const observer=new MutationObserver(sync);
  function boot(){
    const extra=$('cdExtra');
    if(!extra)return setTimeout(boot,250);
    observer.observe(extra,{childList:true,subtree:true});
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
