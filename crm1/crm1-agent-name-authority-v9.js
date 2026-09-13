/* CRM1 agent dashboard display-name authority v9. Keeps row Agent column aligned with the visible logged-in identity. */
(function(){'use strict';
if(window.__crm1AgentNameAuthorityV9)return;window.__crm1AgentNameAuthorityV9=true;
function visibleName(){var e=document.getElementById('userInfo');return String(e&&e.textContent||'').split(/\s*•\s*/)[0].trim()}
function sync(){var body=document.getElementById('dashboardOrdersBody'),name=visibleName();if(!body||!name)return;Array.prototype.slice.call(body.querySelectorAll('tr')).forEach(function(tr){if(tr.cells&&tr.cells.length>=8)tr.cells[4].textContent=name})}
function start(){var b=document.getElementById('dashboardOrdersBody');if(b)new MutationObserver(function(){sync()}).observe(b,{childList:true,subtree:true});var u=document.getElementById('userInfo');if(u)new MutationObserver(function(){sync()}).observe(u,{childList:true,subtree:true,characterData:true});sync();setInterval(sync,250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
