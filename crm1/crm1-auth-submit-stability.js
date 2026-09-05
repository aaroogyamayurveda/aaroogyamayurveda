/* CRM1 login stability: deterministic password sign-in with timeout and useful errors. */
(function(){
  'use strict';
  if(window.__crm1AuthSubmitStability) return;
  window.__crm1AuthSubmitStability=true;

  var AUTH_URL='https://ielebadardbzmoxantsc.supabase.co/auth/v1/token?grant_type=password';
  var API_KEY='sb_publishable_0pekrOT6vhYZYQ48wHr7Ag_NPcpobGj';
  var busy=false;

  function msg(t){var el=document.getElementById('loginMsg');if(el)el.textContent=t||'';}

  async function login(email,password){
    var controller=new AbortController();
    var timeout=setTimeout(function(){controller.abort();},15000);
    try{
      var res=await fetch(AUTH_URL,{method:'POST',headers:{'Content-Type':'application/json','apikey':API_KEY,'Authorization':'Bearer '+API_KEY},body:JSON.stringify({email:email,password:password}),signal:controller.signal,cache:'no-store'});
      var body={};
      try{body=await res.json();}catch(e){}
      if(!res.ok) throw new Error(body.error_description||body.msg||body.message||('Login failed (HTTP '+res.status+')'));
      if(!body.access_token||!body.refresh_token) throw new Error('Login response did not contain a valid session.');
      if(!window.sb?.auth) throw new Error('CRM authentication client is not ready.');
      var s=await window.sb.auth.setSession({access_token:body.access_token,refresh_token:body.refresh_token});
      if(s.error) throw s.error;
    }finally{clearTimeout(timeout);}
  }

  function install(){
    var form=document.getElementById('loginForm');
    if(!form) return;
    form.onsubmit=async function(e){
      e.preventDefault();
      if(busy)return;
      busy=true;
      var button=form.querySelector('button[type="submit"]');
      if(button)button.disabled=true;
      msg('Login हो रहा है…');
      try{
        await login((document.getElementById('email')||{}).value?.trim()||'',(document.getElementById('password')||{}).value||'');
        window.location.replace(window.location.pathname);
      }catch(err){
        var text=err?.name==='AbortError'?'Login timeout: Supabase Auth ने 15 seconds में response नहीं दिया.':(err?.message||String(err));
        msg('Login failed: '+text);
      }finally{
        busy=false;
        if(button)button.disabled=false;
      }
    };
  }

  function boot(){
    install();
    setTimeout(install,250);
    setTimeout(install,1000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
