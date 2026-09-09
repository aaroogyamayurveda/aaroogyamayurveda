/* Zero-dependency static smoke tests. Run with: node crm2/tests/smoke.js */
const fs=require('fs');const path=require('path');const dir=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const index=read('index.html');const app=read('app.js');const data=read('data.js');const config=read('config.js');
function ok(name,cond){if(!cond)throw new Error('FAIL: '+name);console.log('PASS: '+name)}
ok('index loads current app module',index.includes('src="./app.js"'));
ok('index does not load duplicate Supabase client',!index.includes('supabase-js'));
ok('index has no legacy crm2 JS',!index.includes('path-fix.js')&&!index.includes('routing-fix.js')&&!index.includes('lead-upload-fix.js'));
ok('app has manual calling',app.includes('manual_mobile')&&app.includes('tel:'));
ok('app uses working lead status',app.includes("status='working'")||app.includes("status,disposition_id")||app.includes("'working'"));
ok('call logging stores disposition',data.includes('disposition_id'));
ok('app has CRM2 Supabase tables',app.includes("from('leads')")&&app.includes("from('orders')")&&app.includes("from('customers')"));
ok('import workflow exists',app.includes('Validate & Stage')&&app.includes('Import Valid Leads')&&app.includes('import_rows'));
ok('customer 360 exists',app.includes('customer360'));
ok('no service role secret',!config.includes('service_role')&&!app.includes('service_role')&&!data.includes('service_role'));
ok('no CRM1 navigation dependency',!app.includes("../crm/")&&!app.includes("../crm1/"));
ok('Google Drive is excluded',!app.includes('Google Drive')&&!data.includes('Google Drive'));
for(const f of fs.readdirSync(dir))if(/^.+-(v\d+|final|fix)\.js$/i.test(f))throw new Error('Legacy/versioned CRM2 JS remains: '+f);
console.log('CRM2 static smoke suite passed');
