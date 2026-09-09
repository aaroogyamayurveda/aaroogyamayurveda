import {sb,normalizeMobile} from '../data.js';

export async function createOrderFromLead({lead,productId,quantity,unitPrice,paymentMode,priority,remarks}){
  if(!lead?.id) throw new Error('Lead is required.');
  const qty=Math.max(1,Number(quantity)||1), price=Math.max(0,Number(unitPrice)||0);
  const total=qty*price;
  let customerId=lead.customer_id;
  if(!customerId){
    const {data:c,error:ce}=await sb.from('customers').insert({name:lead.customer_name,mobile:normalizeMobile(lead.mobile),alternate_mobile:lead.alternate_mobile||null,address:lead.address||null,city:lead.city||null,state:lead.state||null,pincode:lead.pincode||null}).select('id').single();
    if(ce) throw ce; customerId=c.id;
    const {error:le}=await sb.from('leads').update({customer_id:customerId}).eq('id',lead.id); if(le) throw le;
  }
  const {data:order,error}=await sb.from('orders').insert({customer_id:customerId,lead_id:lead.id,product_id:productId||null,agent_id:(await sb.auth.getUser()).data.user?.id||null,total,payment_mode:paymentMode||'COD',priority:priority||'normal',remarks:remarks||null,status:'new'}).select().single();
  if(error) throw error;
  await sb.from('orders').update({status:'confirmed'}).eq('id',order.id);
  await sb.from('order_status_history').insert({order_id:order.id,status:'confirmed',remarks:'Order confirmed from CRM2 fast order'});
  await sb.from('leads').update({status:'ordered'}).eq('id',lead.id);
  return order;
}

export async function changeShipmentStatus(shipmentId,status,remarks=''){
  const {data:shipment,error}=await sb.from('shipments').select('id,order_id').eq('id',shipmentId).single(); if(error) throw error;
  const {error:se}=await sb.from('shipments').update({status}).eq('id',shipmentId); if(se) throw se;
  await sb.from('shipment_events').insert({shipment_id:shipmentId,status,remarks,event_at:new Date().toISOString()});
  const orderStatus={delivered:'delivered',ndr:'ndr',rto:'rto',in_transit:'in_transit',out_for_delivery:'out_for_delivery',dispatched:'dispatched'}[status];
  if(orderStatus) await sb.from('orders').update({status:orderStatus}).eq('id',shipment.order_id);
  return true;
}

export async function createNdrCase({shipmentId,reason,remarks,nextActionAt}){
  const {data,error}=await sb.from('ndr_cases').insert({shipment_id:shipmentId,reason,remarks,next_action_at:nextActionAt||null,status:'open'}).select().single(); if(error) throw error; return data;
}

export async function createRtoCase({shipmentId,reason,remarks}){
  const {data,error}=await sb.from('rto_cases').insert({shipment_id:shipmentId,reason,remarks,status:'open'}).select().single(); if(error) throw error; return data;
}

export async function recordPayment({orderId,amount,mode,status='collected',reference}){
  const {data,error}=await sb.from('payments').insert({order_id:orderId,amount:Number(amount)||0,mode,status,reference:reference||null}).select().single(); if(error) throw error; return data;
}
