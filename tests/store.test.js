// Unit tests: the in-memory data store and its helper functions (src/data/store.js)
import { describe, test, expect, beforeEach } from 'vitest';
import * as S from '../src/data/store';
import { fromTables } from '../src/lib/db/schemaMap';
import { loadRows, day } from './helpers';

// Small, hand-made data so every expected answer is easy to check
function smallState() {
  return {
    roles: S.ROLES,
    settings: { technicianMaxJobs: 2 },
    users: [
      { id: 'u-admin', name: 'Amara', role: 'admin', active: true },
      { id: 'u-t1', name: 'Ruwan', role: 'technician', skills: ['repair', 'installation'], active: true },
      { id: 'u-t2', name: 'Saman', role: 'technician', skills: ['repair'], active: false },
      { id: 'u-t3', name: 'Ishara', role: 'technician', skills: ['maintenance'], active: true },
    ],
    categories: [{ id: 'CAT001', name: 'Processors' }],
    suppliers: [{ id: 'SUP001', name: 'TechDistrib' }],
    customers: [{ id: 'C001', name: 'Nimal' }, { id: 'C002', name: 'Kamala' }],
    products: [
      { id: 'P001', name: 'CPU', stock: 14, minStock: 5, warranty: 12, category: 'CAT001' },
      { id: 'P002', name: 'RAM', stock: 2, minStock: 5, warranty: 6 },
      { id: 'P003', name: 'Fan', stock: 0, minStock: 3, warranty: 0 },
      { id: 'P004', name: 'Old PSU', stock: 0, minStock: 3, obsolete: true },
      { id: 'P005', name: 'Cable', stock: 2, minStock: 10 },
    ],
    salesOrders: [
      { id: 'SO-001', date: day(-400), invoiceNo: 'INV-2025-001', grandTotal: 1000, paymentStatus: 'paid', items: [{ productId: 'P001', qty: 1 }] },
      { id: 'SO-002', date: day(-10), invoiceNo: 'INV-2026-002', grandTotal: 2000, paymentStatus: 'partial', items: [{ productId: 'P002', qty: 1 }] },
      { id: 'SO-003', date: day(0), invoiceNo: null, grandTotal: 500, status: 'on-hold', items: [] },
      { id: 'SO-004', date: day(0), invoiceNo: 'INV-2026-003', grandTotal: 700, paymentStatus: 'paid', items: [] },
    ],
    purchaseOrders: [
      { id: 'PO-001', status: 'sent', expectedDate: day(-2) },
      { id: 'PO-002', status: 'received', expectedDate: day(-5) },
      { id: 'PO-003', status: 'sent', expectedDate: day(3) },
    ],
    serviceJobs: [
      { id: 'JOB-001', assignedTo: 'u-t1', status: 'in-progress' },
      { id: 'JOB-002', assignedTo: 'u-t1', status: 'assigned' },
      { id: 'JOB-003', assignedTo: 'u-t1', status: 'completed', billingStatus: 'paid', serviceFee: 3000, completedAt: day(-1), customerId: 'C001' },
      { id: 'JOB-004', assignedTo: 'u-t3', status: 'cancelled' },
    ],
    payments: [
      { id: 'PAY-001', date: day(-3), amount: 1000, customerId: 'C001', salesOrderId: 'SO-001', method: 'cash' },
      { id: 'PAY-002', date: day(-1), amount: 400, note: 'Refund RET-001', customerId: 'C002', method: 'transfer' },
    ],
    supplierPayments: [
      { id: 'SPAY-001', date: day(-2), amount: 5000, supplierId: 'SUP001', purchaseOrderId: 'PO-002', method: 'transfer' },
      { id: 'SPAY-002', date: null, amount: 900, supplierId: 'SUP001', purchaseOrderId: 'PO-001' },
    ],
    discounts: [
      { id: 'D001', code: 'NEWYEAR10', type: 'percent', value: 10, active: true, start: day(-5), end: day(5), minOrder: 50000 },
      { id: 'D002', code: 'GPU5000', type: 'fixed', value: 5000, active: true, start: day(-5), end: day(5), minOrder: 0 },
      { id: 'D003', code: 'OLD15', type: 'percent', value: 15, active: true, start: day(-60), end: day(-30), minOrder: 0 },
      { id: 'D004', code: 'OFF', type: 'percent', value: 50, active: false, start: day(-5), end: day(5), minOrder: 0 },
    ],
    returns: [{ id: 'RET-001' }], complaints: [{ id: 'CMP-009' }], stockMovements: [{ id: 'SM12' }], quotations: [{ id: 'QT-003' }],
    spareRequests: [], batches: [{ id: 'B004' }], creditRequests: [{ id: 'CR-002' }], reorders: [], reportSchedules: [{ id: 'RS003' }],
    reconciliations: [{ id: 'REC-2' }], audit: [{ id: 'AL006' }],
  };
}

beforeEach(() => { S.clearStore(); S.applyState(smallState()); });

