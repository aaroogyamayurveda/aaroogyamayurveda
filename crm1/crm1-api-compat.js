/* CRM1 API compatibility + script-load guard. */
(function(){
  'use strict';
  if(window.__crm1ApiCompatInstalled)return;
  window.__crm1ApiCompatInstalled=true;

  /* Prevent repeated dynamic insertion of the same core runtime files.
     Duplicate script tags were harmless in diagnostics but caused repeated
     module initialization, observers and delayed render attempts. */
  (function installScriptDedupe(){
    if(window.__crm1ScriptDedupeInstalled)return;
    window.__crm1ScriptDedupeInstalled=true;
    var nativeAppend=Node.prototype.appendChild;
    var keys=[
      {match:/\/crm1-production-suite\.js\?v=1\.1(?:$|[#?])/,key:'production-suite-v1.1'},
      {match:/\/crm1-workforce-v2\.js\?v=5(?:$|[#?])/,key:'workforce-v2-v5'},
      {match:/\/crm1-lead-call-bridge\.js(?:\?|$)/,key:'lead-call-bridge'}
    ];
    function metaFor(src){
      for(var i=0;i<keys.length;i++)if(keys[i].match.test(src))return keys[i];
      return null;
    }
    Node.prototype.appendChild=function(node){
      try{
        if(node&&node.tagName==='SCRIPT'&&node.src){
          var meta=metaFor(node.src);
          if(meta){
            var existing=null;
            var scripts=document.scripts||[];
            for(var i=0;i<scripts.length;i++){
              var s=scripts[i];
              if(s!==node&&s.dataset&&s.dataset.crm1DedupeKey===meta.key){existing=s;break;}
              if(s!==node&&s.src===node.src){existing=s;break;}
            }
            if(existing){
              if(existing.dataset)existing.dataset.crm1DedupeKey=meta.key;
              var onload=node.onload,onerror=node.onerror;
              if(existing.dataset&&existing.dataset.crm1DedupeLoaded==='1'){
                setTimeout(function(){if(typeof onload==='function')onload.call(existing);},0);
              }else{
                if(typeof onload==='function')existing.addEventListener('load',function(){onload.call(existing);},{once:true});
                if(typeof onerror==='function')existing.addEventListener('error',function(e){onerror.call(existing,e);},{once:true});
              }
              return node;
            }
            if(node.dataset){node.dataset.crm1DedupeKey=meta.key;node.addEventListener('load',function(){node.dataset.crm1DedupeLoaded='1';},{once:true});}
          }
        }
      }catch(e){}
      return nativeAppend.call(this,node);
    };
  })();

  /* Normalize legacy PostgREST order/profile relation requests. */
  var nativeFetch=window.fetch.bind(window);
  function rewrite(input){
    try{
      var u=typeof input==='string'?new URL(input,location.href):new URL(input.url);
      if(!u.hostname.endsWith('.supabase.co'))return input;
      if(!/\/rest\/v1\/orders$/.test(u.pathname))return input;
      var sel=u.searchParams.get('select');
      if(!sel)return input;
      sel=sel.replace(/profiles:agent_id\(/g,'profiles!orders_agent_id_fkey(');
      sel=sel.replace(/order_items\(product_id,qty,products\(product_name\)\)/g,'order_items(product_id,qty:quantity,products(product_name))');
      u.searchParams.set('select',sel);
      if(typeof input==='string')return u.toString();
      return new Request(u.toString(),input);
    }catch(e){return input}
  }
  window.fetch=function(input,init){
    return nativeFetch(rewrite(input),init);
  };
})();
