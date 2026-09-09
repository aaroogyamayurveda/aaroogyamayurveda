/* Zero-dependency static smoke tests. Run with: node crm2/tests/smoke.js */
const fs=require('fs');const path=require('path');const dir=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(dir,'index.html'),'utf8');const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');const config=fs.readFileSync(path.join(dir,'config.js'),'utf8');
function ok(name,cond){if(!cond)throw new Error('FAIL: '+name);console.log('PASS: '+name)}
ok('index loads current app module',index.includes('src="./app.js"'));
ok('index has no legacy crm2 JS',!index.includes('path-fix.js')&&!index.includes('routing-fix.js')&&!index.includes('lead-upload-fix.js'));
ok('app has manual calling',app.includes('manual_mobile')&&app.includes('tel:'));
ok('app has CRM2 Supabase tables',app.includes("from('leads')")&&app.includes("from('orders')")&&app.includes("from('customers')"));
ok('no service role secret',!config.includes('service_role')&&!app.includes('service_role'));
ok('no CRM1 navigation dependency',!app.includes("../crm/")&&!app.includes("../crm1/"));
for(const f of fs.readdirSync(dir))if(/^.+-(v\d+|final|fix)\.js$/i.test(f))throw new Error('Legacy/versioned CRM2 JS remains: '+f);
console.log('CRM2 static smoke suite passed');
