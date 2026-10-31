// ============================================================
// How the app's records are stored in the Supabase tables
// (File Design, 33 tables + audit_log).
//
//   toTables(state)   app records  -> rows for every table
//   fromTables(rows)  table rows   -> app records
//
// App codes such as P001, SO-004 or JOB-012 are the table's
// primary key with a prefix:  product_id 1 = P001,
// sales_order.sales_order_id 4 = SO-004, service_job.service_job_id 12 = JOB-012.
// Values that only the screens need (icons, notes, flags) are kept
// in the "details" JSON column of the same row.
// ============================================================

import { PERMISSIONS as DEFAULT_PAGES, ACTIONS as DEFAULT_ACTIONS } from '../../config/defaultPermissions.js';

// ---------- id helpers ----------
export const idNum = (code) => {
  if (code === null || code === undefined || code === '') return null;
  const m = String(code).match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
};
export const toCode = (prefix, n, pad = 3) => (n === null || n === undefined ? null : `${prefix}${String(n).padStart(pad, '0')}`);

const D = (v) => (v ? String(v).slice(0, 10) : null);            // date column
const N = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const B = (v) => (v === null || v === undefined ? null : !!v);
const S = (v) => (v === null || v === undefined ? null : String(v));
const clean = (o) => JSON.parse(JSON.stringify(o ?? {}));          // drops undefined

// ---------- generic one-record <-> one-row mapping ----------
// field: [appKey, column, kind]   kind: id | ref:<prefix>:<pad> | date | num | int | bool | str | user | json
function makeEntity({ table, pk, prefix, pad = 3, fields, skip = [], toExtra, fromExtra, derivedCols = [] }) {
  const mapped = new Set(['id', ...fields.map(f => f[0]), ...skip]);
  const refPrefix = (kind) => kind.split(':')[1];
  const refPad = (kind) => Number(kind.split(':')[2] || 3);
  return {
    table, pk,
    toRow(o, ctx) {
      const row = { [pk]: idNum(o.id) };
      for (const [k, col, kind = 'str'] of fields) {
        const v = o[k];
        if (kind.startsWith('ref:')) row[col] = ctx.exists(refPrefix(kind), v) ? idNum(v) : null;
        else if (kind === 'date') row[col] = D(v);
        else if (kind === 'num' || kind === 'int') row[col] = N(v);
        else if (kind === 'bool') row[col] = B(v);
        else if (kind === 'user') row[col] = ctx.user(v);
        else if (kind === 'json') row[col] = v ?? null;
        else row[col] = S(v);
      }
      const details = {};
      for (const k of Object.keys(o)) if (!mapped.has(k) && o[k] !== undefined) details[k] = o[k];
      // a reference the database cannot hold (unknown record) is kept as text
      for (const [k, col, kind = 'str'] of fields) if (kind.startsWith('ref:') && o[k] && row[col] === null) details[k] = o[k];
      row.details = clean(details);
      if (toExtra) Object.assign(row, toExtra(o, ctx));
      return row;
    },
    fromRow(r, ctx) {
      const o = { ...(r.details || {}), id: toCode(prefix, r[pk], pad) };
      for (const [k, col, kind = 'str'] of fields) {
        const v = r[col];
        if (kind.startsWith('ref:')) { if (v !== null && v !== undefined) o[k] = toCode(refPrefix(kind), v, refPad(kind)); else if (!(k in o)) o[k] = null; }
        else if (kind === 'date') o[k] = D(v);
        else if (kind === 'num' || kind === 'int') o[k] = v === null || v === undefined ? (k in o ? o[k] : null) : Number(v);
        else if (kind === 'bool') o[k] = v === null ? (k in o ? o[k] : null) : !!v;
        else if (kind === 'user') o[k] = ctx.appUser(v) ?? o[k] ?? null;
        else o[k] = v ?? (k in o ? o[k] : null);
      }
      if (fromExtra) Object.assign(o, fromExtra(r, ctx));
      return o;
    },
    derivedCols,
  };
}

