import {sb,esc,money,normalizeMobile,getProducts,getSources,currentProfile} from '../data.js';

const $=id=>document.getElementById(id);
const root=()=>document.querySelector('#main');
const WORKSPACE='[data-crm2-create-order]';
let busy=false;

const errorText=e=>{
  const m=e?.message||String(e||'Order create failed.');
  const map={
    AUTH_REQUIRED:'Session expired. Please login again.',
    INVALID_MOBILE:'Please enter a valid mobile number.',
    CUSTOMER_NAME_REQUIRED:'Please enter the customer name.',
    INVALID_ALTERNATE_MOBILE:'Please enter a valid alternate mobile number.',
    DELIVERY_ADDRESS_REQUIRED:'Please enter the complete delivery address.',
    LEAD_NOT_FOUND:'The selected lead was not found.',
    LEAD_ACCESS_DENIED:'You do not have permission to create an order for this lead.'
  };
  return map[m]||m;
};
