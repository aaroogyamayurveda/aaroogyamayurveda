import {sb,normalizeMobile} from '../data.js';
import {recordInventoryMovement} from './finance.js';

export async function createOrderFromLead({lead,productId,quantity,unitPrice,paymentMode,priority,remarks}){
  if(!lead?.id) throw new Error('Lead is required.');
  const qty=Math.max(1,Number(quantity)||1),price=Math.max(0,Number(unitPrice)||0),total=qty*price;
  let customerId=lead.customer_id;
  if(!customerId){
    const {data:existing}=await sb.from('customers').select('id').eq('mobile',normalizeMobile(lead.mobile)).limit(1).maybeSingle();
    if(existing)customerId=existing.id;
    else{const {data:c,error}=await sb.from('customers').insert({name:lead.customer_name,mobile:normalizeMobile(lead.mobile),alternate_mobile:lead.alternate_mobile||null,address:lead.address||null,city:lead.city||null,state:lead.state||null,pincode:lead.pincode||null}).select('id').single();if(error)throw error;customerId=c.id;}
    const {error}=await sb.from('leads').update({customer_id:customerId}).eq('id',lead.id);if(error)throw error;
  }
  const {data:order,error}=await sb.from('orders').insert({customer_id:customerId,lead_id:lead.id,product_id:productId||null,agent_id:(await sb.auth.getUser()).data.user?.id||null,total,discount:0,payment_mode:paymentMode||'COD',priority:priority||'normal',remarks:remarks||null,status:'confirmed'}).select().single();if(error)throw error;
  const {error:itemError}=await sb.from('order_items').insert({order_id:order.id,product_id:productId||null,product_name:lead.product_name||'Product',quantity:qty,unit_price:price,line_total:total});if(itemError)throw itemError;
  await sb.from('order_status_history').insert({order_id:order.id,status:'confirmed',remarks:'Order confirmed from CRM2'});
  await sb.from('leads').update({status:'ordered'}).eq('id',lead.id);
  return order;
}

export async function changeShipmentStatus(shipmentId,status,remarks=''){
  const {data:shipment,error}=await sb.from('shipments').select('id,order_id').eq('id',shipmentId).single();if(error)throw error;
  const allowed=['in_transit','out_for_delivery','delivered','ndr','rto','dispatched'];if(!allowed.includes(status))throw new Error('Unsupported shipment status.');
  const patch={status};if(status==='dispatched')patch.shipped_at=new Date().toISOString();if(status==='delivered')patch.delivered_at=new Date().toISOString();
  const {error:updateError}=await sb.from('shipments').update(patch).eq('id',shipmentId);if(updateError)throw updateError;
  const {error:eventError}=await sb.from('shipment_events').insert({shipment_id:shipmentId,event_status:status,event_time:new Date().toISOString(),remarks:remarks||null});if(eventError)throw eventError;
  const orderStatus={dispatched:'dispatched',in_transit:'in_transit',out_for_delivery:'out_for_delivery',delivered:'delivered',ndr:'ndr',rto:'rto'}[status];
  const {error:orderError}=await sb.from('orders').update({status:orderStatus}).eq('id',shipment.order_id);if(orderError)throw orderError;
  return true;
}

export async function createNdrCase({shipmentId,reason,remarks,nextActionAt}){
  const {data:existing}=await sb.from('ndr_cases').select('id').eq('shipment_id',shipmentId).eq('status','open').limit(1).maybeSingle();if(existing)return existing;
  const {data,error}=await sb.from('ndr_cases').insert({shipment_id:shipmentId,reason:reason||null,attempt_no:1,next_action_at:nextActionAt||null,status:'open'}).select().single();if(error)throw error;return data;
}

export async function createRtoCase({shipmentId,reason,remarks}){
  const {data:existing}=await sb.from('rto_cases').select('id').eq('shipment_id',shipmentId).eq('status','open').limit(1).maybeSingle();if(existing)return existing;
  const {data,error}=await sb.from('rto_cases').insert({shipment_id:shipmentId,reason:reason||null,status:'open',inspection_status:remarks||null,restocked:false}).select().single();if(error)throw error;return data;
}

export async function recordPayment({orderId,amount,mode,status='collected',reference,type='collection'}){
  const {data,error}=await sb.from('payments').insert({order_id:orderId,amount:Math.max(0,Number(amount)||0),type:type||mode||'COD',status,reference:reference||null}).select().single();if(error)throw error;return data;
}

export async function reattemptNdrCase({caseId,nextActionAt,remarks=''}){
  const {data:nd,error:readError}=await sb.from('ndr_cases').select('id,shipment_id,attempt_no,status').eq('id',caseId).single();if(readError)throw readError;
  if(nd.status!=='open')throw new Error('Only open NDR cases can be reattempted.');
  await changeShipmentStatus(nd.shipment_id,'out_for_delivery',remarks||'NDR reattempt scheduled');
  const {data,error}=await sb.from('ndr_cases').update({attempt_no:(Number(nd.attempt_no)||0)+1,next_action_at:nextActionAt||null}).eq('id',caseId).select().single();if(error)throw error;return data;
}

export async function closeNdrCase({caseId}){
  const {data,error}=await sb.from('ndr_cases').update({status:'closed',next_action_at:null}).eq('id',caseId).eq('status','open').select().maybeSingle();if(error)throw error;if(!data)throw new Error('NDR case is already closed or unavailable.');return data;
}

export async function inspectRtoCase({caseId,inspectionStatus}){
  const {data,error}=await sb.from('rto_cases').update({inspection_status:inspectionStatus||'inspected',received_at:new Date().toISOString(),status:'inspected'}).eq('id',caseId).in('status',['open','inspected']).select().maybeSingle();if(error)throw error;if(!data)throw new Error('RTO case is unavailable for inspection.');return data;
}

export async function restockRtoCase({caseId,sku,warehouseId,quantity,remarks=''}){
  const qty=Math.max(1,Number(quantity)||0);if(!sku||!warehouseId||!qty)throw new Error('SKU, warehouse and a positive quantity are required to restock.');
  const {data:rto,error:readError}=await sb.from('rto_cases').select('id,status').eq('id',caseId).single();if(readError)throw readError;
  if(rto.status==='restocked')throw new Error('This RTO case has already been restocked.');
  await recordInventoryMovement({sku,warehouseId,movementType:'inward',quantity:qty,reason:remarks||'RTO restock',referenceType:'rto_case',referenceId:caseId});
  const {data,error}=await sb.from('rto_cases').update({restocked:true,status:'restocked',received_at:new Date().toISOString()}).eq('id',caseId).select().single();if(error)throw error;return data;
}