// ---------- entities ----------
export const E = {
  category: makeEntity({ table: 'category', pk: 'category_id', prefix: 'CAT', fields: [
    ['name', 'category_name'], ['description', 'description'], ['parentId', 'parent_category_id', 'ref:CAT:3'],
  ], skip: ['productCount'] }),

  supplier: makeEntity({ table: 'supplier', pk: 'supplier_id', prefix: 'SUP', fields: [
    ['name', 'name'], ['contact', 'contact_person'], ['phone', 'phone'], ['email', 'email'], ['address', 'address'],
    ['rating', 'rating', 'num'], ['paymentTerms', 'payment_terms', 'int'], ['leadTime', 'lead_time_days', 'int'],
    ['status', 'status'],
  ], fromExtra: (r) => ({ status: r.status || 'active' }) }),

  product: makeEntity({ table: 'product', pk: 'product_id', prefix: 'P', fields: [
    ['sku', 'sku'], ['name', 'name'], ['description', 'description'], ['price', 'unit_price', 'num'], ['cost', 'cost_price', 'num'],
    ['stock', 'stock_qty', 'int'], ['minStock', 'reorder_level', 'int'], ['unit', 'unit_of_measure'],
    ['warranty', 'warranty_period_months', 'int'], ['condition', 'condition'], ['category', 'category_id', 'ref:CAT:3'],
    ['supplierId', 'supplier_id', 'ref:SUP:3'], ['serial', 'is_serialised', 'bool'],
  ], skip: ['obsolete'],
    toExtra: (o) => ({ is_spare_part: o.category === 'CAT006', is_active: !o.obsolete }),
    fromExtra: (r) => (r.is_active === false ? { obsolete: true } : {}) }),

  customer: makeEntity({ table: 'customer', pk: 'customer_id', prefix: 'C', fields: [
    ['name', 'name'], ['phone', 'phone'], ['email', 'email'], ['address', 'address'], ['customerType', 'customer_type'],
    ['createdAt', 'registered_date', 'date'],
  ], skip: ['creditLimit', 'creditUsed', 'dbId', 'creditApprovedBy', 'creditReviewDate'] }),

  discount: makeEntity({ table: 'discount', pk: 'discount_id', prefix: 'D', fields: [
    ['name', 'discount_name'], ['type', 'discount_type'], ['value', 'discount_value', 'num'], ['start', 'start_date', 'date'],
    ['end', 'end_date', 'date'], ['active', 'is_active', 'bool'], ['minOrder', 'min_order_amount', 'num'], ['code', 'discount_code'],
  ] }),

  batch: makeEntity({ table: 'batch', pk: 'batch_id', prefix: 'B', fields: [
    ['batchNo', 'batch_serial_number'], ['productId', 'product_id', 'ref:P:3'], ['quantity', 'quantity', 'int'],
    ['manufactureDate', 'manufacture_date', 'date'], ['receivedDate', 'received_date', 'date'],
    ['supplierWarrantyExpiry', 'supplier_warranty_expiry', 'date'], ['supplierRef', 'supplier_ref'], ['status', 'status'],
  ] }),

  quotation: makeEntity({ table: 'quotation', pk: 'quotation_id', prefix: 'QT-', fields: [
    ['supplierId', 'supplier_id', 'ref:SUP:3'], ['requestDate', 'request_date', 'date'], ['validUntil', 'valid_until', 'date'],
    ['quotedTotal', 'quoted_price', 'num'], ['status', 'status'], ['note', 'notes'],
  ] }),

  salesOrder: makeEntity({ table: 'sales_order', pk: 'sales_order_id', prefix: 'SO-', fields: [
    ['date', 'order_date', 'date'], ['subtotal', 'subtotal', 'num'], ['discountTotal', 'discount_amount', 'num'], ['tax', 'tax_amount', 'num'],
    ['grandTotal', 'total_amount', 'num'], ['paymentMethod', 'payment_type'], ['status', 'status'],
    ['customerId', 'customer_id', 'ref:C:3'], ['createdBy', 'user_id', 'user'], ['amountPaid', 'amount_paid', 'num'],
    ['deliveryRequired', 'delivery_required', 'bool'], ['installationRequired', 'installation_required', 'bool'],
  ], skip: ['items'],
    toExtra: (o, ctx) => ({ discount_id: ctx.discountIdOf(o.promoCode) }) }),

  purchaseOrder: makeEntity({ table: 'purchase_order', pk: 'po_id', prefix: 'PO-', fields: [
    ['date', 'order_date', 'date'], ['expectedDate', 'expected_delivery_date', 'date'], ['receivedDate', 'received_date', 'date'],
    ['subtotal', 'subtotal', 'num'], ['tax', 'tax_amount', 'num'], ['grandTotal', 'total_amount', 'num'], ['status', 'status'],
    ['urgent', 'is_urgent', 'bool'], ['supplierId', 'supplier_id', 'ref:SUP:3'], ['createdBy', 'user_id', 'user'],
    ['quotationId', 'quotation_id', 'ref:QT-:3'],
  ], skip: ['items'] }),

  serviceJob: makeEntity({ table: 'service_job', pk: 'service_job_id', prefix: 'JOB-', fields: [
    ['type', 'job_type'], ['scheduledDate', 'scheduled_date', 'date'], ['completedAt', 'completed_date', 'date'], ['status', 'status'],
    ['priority', 'priority'], ['description', 'fault_description'], ['resolutionNotes', 'resolution_notes'],
    ['billingStatus', 'billing_status'], ['salesOrderId', 'sales_order_id', 'ref:SO-:3'], ['customerId', 'customer_id', 'ref:C:3'],
    ['productId', 'product_id', 'ref:P:3'], ['serialNo', 'serial_no'], ['serviceFee', 'service_fee', 'num'],
    ['createdAt', 'created_date', 'date'],
  ], skip: ['visits', 'assignedTo', 'visitCount'],
    toExtra: (o, ctx) => ({ technician_id: ctx.technicianIdOf(o.assignedTo), visit_count: (o.visits || []).length }),
    fromExtra: (r, ctx) => ({ assignedTo: ctx.userOfTechnician(r.technician_id) }) }),

  sparePartRequest: makeEntity({ table: 'spare_part_request', pk: 'request_id', prefix: 'SPR-', fields: [
    ['serviceJobId', 'service_job_id', 'ref:JOB-:3'], ['productId', 'product_id', 'ref:P:3'], ['requestedQty', 'requested_qty', 'int'],
    ['issuedQty', 'issued_qty', 'int'], ['requestDate', 'request_date', 'date'], ['status', 'status'],
    ['issuedBy', 'user_id', 'user'],
  ] }),

  stockMovement: makeEntity({ table: 'stock_movement', pk: 'movement_id', prefix: 'SM', fields: [
    ['type', 'movement_type'], ['qty', 'quantity', 'int'], ['note', 'reason'], ['date', 'movement_date', 'date'],
    ['productId', 'product_id', 'ref:P:3'], ['userId', 'user_id', 'user'], ['batchId', 'batch_id', 'ref:B:3'],
  ], toExtra: (o, ctx) => ({
    service_job_id: /^JOB-\d+$/.test(o.ref || '') && ctx.exists('JOB-', o.ref) ? idNum(o.ref) : null,
    reference_doc_id: /^(PO|SO)-\d+$/.test(o.ref || '') ? idNum(o.ref) : null,
  }) }),

  exchangeRequest: makeEntity({ table: 'exchange_request', pk: 'exchange_request_id', prefix: 'RET-', fields: [
    ['createdAt', 'request_date', 'date'], ['type', 'request_type'], ['reason', 'reason'], ['status', 'status'],
    ['resolvedAt', 'approved_date', 'date'], ['salesOrderId', 'sales_order_id', 'ref:SO-:3'], ['customerId', 'customer_id', 'ref:C:3'],
    ['productId', 'product_id', 'ref:P:3'], ['approvedBy', 'user_id', 'user'], ['serviceJobId', 'service_job_id', 'ref:JOB-:3'],
  ] }),

  complaint: makeEntity({ table: 'complaint', pk: 'complaint_id', prefix: 'CMP-', fields: [
    ['createdAt', 'complaint_date', 'date'], ['subject', 'subject'], ['description', 'description'], ['status', 'status'],
    ['priority', 'priority'], ['resolvedAt', 'resolved_date', 'date'], ['resolution', 'resolution'],
    ['customerId', 'customer_id', 'ref:C:3'], ['createdBy', 'user_id', 'user'], ['serviceJobId', 'service_job_id', 'ref:JOB-:3'],
  ] }),

  reorder: makeEntity({ table: 'stock_alert', pk: 'alert_id', prefix: 'RO-', fields: [
    ['qty', 'threshold_qty', 'int'], ['requestDate', 'created_at', 'date'], ['productId', 'product_id', 'ref:P:3'],
  ], skip: ['alertType'], toExtra: (o, ctx) => ({ alert_type: o.alertType || 'reorder', is_resolved: o.status !== 'open', current_qty: ctx.stockOf(o.productId) }) }),

  audit: makeEntity({ table: 'audit_log', pk: 'audit_id', prefix: 'AL', fields: [
    ['action', 'action'], ['detail', 'detail'], ['userId', 'user_id', 'user'], ['timestamp', 'logged_at', 'json'],
  ] }),
};

