const fs=require('fs'),path=require('path');
const dir=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const index=read('index.html');
const parity=read('modules/create-order-crm1-parity.js');
const css=read('create-order-crm1-parity.css');
function ok(name,cond){if(!cond)throw new Error('FAIL: '+name);console.log('PASS: '+name)}
ok('CRM1 parity stylesheet is loaded',/create-order-crm1-parity\.css\?v=/.test(index));
ok('CRM1 parity module is loaded',/modules\/create-order-crm1-parity\.js\?v=/.test(index));
ok('manual phone console is present in parity layer',parity.includes('Manual Phone Call Console')&&parity.includes('Customer Mobile')&&parity.includes('Agent Status')&&parity.includes('Call Timer'));
ok('manual call controls match CRM1 labels',parity.includes('Start Manual Call')&&parity.includes('End Call')&&parity.includes('Log Manual Call'));
ok('telephony controls match CRM1 labels',parity.includes('Telephony')&&parity.includes('Call via SIP')&&parity.includes('Phone')&&parity.includes('Log Call'));
ok('create order form is reorganized into CRM1 sections',parity.includes('Customer Details')&&parity.includes('Delivery Address')&&parity.includes('Order Details'));
ok('customer and order grids retain CRM2 functional field ids',parity.includes('crm2OrderMobile')&&parity.includes('crm2OrderPincode')&&parity.includes('crm2OrderProduct')&&parity.includes('crm2CreateOrder'));
ok('parity keeps CRM2 call workflow ids intact',parity.includes('crm2CallStart')&&parity.includes('crm2CallEnd')&&parity.includes('crm2CallTimer'));
ok('desktop and mobile parity layouts are defined',css.includes('grid-template-columns:1fr 1fr')&&css.includes('@media(max-width:650px)'));
console.log('CRM2 Create Order CRM1 parity smoke suite passed');
