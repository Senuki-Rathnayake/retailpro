// ============================================================
// RetailPro – in-memory data store
// Every list below starts EMPTY. After a staff member signs in, the
// records are read from the Supabase database (src/lib/db/sync.js) and
// put into these lists; every change made in the app is written back
// to the database automatically.
// ============================================================
import { format, subDays, addDays } from 'date-fns';
import { defaultRoles } from '../lib/db/schemaMap';

// ---------- data lists (filled from Supabase) ----------
export const USERS = [];                // "user" + role + technician tables
export const ROLES = defaultRoles();    // role table (labels shown before sign-in)
export const APP_SETTINGS = {};         // system_setting table
export const CUSTOMERS = [];            // customer + credit_account
export const SUPPLIERS = [];            // supplier
export const CATEGORIES = [];           // category
export const PRODUCTS = [];             // product
export const STOCK_MOVEMENTS = [];      // stock_movement
export const SALES_ORDERS = [];         // sales_order + sales_order_item + invoice
export const PURCHASE_ORDERS = [];      // purchase_order + purchase_order_item + payable
export const SERVICE_JOBS = [];         // service_job + service_visit_log
export const RETURNS = [];              // exchange_request + refund + returned_item
export const COMPLAINTS = [];           // complaint
export const PAYMENTS = [];             // payment (customer payments and refunds) + transaction
export const SUPPLIER_PAYMENTS = [];    // payment (supplier payments) + transaction
export const AUDIT_LOG = [];            // audit_log
export const REPORT_SCHEDULES = [];     // report
export const QUOTATIONS = [];           // quotation
export const RECONCILIATIONS = [];      // report (type reconciliation)
export const DISCOUNTS = [];            // discount
export const BATCHES = [];              // batch
export const SPARE_PART_REQUESTS = [];  // spare_part_request
export const REORDER_REQUESTS = [];     // stock_alert (type reorder)
export const CREDIT_REQUESTS = [];      // credit_account (requests)
export const PERMISSIONS_LIST = [];     // permission table: { id, name, module, action }
export const ROLE_PERMISSIONS = {};     // role_permission table: role -> [{ name, grantedDate, accessType }]
export const SETTINGS_META = {};        // system_setting.updated_at / user_id: key -> { updatedAt, updatedBy }

// The lists in the shape used by src/lib/db/schemaMap.js
export const currentState = () => ({
  users: USERS, roles: ROLES, settings: APP_SETTINGS, categories: CATEGORIES, suppliers: SUPPLIERS, products: PRODUCTS,
  customers: CUSTOMERS, creditRequests: CREDIT_REQUESTS, discounts: DISCOUNTS, batches: BATCHES, quotations: QUOTATIONS,
  salesOrders: SALES_ORDERS, purchaseOrders: PURCHASE_ORDERS, serviceJobs: SERVICE_JOBS, spareRequests: SPARE_PART_REQUESTS,
  stockMovements: STOCK_MOVEMENTS, returns: RETURNS, complaints: COMPLAINTS, payments: PAYMENTS, supplierPayments: SUPPLIER_PAYMENTS,
  reorders: REORDER_REQUESTS, reportSchedules: REPORT_SCHEDULES, reconciliations: RECONCILIATIONS, audit: AUDIT_LOG,
  permissions: PERMISSIONS_LIST, rolePermissions: ROLE_PERMISSIONS, settingsMeta: SETTINGS_META,
});

// Put records read from the database into the lists (same list objects, so every page sees them)
const fill = (list, items) => list.splice(0, list.length, ...(items || []));
const fillObj = (obj, items) => { Object.keys(obj).forEach(k => delete obj[k]); Object.assign(obj, items || {}); };
export function applyState(s) {
  const cur = currentState();
  for (const [k, list] of Object.entries(cur)) {
    if (Array.isArray(list)) fill(list, s[k]);
    else fillObj(list, s[k]);
  }
}
export const clearStore = () => applyState({ roles: defaultRoles() });

// ---------- role permissions (permission + role_permission tables) ----------
const granted = (role) => (ROLE_PERMISSIONS[role] || []).filter(g => g.accessType !== 'deny');
// pages a role may open ('page:stock' -> 'stock')
export const pagesOf = (role) => granted(role).filter(g => g.name.startsWith('page:')).map(g => g.name.slice(5));
// buttons a role may use ('stock.adjust')
export const actionsOf = (role) => granted(role).filter(g => !g.name.startsWith('page:')).map(g => g.name);
// Admin ticks the pages of a role: pages kept keep their granted date, new pages get today's date
export function setRolePages(role, pages) {
  const now = format(new Date(), 'yyyy-MM-dd');
  const old = ROLE_PERMISSIONS[role] || [];
  const keep = old.filter(g => !g.name.startsWith('page:') || pages.includes(g.name.slice(5)));
  const added = pages.filter(p => !old.some(g => g.name === `page:${p}`)).map(p => ({ name: `page:${p}`, grantedDate: now, accessType: 'allow' }));
  ROLE_PERMISSIONS[role] = [...keep, ...added];
  return ROLE_PERMISSIONS[role];
}
// latest date a permission of this role was granted
export const permissionsChangedOn = (role) => (ROLE_PERMISSIONS[role] || []).map(g => g.grantedDate).filter(Boolean).sort().pop() || null;