// Order the tables are written in (a table comes after the tables it points to)
export const TABLE_ORDER = [
  'role', 'permission', 'role_permission', 'user', 'technician', 'technician_specialisation', 'system_setting', 'category', 'supplier', 'product', 'customer', 'credit_account',
  'discount', 'batch', 'quotation', 'sales_order', 'sales_order_item', 'warranty_record', 'purchase_order',
  'purchase_order_item', 'payable', 'service_job', 'service_visit_log', 'invoice', 'spare_part_request',
  'stock_movement', 'exchange_request', 'complaint', 'payment', 'transaction', 'refund', 'returned_item',
  'stock_alert', 'report', 'audit_log',
];
// Tables the app reads back (the others are filled from these)
export const LOAD_TABLES = [
  'role', 'permission', 'role_permission', 'user', 'technician', 'technician_specialisation', 'system_setting', 'category', 'supplier', 'product', 'customer', 'credit_account',
  'discount', 'batch', 'quotation', 'sales_order', 'sales_order_item', 'purchase_order', 'purchase_order_item',
  'service_job', 'service_visit_log', 'spare_part_request', 'stock_movement', 'exchange_request', 'complaint',
  'payment', 'stock_alert', 'report', 'audit_log',
];
export const PK = {
  role: 'role_id', permission: 'permission_id', role_permission: ['role_id', 'permission_id'], user: 'user_id', technician: 'technician_id', technician_specialisation: ['technician_id', 'specialisation'], system_setting: 'setting_id', category: 'category_id',
  supplier: 'supplier_id', product: 'product_id', customer: 'customer_id', credit_account: 'account_id', discount: 'discount_id',
  batch: 'batch_id', quotation: 'quotation_id', sales_order: 'sales_order_id', sales_order_item: 'item_id', warranty_record: 'warranty_id',
  purchase_order: 'po_id', purchase_order_item: 'item_id', payable: 'payable_id', service_job: 'service_job_id',
  service_visit_log: 'visit_log_id', invoice: 'invoice_id', spare_part_request: 'request_id', stock_movement: 'movement_id',
  exchange_request: 'exchange_request_id', complaint: 'complaint_id', payment: 'payment_id', transaction: 'transaction_id',
  refund: 'refund_id', returned_item: 'return_id', stock_alert: 'alert_id', report: 'report_id', audit_log: 'audit_id',
};

// Every technician row read from the database (also those of staff who left),
// so a new technician never gets a number that is already used
const TECH = { byUser: new Map(), max: 0 };
// every staff id in the database (also staff who were removed), so their old records keep the link
const KNOWN_USERS = new Set();

const SUPPLIER_PAY_BASE = 50000;     // supplier payments: payment_id 50001, 50002 … (customer payments 1, 2 …)
const CREDIT_REQ_BASE = 1000;        // credit requests: account_id 1001 … (customer credit accounts use the customer number)
const SERVICE_INVOICE_BASE = 100000; // invoices raised for service jobs
const RECON_BASE = 5000;             // reconciliation records in the report table
const CHILD = 1000;                  // child rows: order 12 line 2 -> item_id 12002

