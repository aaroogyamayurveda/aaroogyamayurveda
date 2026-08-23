/* CRM1 API compatibility: normalize ambiguous PostgREST order/profile relation requests.
 * The orders table has several FKs to profiles. Older Supabase selects using
 * profiles:agent_id(...) are ambiguous and return HTTP 400. Rewrite only that
 * exact relation to the FK-qualified form while leaving all other requests intact.
 */
(function(){
  'use strict';
  if(window.__crm1ApiCompatInstalled)return;
  window.__crm1ApiCompatInstalled=true;
  var nativeFetch=window.fetch.bind(window);
  function rewrite(input){
    try{
      var u=typeof input==='string'?new URL(input,location.href):new URL(input.url);
      if(!u.hostname.endsWith('.supabase.co'))return input;
      if(!/\/rest\/v1\/orders$/.test(u.pathname))return input;
      var sel=u.searchParams.get('select');
      if(!sel||sel.indexOf('profiles:agent_id(')<0)return input;
      sel=sel.replace(/profiles:agent_id\(/g,'profiles!orders_agent_id_fkey(');
      u.searchParams.set('select',sel);
      if(typeof input==='string')return u.toString();
      return new Request(u.toString(),input);
    }catch(e){return input}
  }
  window.fetch=function(input,init){
    return nativeFetch(rewrite(input),init);
  };
})();
