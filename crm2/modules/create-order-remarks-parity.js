const WS='[data-crm2-create-order]';
const $=id=>document.getElementById(id);
function ensureRemarks(){
  const ws=document.querySelector(WS);
  if(!ws||ws.querySelector('[data-crm1-remarks-panel]'))return;
  const textarea=$('crm2OrderRemarks');
  if(textarea){
    const field=textarea.closest('.field');
    if(field) field.remove();
  }
  const order=[...ws.querySelectorAll('.crm1-parity-section h3')].find(h=>h.textContent.trim()==='Order Details')?.closest('section');
  const panel=document.createElement('section');
  panel.className='panel crm1-remarks-panel';
  panel.dataset.crm1RemarksPanel='1';
  panel.innerHTML='<h3>Remarks</h3><div class="crm1-remarks-host"></div>';
  const host=panel.querySelector('.crm1-remarks-host');
  const field=document.createElement('div');
  field.className='field full';
  field.innerHTML='<label for="crm2OrderRemarks">Remarks</label><textarea id="crm2OrderRemarks" maxlength="500" placeholder="Delivery or customer instructions"></textarea>';
  host.appendChild(field);
  if(order)order.insertAdjacentElement('afterend',panel);else ws.appendChild(panel);
}
function run(){ensureRemarks()}
if(document.body){new MutationObserver(run).observe(document.body,{subtree:true,childList:true});setInterval(run,250);run()}