export const ROLE_LABELS = {
  admin: 'Admin / Manager', sales: 'Sales Staff / Cashier', storekeeper: 'Storekeeper',
  purchase: 'Purchasing Manager', finance: 'Finance Manager', technician: 'Technician / Service Engineer',
};
const ROLE_COLORS = { admin: 'accent', sales: 'primary', storekeeper: 'success', purchase: 'warning', finance: 'danger', technician: 'accent' };
const AVATARS = { admin: '👩‍💼', sales: '🧑‍💼', storekeeper: '🧑‍🏭', purchase: '🧑‍💻', finance: '👩‍💻', technician: '🧑‍🔧' };

export const defaultRoles = () => Object.fromEntries(Object.entries(ROLE_LABELS).map(([k, label]) => [k, { label, color: ROLE_COLORS[k], active: true, dbId: null }]));

export const roleKeyFrom = (name) => {
  const n = (name || '').toLowerCase();
  if (!n) return null;
  if (n.includes('admin') || (n.includes('manager') && !n.includes('purchas') && !n.includes('financ'))) return 'admin';
  if (n.includes('sales') || n.includes('cashier')) return 'sales';
  if (n.includes('store')) return 'storekeeper';
  if (n.includes('purchas')) return 'purchase';
  if (n.includes('financ')) return 'finance';
  if (n.includes('tech') || n.includes('engineer')) return 'technician';
  return ROLE_LABELS[n] ? n : null;
};

const addMonths = (date, months) => {
  if (!date) return null;
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + Math.round((months || 0) * 30.44));
  return d.toISOString().slice(0, 10);
};
const addDaysStr = (date, days) => {
  if (!date) return null;
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + (Number(days) || 0));
  return d.toISOString().slice(0, 10);
};

