// Reliability guard for the Create Order entry point.
// Keep this separate from the workspace renderer so a navigation/render race
// cannot leave the Orders action without a live handler.
const isCreateOrderButton = (el) => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.closest('[data-crm2-create-order]')) return false;
  const text = (el.textContent || '').trim();
  return /^\+?\s*Create Order$/i.test(text) && el.tagName === 'BUTTON';
};

function openCreateOrderFromAction(event) {
  const button = event.target?.closest?.('button');
  if (!isCreateOrderButton(button)) return;
  const open = window.crm2OpenCreateOrder;
  if (typeof open !== 'function') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  Promise.resolve(open(button.dataset.leadId ? { lead: { id: button.dataset.leadId } } : {})).catch((error) => {
    console.error('CRM2 Create Order action failed:', error);
  });
}

document.addEventListener('click', openCreateOrderFromAction, true);

// The normal UI module creates the action through a MutationObserver. This guard
// retries after each render until the button has a reliable delegated click path.
window.crm2CreateOrderActionFix = true;
