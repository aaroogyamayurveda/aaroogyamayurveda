// CRM1 Generate Invoice focused regression contract.
// This file is intentionally scoped to the new Generate Invoice page only.
(function () {
  'use strict';
  window.CRM1GenerateInvoiceTests = {
    required: [
      'Generate Invoice navigation is visible to all authenticated users',
      'Order Number search loads the selected order invoice details',
      'Mobile Number search loads matching order invoice details',
      'Print/PDF action prints only the invoice',
      'Excel export produces structured invoice/order data'
    ]
  };
})();