describe('loading and clearing the store', () => {
  test('applyState fills the same list objects the pages use', () => {
    const list = S.PRODUCTS;
    S.applyState({ ...smallState(), products: [{ id: 'P100', name: 'X', stock: 1, minStock: 0 }] });
    expect(S.PRODUCTS).toBe(list);
    expect(S.PRODUCTS).toHaveLength(1);
  });
  test('currentState returns every list', () => {
    const st = S.currentState();
    expect(st.products).toBe(S.PRODUCTS);
    expect(st.settings).toBe(S.APP_SETTINGS);
    expect(Object.keys(st)).toHaveLength(27);
  });
  test('clearStore empties every list after sign-out', () => {
    S.clearStore();
    for (const [k, v] of Object.entries(S.currentState())) {
      if (k === 'roles') expect(Object.keys(v)).toHaveLength(6);
      else if (Array.isArray(v)) expect(v, k).toHaveLength(0);
      else expect(Object.keys(v), k).toHaveLength(0);
    }
  });
  test('the real company data loads into the store', () => {
    S.applyState(fromTables(loadRows()));
    expect(S.PRODUCTS.length).toBe(12);
    expect(S.SALES_ORDERS.length).toBe(63);
    expect(S.APP_SETTINGS.businessName).toBe('Rajida Holdings (Pvt) Ltd');
  });
});

describe('lookups', () => {
  test('find records by code', () => {
    expect(S.getCustomer('C002').name).toBe('Kamala');
    expect(S.getSupplier('SUP001').name).toBe('TechDistrib');
    expect(S.getProduct('P002').name).toBe('RAM');
    expect(S.getUser('u-t1').name).toBe('Ruwan');
    expect(S.getSalesOrder('SO-002').grandTotal).toBe(2000);
    expect(S.getServiceJob('JOB-003').serviceFee).toBe(3000);
    expect(S.getProduct('P999')).toBeUndefined();
  });
  test('low stock products (obsolete products are left out)', () => {
    expect(S.getLowStockProducts().map(p => p.id).sort()).toEqual(['P002', 'P003', 'P005']);
  });
  test('overdue purchase orders: not received and expected date passed', () => {
    expect(S.getOverduePOs().map(p => p.id)).toEqual(['PO-001']);
  });
  test('outstanding invoices: invoiced and not paid', () => {
    expect(S.getOutstandingInvoices().map(o => o.id)).toEqual(['SO-002']);
  });
});

describe('new record numbers (highest number + 1)', () => {
  test.each([
    ['newSaleId', 'SO-005'], ['newJobId', 'JOB-005'], ['newPoId', 'PO-004'], ['newCustId', 'C003'], ['newRetId', 'RET-002'],
    ['newCmpId', 'CMP-010'], ['newPayId', 'PAY-003'], ['newSupplierPayId', 'SPAY-003'], ['newSmId', 'SM013'], ['newQuoteId', 'QT-004'],
    ['newSprId', 'SPR-001'], ['newBatchId', 'B005'], ['newCreditReqId', 'CR-003'], ['newReorderId', 'RO-001'], ['newScheduleId', 'RS004'],
    ['newReconId', 'REC-3'], ['newAuditId', 'AL007'], ['newSupplierId', 'SUP002'], ['newProductId', 'P006'], ['newCategoryId', 'CAT002'],
  ])('%s gives %s', (fn, expected) => {
    expect(S[fn]()).toBe(expected);
  });
  test('newInvNo continues the invoice numbers of this year', () => {
    expect(S.newInvNo()).toBe(`INV-${new Date().getFullYear()}-004`);
  });
  test('numbers do not repeat after a record is added', () => {
    const id = S.newSaleId();
    S.SALES_ORDERS.push({ id, date: day(0), items: [] });
    expect(S.newSaleId()).not.toBe(id);
  });
  test('an empty list starts at 1', () => {
    S.COMPLAINTS.length = 0;
    expect(S.newCmpId()).toBe('CMP-001');
  });
});

describe('dates and money', () => {
  test('today / daysAgo / daysAhead', () => {
    expect(S.today()).toMatch(/^\d{4}-\d\d-\d\d$/);
    expect(S.daysAgo(1) < S.today()).toBe(true);
    expect(S.daysAhead(1) > S.today()).toBe(true);
  });
  test('fmt shows Sri Lankan rupees without cents', () => {
    expect(S.fmt(185000)).toMatch(/185,000/);
    expect(S.fmt(185000)).toMatch(/LKR|Rs/);
    expect(S.fmt(null)).toMatch(/0/);
  });
  test('getDailySalesData gives 7 days and leaves out on-hold orders', () => {
    const d = S.getDailySalesData();
    expect(d).toHaveLength(7);
    expect(d[6].revenue).toBe(700);   // SO-004 today, SO-003 is on hold
    expect(d[6].orders).toBe(1);
  });
});

