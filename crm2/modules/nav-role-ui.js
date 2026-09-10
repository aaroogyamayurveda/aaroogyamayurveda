import {currentProfile} from '../data.js';

const MANAGEMENT_ROLES=['super_admin','admin','manager','assistant_manager','team_leader'];
const NAV_ITEMS=[
  ['crm2-admin-nav','Admin / Config','admin'],
  ['crm2-assignment-nav','Lead Assignment','assignments'],
  ['crm2-mis-nav','MIS Drilldown','mis']
];

function activate(id){document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===id))}
async function openPage(mode){
  const main=document.querySelector('#main');
  if(!main)return;
  if(mode==='admin'){
    const {mountAdmin}=await import('./admin-ui.js');
    activate('admin');
    await mountAdmin(main);
  }else{
    const {mountManagement}=await import('./management-ui.js');
    activate(`management_${mode}`);
    await mountManagement(main,mode);
  }
}
function addButtons(side,role){
  if(!side||!MANAGEMENT_ROLES.includes(role))return;
  for(const [id,label,mode] of NAV_ITEMS){
    if(side.querySelector(`#${id}`))continue;
    const b=document.createElement('button');
    b.id=id;
    b.dataset.page=mode==='admin'?'admin':`management_${mode}`;
    b.textContent=label;
    b.onclick=()=>openPage(mode);
    side.appendChild(b);
  }
}
async function sync(){
  const side=document.querySelector('.side');
  if(!side)return;
  let role=document.documentElement.dataset.crm2Role||'';
  if(!role){
    const profile=await currentProfile();
    role=profile?.role||'';
  }
  addButtons(document.querySelector('.side'),role);
}
new MutationObserver(()=>sync()).observe(document.body,{childList:true,subtree:true});
sync();