// system_setting.updated_at and user_id: who changed a setting and when
export function markSettingsUpdated(keys, userId) {
  const at = new Date().toISOString();
  keys.forEach(k => { SETTINGS_META[k] = { updatedAt: at, updatedBy: userId || null }; });
}
export const lastSettingsUpdate = () => Object.values(SETTINGS_META).filter(m => m.updatedAt).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] || null;

// ---------- lookups ----------
export const getCustomer  = (id) => CUSTOMERS.find(c => c.id === id);
export const getSupplier  = (id) => SUPPLIERS.find(s => s.id === id);
export const getProduct   = (id) => PRODUCTS.find(p => p.id === id);
export const getUser      = (id) => USERS.find(u => u.id === id);
export const getSalesOrder= (id) => SALES_ORDERS.find(o => o.id === id);
export const getServiceJob= (id) => SERVICE_JOBS.find(j => j.id === id);

export const getLowStockProducts = () => PRODUCTS.filter(p => !p.obsolete && p.stock <= p.minStock);
export const getOverduePOs = () => PURCHASE_ORDERS.filter(po =>
  !['received', 'cancelled'].includes(po.status) && po.expectedDate && po.expectedDate < format(new Date(), 'yyyy-MM-dd'));
export const getOutstandingInvoices = () => SALES_ORDERS.filter(o => o.invoiceNo && o.paymentStatus !== 'paid');

// Sales of the last 7 days for the dashboard chart
export const getDailySalesData = () => {
  const days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));
  return days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayOrders = SALES_ORDERS.filter(o => o.date === dateStr && o.status !== 'on-hold');
    return { label: format(day, 'EEE'), revenue: dayOrders.reduce((s, o) => s + o.grandTotal, 0), orders: dayOrders.length };
  });
};

// Currency (LKR)
export const fmt = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 0 }).format(n || 0);

// ---------- new record numbers: highest number in use + 1 ----------
const nextNo = (list, key = 'id') => Math.max(0, ...list.map(x => Number(String(x[key] || '').match(/(\d+)\s*$/)?.[1] || 0))) + 1;
const code = (prefix, n, pad = 3) => `${prefix}${String(n).padStart(pad, '0')}`;
export const newSaleId      = () => code('SO-', nextNo(SALES_ORDERS));
export const newInvNo       = () => code(`INV-${new Date().getFullYear()}-`, nextNo(SALES_ORDERS.filter(o => o.invoiceNo), 'invoiceNo'));
export const newJobId       = () => code('JOB-', nextNo(SERVICE_JOBS));
export const newPoId        = () => code('PO-', nextNo(PURCHASE_ORDERS));
export const newCustId      = () => code('C', nextNo(CUSTOMERS));
export const newRetId       = () => code('RET-', nextNo(RETURNS));
export const newCmpId       = () => code('CMP-', nextNo(COMPLAINTS));
export const newPayId       = () => code('PAY-', nextNo(PAYMENTS));
export const newSupplierPayId = () => code('SPAY-', nextNo(SUPPLIER_PAYMENTS));
export const newSmId        = () => code('SM', nextNo(STOCK_MOVEMENTS));
export const newQuoteId     = () => code('QT-', nextNo(QUOTATIONS));
export const newSprId       = () => code('SPR-', nextNo(SPARE_PART_REQUESTS));
export const newBatchId     = () => code('B', nextNo(BATCHES));
export const newCreditReqId = () => code('CR-', nextNo(CREDIT_REQUESTS));
export const newReorderId   = () => code('RO-', nextNo(REORDER_REQUESTS));
export const newScheduleId  = () => code('RS', nextNo(REPORT_SCHEDULES));
export const newReconId     = () => `REC-${nextNo(RECONCILIATIONS)}`;
export const newAuditId     = () => code('AL', nextNo(AUDIT_LOG));
export const newSupplierId  = () => code('SUP', nextNo(SUPPLIERS));
export const newProductId   = () => code('P', nextNo(PRODUCTS));
export const newCategoryId  = () => code('CAT', nextNo(CATEGORIES));
export const today = () => format(new Date(), 'yyyy-MM-dd');
export const daysAgo = (n) => format(subDays(new Date(), n), 'yyyy-MM-dd');
export const daysAhead = (n) => format(addDays(new Date(), n), 'yyyy-MM-dd');

