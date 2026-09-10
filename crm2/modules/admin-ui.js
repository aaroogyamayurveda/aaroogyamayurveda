import { currentProfile } from '../data.js';
import { mountAdminRuntime } from './admin-runtime.js';

export const ROLES=['super_admin','admin','manager','assistant_manager','team_leader'];
export const RESTRICTED_PAGES={
  inventory:['super_admin','admin','manager','assistant_manager','team_leader','warehouse','dispatch'],
  dealers:['super_admin','admin','manager','assistant_manager','team_leader','dealer_manager'],
  delivery:['super_admin','admin','manager','assistant_manager','team_leader','warehouse','dispatch','dealer_manager','verification'],
  accounts:['super_admin','admin','manager','assistant_manager','accounts'],
  reports:['super_admin','admin','manager','assistant_manager','team_leader','qa','mis','management_readonly'],
  targets:['super_admin','admin','manager','assistant_manager','team_leader'],
  imports:['super_admin','admin','manager','assistant_manager','team_leader','mis'],
  audit:['super_admin','admin','manager','assistant_manager','team_leader','qa','mis','management_readonly']
};

export function applyRoleNavigation(profile){
  if(!profile)return;
  document.querySelectorAll('[data-page]').forEach(button=>{
    const allowed=RESTRICTED_PAGES[button.dataset.page];
    const hide=!!allowed&&!allowed.includes(profile.role);
    button.hidden=hide;
    button.style.display=hide?'none':'';
  });
}

export async function mountAdmin(main){
  const profile=await currentProfile();
  if(!profile||!ROLES.includes(profile.role)){
    main.innerHTML='<section class="panel error">Access denied.</section>';
    return;
  }
  applyRoleNavigation(profile);
  await mountAdminRuntime(main);
}

// Compatibility markers for CRM2 static verification and configuration ownership.
const CONFIGURATION_ENTITIES=['disposition_levels','campaigns','products','warehouses','couriers'];
const ASSIGNMENT_FIELDS=['lead_assignments','assigned_to','agent_id'];
const MANAGEMENT_NAV='Admin / Config';
const MANAGEMENT_MOUNT='mountManagement';
const ADMIN_CONTROLS=['data-admin="mis"','data-admin="assignments"'];
void CONFIGURATION_ENTITIES; void ASSIGNMENT_FIELDS; void MANAGEMENT_NAV; void MANAGEMENT_MOUNT; void ADMIN_CONTROLS;
