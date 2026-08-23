/* CRM1 API compatibility: normalize legacy Supabase/PostgREST order selects.
 * The core CRM1 order query has two compatibility issues:
 * 1) orders has several FKs to profiles, so profiles:agent_id(...) is ambiguous.
 * 2) order_items uses quantity, while legacy UI code asks for qty.
 * Rewrite only these exact legacy selectors; all other Supabase requests remain untouched.
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
      if(!sel)return input;
      sel=sel.replace(/profiles:agent_id\(/g,'profiles!orders_agent_id_fkey(');
      sel=sel.replace(/qty\s*:/g,'qty:');
      /* The legacy query asks for order_items(...,qty,...). The database column is
         quantity. Alias the real column back to qty so existing renderers continue
         to receive the property they expect. */
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
