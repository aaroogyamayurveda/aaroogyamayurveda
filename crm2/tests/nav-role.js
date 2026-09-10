const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const nav=fs.readFileSync(path.join(root,'modules','nav-role-ui.js'),'utf8');
function ok(name,cond){if(!cond)throw new Error('FAIL: '+name);console.log('PASS: '+name)}
ok('role navigation module is loaded',index.includes('src="./modules/nav-role-ui.js'));
ok('role navigation exposes management labels',nav.includes('Admin / Config')&&nav.includes('Lead Assignment')&&nav.includes('MIS Drilldown'));
ok('role navigation is limited to management roles',nav.includes('super_admin')&&nav.includes('team_leader')&&!nav.includes("role==='agent'"));
console.log('CRM2 role navigation regression test passed');