// ============================================================
// app records -> table rows
// state = { users, roles, settings, categories, suppliers, products, customers, creditRequests, discounts,
//           batches, quotations, salesOrders, purchaseOrders, serviceJobs, spareRequests, stockMovements,
//           returns, complaints, payments, supplierPayments, reorders, reportSchedules, reconciliations, audit }
// ============================================================
export function toTables(state) {
  const sets = {
    'CAT': new Set(state.categories.map(x => x.id)), 'SUP': new Set(state.suppliers.map(x => x.id)),
    'P': new Set(state.products.map(x => x.id)), 'C': new Set(state.customers.map(x => x.id)),
    'QT-': new Set(state.quotations.map(x => x.id)), 'SO-': new Set(state.salesOrders.map(x => x.id)),
    'PO-': new Set(state.purchaseOrders.map(x => x.id)), 'JOB-': new Set(state.serviceJobs.map(x => x.id)),
    'B': new Set(state.batches.map(x => x.id)),
  };
  const userIds = new Set([...KNOWN_USERS, ...state.users.map(u => u.id)]);
  // technicians get a technician_id (kept on the user record)
  let nextTech = Math.max(TECH.max, ...state.users.map(u => u.technicianId || 0)) + 1;
  state.users.filter(u => u.role === 'technician' && !u.technicianId).forEach(u => {
    u.technicianId = TECH.byUser.get(u.id) || nextTech++;     // a returning technician keeps his old number
    TECH.byUser.set(u.id, u.technicianId);
    TECH.max = Math.max(TECH.max, u.technicianId);
  });
  // jobs of a technician who was removed keep his number (they are not moved to anyone else)
  const techOf = { ...Object.fromEntries(TECH.byUser), ...Object.fromEntries(state.users.filter(u => u.technicianId).map(u => [u.id, u.technicianId])) };
  const productOf = Object.fromEntries(state.products.map(p => [p.id, p]));
  const supplierOf = Object.fromEntries(state.suppliers.map(s => [s.id, s]));
  const ctx = {
    exists: (prefix, code) => !!code && !!sets[prefix]?.has(code),
    user: (id) => (id && userIds.has(id) ? id : null),
    technicianIdOf: (userId) => techOf[userId] || null,
    discountIdOf: (code) => idNum(state.discounts.find(d => d.code && code && d.code.toLowerCase() === String(code).toLowerCase())?.id),
    stockOf: (pid) => productOf[pid]?.stock ?? null,
  };
  const T = Object.fromEntries(TABLE_ORDER.map(t => [t, []]));

  // roles and staff
  for (const [key, r] of Object.entries(state.roles)) {
    if (!r.dbId) continue;
    T.role.push({ role_id: r.dbId, role_name: r.label, description: r.description || null, is_active: r.active !== false });
  }
  // permissions (pages and buttons) and the M:N relationship role_permission (granted_date, access_type)
  const permId = {};
  (state.permissions || []).forEach(p => {
    permId[p.name] = p.id;
    T.permission.push({ permission_id: p.id, permission_name: p.name, module: p.module || null, action: p.action || null });
  });
  for (const [key, grants] of Object.entries(state.rolePermissions || {})) {
    const roleId = state.roles[key]?.dbId;
    if (!roleId) continue;
    const seen = new Set();
    grants.forEach(g => {
      const pid = permId[g.name];
      if (!pid || seen.has(pid)) return;
      seen.add(pid);
      T.role_permission.push({ role_id: roleId, permission_id: pid, granted_date: g.grantedDate || null, access_type: g.accessType || 'allow' });
    });
  }
  for (const u of state.users) {
    T.user.push({ user_id: u.id, username: u.username || null, full_name: u.name, email: u.email, phone: u.phone || null, user_type: u.role,
      is_active: u.deleted ? false : true, is_locked: u.active === false, access_level: u.accessLevel || null, department: u.department || null,
      role_id: state.roles[u.role]?.dbId || null });
    // multivalued attribute: one technician_specialisation row per skill
    if (u.technicianId) (u.skills || []).forEach(sk => T.technician_specialisation.push({ technician_id: u.technicianId, specialisation: sk }));
    if (u.technicianId) T.technician.push({ technician_id: u.technicianId, user_id: u.id,
      certification_level: u.certification || null, assigned_zone: u.zone || null, is_available: u.active !== false });
  }
  // settings: one row per setting
  Object.entries(state.settings).forEach(([k, v], i) => T.system_setting.push({
    setting_id: i + 1, setting_key: k, setting_value: String(v), category: /Limit|Jobs/.test(k) ? 'approval' : /warranty|return/i.test(k) ? 'warranty' : 'general',
    warranty_months: k === 'warrantyMonths' ? Number(v) : null, warranty_terms: k === 'warrantyTerms' ? String(v) : null,
    updated_at: state.settingsMeta?.[k]?.updatedAt || null, user_id: ctx.user(state.settingsMeta?.[k]?.updatedBy),
  }));

  const put = (ent, list) => list.forEach(o => T[ent.table].push(ent.toRow(o, ctx)));
  put(E.category, state.categories);
  put(E.supplier, state.suppliers);
  put(E.product, state.products);
  put(E.customer, state.customers);
  // credit accounts: one per customer (account_id = customer number) + credit requests (1000 + n)
  state.customers.forEach(c => T.credit_account.push({ account_id: idNum(c.id), customer_id: idNum(c.id), credit_limit: N(c.creditLimit) ?? 0,
    current_balance: N(c.creditUsed) ?? 0, status: 'active', requested_limit: null, last_review_date: D(c.creditReviewDate),
    user_id: ctx.user(c.creditApprovedBy), details: {} }));
  state.creditRequests.forEach(r => {
    const { id, customerId, currentLimit, requestedLimit, requestDate, status, decidedBy, ...rest } = r;
    T.credit_account.push({ account_id: CREDIT_REQ_BASE + idNum(id), customer_id: ctx.exists('C', customerId) ? idNum(customerId) : null,
      credit_limit: N(currentLimit), current_balance: null, status, requested_limit: N(requestedLimit), last_review_date: D(requestDate),
      user_id: ctx.user(decidedBy), details: clean({ ...rest, ...(decidedBy && !ctx.user(decidedBy) ? { decidedBy } : {}) }) });
  });
  put(E.discount, state.discounts);
  put(E.batch, state.batches);
  put(E.quotation, state.quotations);

  // sales orders + lines + warranty records + invoices
  put(E.salesOrder, state.salesOrders);
  state.salesOrders.forEach(o => {
    const n = idNum(o.id);
    (o.items || []).forEach((it, i) => {
      const p = productOf[it.productId];
      const itemId = n * CHILD + i + 1;
      T.sales_order_item.push({ item_id: itemId, sales_order_id: n, product_id: ctx.exists('P', it.productId) ? idNum(it.productId) : null,
        quantity: N(it.qty), unit_price: N(it.unitPrice), line_discount: N(it.discount) ?? 0, warranty_months: p?.warranty ?? null,
        details: clean({ name: it.name, total: it.total, ...(ctx.exists('P', it.productId) ? {} : { productId: it.productId }) }) });
      if (p?.warranty && o.status !== 'on-hold') {
        const exp = addMonths(D(o.date), p.warranty);
        T.warranty_record.push({ warranty_id: itemId, sales_order_id: n, product_id: idNum(p.id), sale_date: D(o.date), expiry_date: exp,
          warranty_terms: state.settings.warrantyTerms || null, status: exp && exp >= new Date().toISOString().slice(0, 10) ? 'valid' : 'expired' });
      }
    });
    if (o.invoiceNo) T.invoice.push({ invoice_id: n, sales_order_id: n, service_job_id: null, invoice_date: D(o.date),
      amount_due: N(o.balance) ?? 0, due_date: addDaysStr(D(o.date), 30), status: o.paymentStatus || null, notes: o.invoiceNo });
  });

  // purchase orders + lines + payables
  put(E.purchaseOrder, state.purchaseOrders);
  const paidToPo = {};
  state.supplierPayments.forEach(sp => { if (sp.date) paidToPo[sp.purchaseOrderId] = (paidToPo[sp.purchaseOrderId] || 0) + (Number(sp.amount) || 0); });
  const payablePo = new Set(state.supplierPayments.map(sp => sp.purchaseOrderId));
  state.purchaseOrders.forEach(po => {
    const n = idNum(po.id);
    (po.items || []).forEach((it, i) => T.purchase_order_item.push({ item_id: n * CHILD + i + 1, po_id: n,
      product_id: ctx.exists('P', it.productId) ? idNum(it.productId) : null, quantity: N(it.qty), unit_cost: N(it.unitCost),
      received_qty: N(it.receivedQty), details: clean({ name: it.name, total: it.total }) }));
    if ((po.payableStatus && po.payableStatus !== 'none') || payablePo.has(po.id)) {
      const terms = Number(supplierOf[po.supplierId]?.paymentTerms) || 30;
      T.payable.push({ payable_id: n, po_id: n, supplier_id: ctx.exists('SUP', po.supplierId) ? idNum(po.supplierId) : null,
        amount_due: (N(po.grandTotal) || 0) - (paidToPo[po.id] || 0), due_date: addDaysStr(D(po.receivedDate || po.date), terms),
        status: po.payableStatus || 'pending' });
    }
  });

  // service jobs + visits + service invoices
  put(E.serviceJob, state.serviceJobs);
  state.serviceJobs.forEach(j => {
    const n = idNum(j.id);
    (j.visits || []).forEach((v, i) => T.service_visit_log.push({ visit_log_id: n * CHILD + i + 1, service_job_id: n,
      visit_date: D(v.date), visit_notes: v.note || null, visit_type: v.type || null,
      duration_minutes: v.duration ? Math.round(Number(v.duration) * 60) : null, user_id: ctx.user(v.userId) }));
    if (['invoiced', 'paid'].includes(j.billingStatus) && j.serviceFee > 0) T.invoice.push({ invoice_id: SERVICE_INVOICE_BASE + n,
      sales_order_id: null, service_job_id: n, invoice_date: D(j.billedAt || j.completedAt || j.updatedAt), amount_due: j.billingStatus === 'paid' ? 0 : N(j.serviceFee),
      due_date: null, status: j.billingStatus, notes: `Service ${j.id}` });
  });
  put(E.sparePartRequest, state.spareRequests);
  put(E.stockMovement, state.stockMovements);
  put(E.exchangeRequest, state.returns);
  put(E.complaint, state.complaints);

  // payments (customer 1…, supplier 50001…) and their transactions
  const invoiceIds = new Set(T.invoice.map(i => i.invoice_id));
  const payableIds = new Set(T.payable.map(p => p.payable_id));
  state.payments.forEach(p => {
    const { id, date, amount, method, recordedBy, salesOrderId, ...rest } = p;
    const n = idNum(id);
    const isRefund = /^Refund/.test(p.note || '') || p.type === 'refund';
    const inv = invoiceIds.has(idNum(salesOrderId)) && /^SO-/.test(salesOrderId || '') ? idNum(salesOrderId) : null;
    T.payment.push({ payment_id: n, payment_date: D(date), amount: N(amount), payment_method: method || null,
      payment_type: isRefund ? 'refund' : 'customer', reference_number: id, is_refund: isRefund, invoice_id: inv, payable_id: null,
      user_id: ctx.user(recordedBy), details: clean({ ...rest, salesOrderId }) });
    T.transaction.push({ transaction_id: n, transaction_type: isRefund ? 'refund' : 'customer payment', amount: isRefund ? -N(amount) : N(amount),
      transaction_date: D(date), related_reference: salesOrderId || id, category: 'sales', is_reconciled: false, payment_id: n, invoice_id: inv });
  });
  state.supplierPayments.forEach(sp => {
    const { id, date, amount, method, recordedBy, purchaseOrderId, ...rest } = sp;
    const n = SUPPLIER_PAY_BASE + idNum(id);
    const pay = payableIds.has(idNum(purchaseOrderId)) ? idNum(purchaseOrderId) : null;
    T.payment.push({ payment_id: n, payment_date: D(date), amount: N(amount), payment_method: method || null, payment_type: 'supplier',
      reference_number: id, is_refund: false, invoice_id: null, payable_id: pay, user_id: ctx.user(recordedBy),
      details: clean({ ...rest, purchaseOrderId }) });
    if (date) T.transaction.push({ transaction_id: n, transaction_type: 'supplier payment', amount: -N(amount), transaction_date: D(date),
      related_reference: purchaseOrderId, category: 'purchasing', is_reconciled: false, payment_id: n, invoice_id: null });
  });
  const paymentIds = new Set(T.payment.map(p => p.payment_id));

  // refunds and returned items come from the return / exchange requests
  state.returns.forEach(r => {
    const n = idNum(r.id);
    if (r.type === 'refund' && r.refundStatus && r.refundStatus !== 'none') {
      const payN = idNum(r.refundReceiptNo);
      T.refund.push({ refund_id: n, exchange_request_id: n, refund_date: D(r.refundPaidAt || r.resolvedAt), refund_amount: N(r.refundAmount),
        refund_method: 'transfer', status: r.refundStatus, reason: r.reason || null, return_received: !!r.inventoryUpdated,
        payment_id: payN && paymentIds.has(payN) ? payN : null, user_id: ctx.user(r.adminApprovedBy || r.approvedBy) });
    }
    if (r.inventoryUpdated || r.inspectionResult) T.returned_item.push({ return_id: n, exchange_request_id: n, return_date: D(r.resolvedAt || r.createdAt),
      reason: r.reason || null, condition: r.inspectionResult || null, is_serviceable: r.canRestock === null ? null : !!r.canRestock,
      is_damaged: r.canRestock === null ? null : !r.canRestock, product_id: ctx.exists('P', r.productId) ? idNum(r.productId) : null,
      user_id: ctx.user(r.receivedBy) });
  });

  put(E.reorder, state.reorders);
  // report schedules (RS001 -> 1) and reconciliation records (REC-1 -> 5001)
  state.reportSchedules.forEach(s => {
    const { id, type, frequency, recipients, lastRun, createdBy, ...rest } = s;
    T.report.push({ report_id: idNum(id), report_type: type, schedule_frequency: frequency, recipients: (recipients || []).join(','),
      generated_date: D(lastRun), format: 'pdf', module: 'reports', user_id: ctx.user(createdBy), details: clean(rest) });
  });
  state.reconciliations.forEach(r => {
    const { id, date, userId, ...rest } = r;
    T.report.push({ report_id: RECON_BASE + idNum(id), report_type: 'reconciliation', schedule_frequency: null, recipients: null,
      generated_date: D(date), format: null, module: 'finance', user_id: ctx.user(userId), details: clean(rest) });
  });
  put(E.audit, state.audit);
  return T;
}

