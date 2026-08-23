/* CRM1 legacy settlements renderer intentionally disabled.
   Operations -> Settlements is owned exclusively by crm1-ist-ops-final-guard.js.
   Keeping this file as a no-op prevents the legacy standalone page from hijacking
   navigation or overwriting the IST-aware renderer after delayed async loads.
*/
(function(){
  'use strict';
  window.__crm1LegacySettlementRendererDisabled = true;
})();