// ---------- warranty / finance helpers ----------
// Warranty check (warranty_record): product warranty months from the sale date
export const getWarrantyStatus = (productId, salesOrderId) => {
  const product = getProduct(productId);
  const order = getSalesOrder(salesOrderId);
  if (!product || !order) return { known: false, valid: false, message: 'Select the sales order and product to check the warranty.' };
  const sold = order.items?.some(i => i.productId === productId);
  if (!sold) return { known: true, valid: false, message: `${product.name} is not on invoice ${order.invoiceNo}.` };
  const expiry = addDays(new Date(order.date), Math.round(product.warranty * 30.44));
  const expiryText = format(expiry, 'yyyy-MM-dd');
  const valid = expiry >= new Date();
  return { known: true, valid, product, order, months: product.warranty, saleDate: order.date, expiry: expiryText,
    message: valid ? `Warranty valid until ${expiryText}` : `Warranty expired on ${expiryText}` };
};

// All financial transactions (transaction table): customer payments, supplier payments, refunds, service fees
export const getAllTransactions = () => {
  const rows = [];
  PAYMENTS.forEach(p => rows.push({
    id: p.id, date: p.date, kind: p.note?.startsWith('Refund') ? 'Refund' : 'Customer payment',
    party: getCustomer(p.customerId)?.name || p.customerId || 'Walk-in customer', ref: p.salesOrderId, method: p.method,
    amount: p.note?.startsWith('Refund') ? -p.amount : p.amount,
  }));
  SUPPLIER_PAYMENTS.filter(sp => sp.date).forEach(sp => rows.push({
    id: sp.id, date: sp.date, kind: 'Supplier payment', party: getSupplier(sp.supplierId)?.name || sp.supplierId,
    ref: sp.purchaseOrderId, method: sp.method, amount: -sp.amount,
  }));
  SERVICE_JOBS.filter(j => j.billingStatus === 'paid' && j.serviceFee > 0).forEach(j => rows.push({
    id: `SVC-${j.id}`, date: j.completedAt || j.updatedAt, kind: 'Service fee', party: getCustomer(j.customerId)?.name || j.customerId,
    ref: j.id, method: 'cash', amount: j.serviceFee,
  }));
  return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
};

// ---------- service helpers ----------
// Open jobs held by a technician (used for availability / capacity)
export const openJobsOf = (techId) => SERVICE_JOBS.filter(j => j.assignedTo === techId && !['completed', 'cancelled'].includes(j.status)).length;
// Technicians who can take a job of this type right now
export const availableTechnicians = (jobType, exceptJobId) => USERS.filter(u =>
  u.role === 'technician' && u.active !== false && (!jobType || (u.skills || []).includes(jobType)) &&
  SERVICE_JOBS.filter(j => j.assignedTo === u.id && j.id !== exceptJobId && !['completed', 'cancelled'].includes(j.status)).length < (APP_SETTINGS.technicianMaxJobs || 3));

// Check a promotion code against an order total
export const checkPromotion = (code, orderTotal) => {
  const dsc = DISCOUNTS.find(x => x.code && x.code.toLowerCase() === String(code || '').trim().toLowerCase());
  const t = today();
  if (!dsc || !dsc.active || dsc.start > t || dsc.end < t || orderTotal < (dsc.minOrder || 0)) {
    return { ok: false, message: 'Promotion not valid for this order' };
  }
  const amount = dsc.type === 'percent' ? Math.round(orderTotal * dsc.value / 100) : Math.min(dsc.value, orderTotal);
  return { ok: true, discount: dsc, amount, message: `${dsc.name} applied` };
};

// ---------- form validators ----------
export const isValidPhone = (p) => /^(?:\+94|0)\d{9}$/.test(String(p || '').replace(/[\s-]/g, ''));
export const isValidEmail = (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e).trim());

// ---------- table order ----------
const noOf = (x) => Number(String(x?.id || '').match(/(\d+)\s*$/)?.[1] || 0);
// newest record first (by date, then by record number)
export const newestFirst = (list, dateKey = 'date') => [...list].sort((a, b) =>
  String(b?.[dateKey] || '').localeCompare(String(a?.[dateKey] || '')) || noOf(b) - noOf(a));
// lowest stock first (out of stock at the top)
export const lowStockFirst = (list) => [...list].sort((a, b) => (a.stock - b.stock) || (a.stock - a.minStock) - (b.stock - b.minStock) || a.name.localeCompare(b.name));