// ============================================================
// table rows -> app records
// ============================================================
export function fromTables(R) {
  const g = (t) => [...(R[t] || [])].sort((a, b) => Number(a[PK[t]] > b[PK[t]]) - Number(a[PK[t]] < b[PK[t]]));
  // roles: one app role per key; prefer the row whose name is the standard label
  const roles = defaultRoles();
  g('role').forEach(r => {
    const k = roleKeyFrom(r.role_name);
    if (!k) return;
    if (!roles[k].dbId || r.role_name === ROLE_LABELS[k]) Object.assign(roles[k], { dbId: r.role_id, active: r.is_active !== false, description: r.description });
  });
  const roleById = Object.fromEntries(Object.entries(roles).filter(([, r]) => r.dbId).map(([k, r]) => [r.dbId, k]));
  const techRows = g('technician');
  const skillRows = R.technician_specialisation || [];
  TECH.byUser = new Map(techRows.filter(t => t.user_id).map(t => [t.user_id, t.technician_id]));
  TECH.max = Math.max(0, ...techRows.map(t => Number(t.technician_id) || 0));
  const techByUser = Object.fromEntries(techRows.map(t => [t.user_id, t]));
  const userOfTech = Object.fromEntries(techRows.map(t => [t.technician_id, t.user_id]));
  const users = g('user').filter(u => u.is_active !== false && u.email).map(u => {
    const role = roleById[u.role_id] || roleKeyFrom(u.user_type) || 'sales';
    const t = techByUser[u.user_id];
    return { id: u.user_id, name: u.full_name || u.email, email: u.email, phone: u.phone, role, department: u.department,
      username: u.username, accessLevel: u.access_level, createdAt: u.created_at,
      avatar: AVATARS[role] || '👤', active: u.is_locked !== true, lastLogin: u.last_login_at,
      ...(t ? { technicianId: t.technician_id, skills: skillRows.filter(x => x.technician_id === t.technician_id).map(x => x.specialisation),
        certification: t.certification_level, zone: t.assigned_zone } : {}) };
  });
  const knownUsers = new Set(g('user').map(u => u.user_id));
  KNOWN_USERS.clear(); knownUsers.forEach(id => KNOWN_USERS.add(id));
  const ctx = {
    appUser: (uuid) => (uuid && knownUsers.has(uuid) ? uuid : null),
    userOfTechnician: (tid) => (tid ? userOfTech[tid] || null : null),
  };
  const from = (ent, t) => g(t).map(r => ent.fromRow(r, ctx));

  const settings = {};
  const settingsMeta = {};
  g('system_setting').forEach(s => {
    if (s.updated_at || s.user_id) settingsMeta[s.setting_key] = { updatedAt: s.updated_at || null, updatedBy: ctx.appUser(s.user_id) ?? null };
    const v = s.setting_value;
    settings[s.setting_key] = v === 'true' ? true : v === 'false' ? false : v !== null && v !== '' && !isNaN(Number(v)) ? Number(v) : v;
  });

  const categories = from(E.category, 'category');
  const products = from(E.product, 'product');
  categories.forEach(c => { c.productCount = products.filter(p => p.category === c.id).length; });
  const accounts = g('credit_account');
  const customers = from(E.customer, 'customer').map(c => {
    const a = accounts.find(x => x.account_id === idNum(c.id) && x.account_id < CREDIT_REQ_BASE);
    const out = { ...c, creditLimit: a ? Number(a.credit_limit) || 0 : 0, creditUsed: a ? Number(a.current_balance) || 0 : 0, balance: c.balance ?? 0 };
    if (a?.user_id) out.creditApprovedBy = ctx.appUser(a.user_id);
    if (a?.last_review_date) out.creditReviewDate = D(a.last_review_date);
    return out;
  });
  const creditRequests = accounts.filter(a => a.account_id > CREDIT_REQ_BASE).map(a => ({
    ...(a.details || {}), id: toCode('CR-', a.account_id - CREDIT_REQ_BASE), customerId: toCode('C', a.customer_id),
    currentLimit: Number(a.credit_limit) || 0, requestedLimit: Number(a.requested_limit) || 0, requestDate: D(a.last_review_date),
    status: a.status, decidedBy: ctx.appUser(a.user_id) ?? a.details?.decidedBy ?? null,
  }));

  const productOf = Object.fromEntries(products.map(p => [p.id, p]));
  const soItems = g('sales_order_item');
  const salesOrders = from(E.salesOrder, 'sales_order').map(o => {
    const n = idNum(o.id);
    o.items = soItems.filter(i => i.sales_order_id === n).map(i => {
      const pid = toCode('P', i.product_id) || i.details?.productId || null;
      const qty = Number(i.quantity) || 0, unitPrice = Number(i.unit_price) || 0, discount = Number(i.line_discount) || 0;
      return { productId: pid, name: i.details?.name || productOf[pid]?.name || pid, qty, unitPrice, discount, total: i.details?.total ?? qty * unitPrice - discount };
    });
    o.balance = o.balance ?? Math.max(0, (o.grandTotal || 0) - (o.amountPaid || 0));
    return o;
  });
  const poItems = g('purchase_order_item');
  const purchaseOrders = from(E.purchaseOrder, 'purchase_order').map(po => {
    const n = idNum(po.id);
    po.items = poItems.filter(i => i.po_id === n).map(i => {
      const pid = toCode('P', i.product_id);
      const it = { productId: pid, name: i.details?.name || productOf[pid]?.name || pid, qty: Number(i.quantity) || 0, unitCost: Number(i.unit_cost) || 0,
        total: i.details?.total ?? (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0) };
      if (i.received_qty !== null && i.received_qty !== undefined) it.receivedQty = Number(i.received_qty);
      return it;
    });
    return po;
  });
  const visits = g('service_visit_log');
  const serviceJobs = from(E.serviceJob, 'service_job').map(j => {
    const n = idNum(j.id);
    j.visits = visits.filter(v => v.service_job_id === n).map(v => {
      const x = { date: D(v.visit_date), note: v.visit_notes, userId: ctx.appUser(v.user_id) };
      if (v.visit_type) x.type = v.visit_type;
      if (v.duration_minutes) x.duration = v.duration_minutes / 60;
      return x;
    });
    j.partsUsed = j.partsUsed || [];
    return j;
  });
  const payRows = g('payment');
  const payments = payRows.filter(p => p.payment_type !== 'supplier').map(p => ({
    ...(p.details || {}), id: p.reference_number || toCode('PAY-', p.payment_id), date: D(p.payment_date), amount: Number(p.amount) || 0,
    method: p.payment_method, recordedBy: ctx.appUser(p.user_id) }));
  const supplierPayments = payRows.filter(p => p.payment_type === 'supplier').map(p => ({
    ...(p.details || {}), id: p.reference_number || toCode('SPAY-', p.payment_id - SUPPLIER_PAY_BASE), date: D(p.payment_date),
    amount: Number(p.amount) || 0, method: p.payment_method, recordedBy: ctx.appUser(p.user_id) }));
  const reports = g('report');
  const reportSchedules = reports.filter(r => r.report_id < RECON_BASE).map(r => ({ active: true, ...(r.details || {}),
    id: toCode('RS', r.report_id), type: r.report_type, frequency: r.schedule_frequency,
    recipients: (r.recipients || '').split(',').map(s => s.trim()).filter(Boolean), lastRun: D(r.generated_date), createdBy: ctx.appUser(r.user_id) }));
  const reconciliations = reports.filter(r => r.report_id > RECON_BASE).map(r => ({ ...(r.details || {}),
    id: `REC-${r.report_id - RECON_BASE}`, date: D(r.generated_date), userId: ctx.appUser(r.user_id) }));
  const reorders = g('stock_alert').map(a => ({ ...E.reorder.fromRow(a, ctx), ...(a.alert_type && a.alert_type !== 'reorder' ? { alertType: a.alert_type } : {}),
    status: a.details?.status ?? (a.is_resolved ? 'closed' : 'open') }));
  const audit = from(E.audit, 'audit_log').sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

  // permissions: read from the permission and role_permission tables
  // (an empty database is filled once from the starting lists in config/defaultPermissions.js)
  let permissions = g('permission').map(p => ({ id: Number(p.permission_id), name: p.permission_name, module: p.module, action: p.action }));
  const rolePermissions = {};
  if (permissions.length) {
    const nameOf = Object.fromEntries(permissions.map(p => [p.id, p.name]));
    g('role_permission').forEach(rp => {
      const key = roleById[rp.role_id];
      const name = nameOf[Number(rp.permission_id)];
      if (!key || !name) return;
      (rolePermissions[key] = rolePermissions[key] || []).push({ name, grantedDate: D(rp.granted_date), accessType: rp.access_type || 'allow' });
    });
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const names = [...new Set([...Object.values(DEFAULT_PAGES).flat().map(p => `page:${p}`), ...Object.values(DEFAULT_ACTIONS).flat()])];
    permissions = names.map((n, i) => n.startsWith('page:')
      ? { id: i + 1, name: n, module: n.slice(5), action: 'open' }
      : { id: i + 1, name: n, module: n.split('.')[0], action: n.split('.')[1] });
    Object.keys(ROLE_LABELS).forEach(k => {
      rolePermissions[k] = [...(DEFAULT_PAGES[k] || []).map(p => `page:${p}`), ...(DEFAULT_ACTIONS[k] || [])]
        .map(name => ({ name, grantedDate: today, accessType: 'allow' }));
    });
  }
  for (const k of Object.keys(ROLE_LABELS)) rolePermissions[k] = rolePermissions[k] || [];

  return {
    permissions, rolePermissions, settingsMeta,
    users, roles, settings, categories, suppliers: from(E.supplier, 'supplier'), products, customers, creditRequests,
    discounts: from(E.discount, 'discount'), batches: from(E.batch, 'batch'), quotations: from(E.quotation, 'quotation'),
    salesOrders, purchaseOrders, serviceJobs, spareRequests: from(E.sparePartRequest, 'spare_part_request'),
    stockMovements: from(E.stockMovement, 'stock_movement'), returns: from(E.exchangeRequest, 'exchange_request'),
    complaints: from(E.complaint, 'complaint'), payments, supplierPayments, reorders, reportSchedules, reconciliations, audit,
  };
}
