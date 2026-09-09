/* Zero-dependency static smoke tests. Run with: node crm2/tests/smoke.js */
const fs=require('fs'),path=require('path');
const dir=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const index=read('index.html'),app=read('app.js'),data=read('data.js'),workflow=read('modules/workflows.js'),finance=read('modules/finance.js'),config=read('config.js');
function ok(name,cond){if(!cond)throw new Error('FAIL: '+name);console.log('PASS: '+name)}
ok('index loads current app module',index.includes('src="./app.js"'));
ok('index does not load duplicate Supabase client',!index.includes('supabase-js'));
ok('no legacy/fix JS',!index.includes('path-fix.js')&&!index.includes('routing-fix.js')&&!index.includes('lead-upload-fix.js'));
ok('manual mobile calling is first-class',app.includes('tel:')&&data.includes('manual_mobile'));
ok('working lead status is used',data.includes("'working'"));
ok('call logging stores disposition',data.includes('disposition_id'));
ok('CRM2 tables are wired',app.includes("from('leads')")&&app.includes("from('orders')")&&app.includes("from('customers')"));
ok('import workflow exists',app.includes('Validate & Stage')&&app.includes('Import Valid Leads')&&app.includes('import_rows'));
ok('customer 360 exists',app.includes('customer360'));
ok('operational workflow module exists',workflow.includes('createOrderFromLead')&&workflow.includes('changeShipmentStatus')&&workflow.includes('createNdrCase')&&workflow.includes('createRtoCase'));
ok('shipment event schema is mapped correctly',workflow.includes('event_status:status')&&workflow.includes('event_time:new Date().toISOString()'));
ok('NDR/RTO schema fields are mapped correctly',workflow.includes('attempt_no:1')&&workflow.includes('inspection_status:remarks')&&workflow.includes('restocked:false'));
ok('order item is created with fast order',workflow.includes("from('order_items')")&&workflow.includes('line_total:total'));
ok('finance RPC adapters exist',finance.includes('crm2_record_cod_remittance')&&finance.includes('crm2_record_settlement')&&finance.includes('crm2_record_refund')&&finance.includes('crm2_record_inventory_movement'));
ok('delivery UI exposes NDR/RTO actions',app.includes('data-ndr')&&app.includes('data-rto')&&app.includes('createNdrCase')&&app.includes('createRtoCase'));
ok('accounts UI exposes finance workflows',app.includes('recordCodRemittance')&&app.includes('recordSettlement')&&app.includes('recordRefund'));
ok('inventory UI exposes stock movement workflow',app.includes('recordInventoryMovement')&&app.includes('inventory_movements'));
ok('payments UI uses schema-correct type',app.includes("select('order_id,amount,type,status,reference,created_at')")&&app.includes('x.type'));
ok('no service role secret',!config.includes('service_role')&&!app.includes('service_role')&&!data.includes('service_role')&&!workflow.includes('service_role')&&!finance.includes('service_role'));
ok('no CRM1 navigation dependency',!app.includes('../crm/')&&!app.includes('../crm1/'));
ok('no Google Drive dependency',!app.includes('Google Drive')&&!data.includes('Google Drive')&&!workflow.includes('Google Drive')&&!finance.includes('Google Drive'));
for(const f of fs.readdirSync(dir,{recursive:true}))if(typeof f==='string'&&/^.+-(v\d+|final|fix)\.js$/i.test(f))throw new Error('Legacy/versioned CRM2 JS remains: '+f);
console.log('CRM2 static smoke suite passed');