describe('warranty check', () => {
  test('valid warranty', () => {
    const w = S.getWarrantyStatus('P002', 'SO-002');
    expect(w.known).toBe(true);
    expect(w.valid).toBe(true);
    expect(w.message).toMatch(/valid until/);
  });
  test('expired warranty', () => {
    const w = S.getWarrantyStatus('P001', 'SO-001');
    expect(w.valid).toBe(false);
    expect(w.message).toMatch(/expired/);
  });
  test('product not on that invoice', () => {
    const w = S.getWarrantyStatus('P001', 'SO-002');
    expect(w.known).toBe(true);
    expect(w.valid).toBe(false);
    expect(w.message).toMatch(/not on invoice/);
  });
  test('unknown order or product', () => {
    expect(S.getWarrantyStatus('P001', 'SO-999').known).toBe(false);
    expect(S.getWarrantyStatus(null, null).known).toBe(false);
  });
});

describe('promotion codes', () => {
  test('percent discount', () => {
    const r = S.checkPromotion('NEWYEAR10', 100000);
    expect(r.ok).toBe(true);
    expect(r.amount).toBe(10000);
  });
  test('code is not case sensitive and spaces are ignored', () => {
    expect(S.checkPromotion('  newyear10 ', 100000).ok).toBe(true);
  });
  test('fixed discount is never more than the order', () => {
    expect(S.checkPromotion('GPU5000', 20000).amount).toBe(5000);
    expect(S.checkPromotion('GPU5000', 3000).amount).toBe(3000);
  });
  test.each([
    ['below the minimum order', 'NEWYEAR10', 40000],
    ['ended promotion', 'OLD15', 10000],
    ['inactive promotion', 'OFF', 10000],
    ['unknown code', 'XYZ', 10000],
    ['empty code', '', 10000],
  ])('rejected: %s', (_, code, total) => {
    const r = S.checkPromotion(code, total);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not valid/);
  });
});

describe('form validation', () => {
  test.each(['0771234567', '+94771234567', '077 123 4567', '077-123-4567'])('valid phone %s', (p) => expect(S.isValidPhone(p)).toBe(true));
  test.each(['12345', '07712345678', 'abc', '', null])('invalid phone %s', (p) => expect(S.isValidPhone(p)).toBe(false));
  test.each(['a@b.lk', ' nimal@gmail.com ', '', null])('valid e-mail %s', (e) => expect(S.isValidEmail(e)).toBe(true));
  test.each(['a@b', 'nimal.gmail.com', 'a b@c.lk', 'x@y.c'])('invalid e-mail %s', (e) => expect(S.isValidEmail(e)).toBe(false));
});

describe('service helpers', () => {
  test('openJobsOf counts only jobs that are not completed or cancelled', () => {
    expect(S.openJobsOf('u-t1')).toBe(2);
    expect(S.openJobsOf('u-t3')).toBe(0);
  });
  test('availableTechnicians: right skill, active and below the job limit', () => {
    // Ruwan has 2 open jobs = the limit (2), Saman is locked, Ishara has no repair skill
    expect(S.availableTechnicians('repair').map(u => u.id)).toEqual([]);
    expect(S.availableTechnicians('maintenance').map(u => u.id)).toEqual(['u-t3']);
  });
  test('the job being reassigned does not count against its own technician', () => {
    expect(S.availableTechnicians('repair', 'JOB-001').map(u => u.id)).toEqual(['u-t1']);
  });
  test('without a job type every free technician is listed', () => {
    expect(S.availableTechnicians().map(u => u.id)).toEqual(['u-t3']);
  });
});

describe('transactions', () => {
  test('getAllTransactions joins customer payments, refunds, supplier payments and service fees', () => {
    const t = S.getAllTransactions();
    expect(t).toHaveLength(4);                     // SPAY-002 has no date yet
    const byId = Object.fromEntries(t.map(x => [x.id, x]));
    expect(byId['PAY-001'].amount).toBe(1000);
    expect(byId['PAY-002'].kind).toBe('Refund');
    expect(byId['PAY-002'].amount).toBe(-400);
    expect(byId['SPAY-001'].amount).toBe(-5000);
    expect(byId['SVC-JOB-003'].amount).toBe(3000);
  });
  test('newest transaction first', () => {
    const dates = S.getAllTransactions().map(x => x.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});

describe('table order', () => {
  test('newestFirst: latest date first, then highest number', () => {
    const list = [{ id: 'SO-001', date: '2026-10-01' }, { id: 'SO-003', date: '2026-10-05' }, { id: 'SO-002', date: '2026-10-05' }, { id: 'SO-004' }];
    expect(S.newestFirst(list).map(x => x.id)).toEqual(['SO-003', 'SO-002', 'SO-001', 'SO-004']);
  });
  test('newestFirst can sort by another date field and does not change the original list', () => {
    const list = [{ id: 'A1', createdAt: '2026-01-01' }, { id: 'A2', createdAt: '2026-02-01' }];
    expect(S.newestFirst(list, 'createdAt')[0].id).toBe('A2');
    expect(list[0].id).toBe('A1');
  });
  test('lowStockFirst: out of stock at the top, then furthest below the minimum', () => {
    expect(S.lowStockFirst(S.PRODUCTS).map(p => p.id)).toEqual(['P003', 'P004', 'P005', 'P002', 'P001']);
  });
});
