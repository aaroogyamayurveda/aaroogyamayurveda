import {sb} from '../data.js';

const MOVEMENTS=new Set(['inward','outward','reserve','release','damage','return','adjustment','transfer_in','transfer_out']);

export async function recordInventoryMovement({sku,warehouseId,movementType,quantity,referenceType=null,referenceId=null,reason=''}){
  if(!sku||!warehouseId||!MOVEMENTS.has(movementType)||Number(quantity)<=0) throw new Error('Valid SKU, warehouse, movement type and positive quantity are required.');
  const {data,error}=await sb.from('inventory_movements').insert({sku,warehouse_id:warehouseId,movement_type:movementType,quantity:Number(quantity),reference_type:referenceType,reference_id:referenceId,reason}).select().single();
  if(error) throw error;
  return data;
}

export async function inventoryBySku(sku){
  return sb.from('inventory').select('id,sku,warehouse_id,on_hand,reserved,damaged,updated_at').eq('sku',sku).order('updated_at',{ascending:false});
}

export async function inventoryMovements({sku='',warehouseId=null,limit=100}={}){
  let q=sb.from('inventory_movements').select('id,sku,warehouse_id,movement_type,quantity,reference_type,reference_id,reason,created_by,created_at').order('created_at',{ascending:false}).limit(Math.min(Number(limit)||100,500));
  if(sku) q=q.eq('sku',sku);
  if(warehouseId) q=q.eq('warehouse_id',warehouseId);
  return q;
}
