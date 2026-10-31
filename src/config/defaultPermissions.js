// ============================================================
// Starting permissions of each role (from the proposed use case diagram).
// These lists are ONLY used to create the rows of the "permission" and
// "role_permission" tables (supabase/04_company_data.sql) and to fill an
// empty database the first time. While the system runs, the permissions
// are read from and saved to those two tables (Users > Roles & Permissions).
// ============================================================

// Pages each role may open
export const PERMISSIONS = {
  admin: [
    'dashboard', 'users', 'settings', 'reports',
    'customers', 'products', 'categories', 'stock', 'stock-movements', 'stock-adjustments',
    'sales', 'pos', 'invoices',
    'suppliers', 'purchase-orders',
    'service-jobs', 'service-history',
    'returns', 'complaints', 'warranty',
    'payments', 'payables', 'finance-reports',
  ],
  sales: [
    'dashboard', 'pos', 'sales', 'invoices', 'customers',
    'products', 'stock', 'warranty', // Check product warranty status
    'service-jobs', // Register installation / delivery request linked to sales order
    'returns', 'complaints', // Process exchange request, check warranty, process refund, log complaints
    'reports', // Generate sales report
  ],
  storekeeper: [
    'dashboard',
    'products', 'categories', // Add / update product info, categorise product, track serials
    'stock', 'stock-movements', 'stock-adjustments', // Real-time stock, low stock alert, stock in/out, verify consistency
    'service-jobs', // Issue spare parts for service job
    'returns', // Receive returned/exchanged items, inspect condition, update stock or write off
    'reports', // Generate stock report
  ],
  purchase: [
    'dashboard',
    'suppliers', // Manage supplier info, view supplier history & performance
    'purchase-orders', // Create PO, select supplier/quote, track status, receive stock into inventory, urgent reorder
    'products', 'stock', // View stock to reorder frequently exchanged products
    'reports', // Purchasing & inventory reports
  ],
  finance: [
    'dashboard',
    'payments', 'payables', // Manage customer & supplier payments, payment history, refund payments, reconcile sales/purchases
    'invoices', // Track outstanding invoices, send payment reminder, flag overdue
    'returns', // Process approved refund payment
    'customers', // Approve credit limits for customers
    'sales', // View financial order transactions & dues
    'service-jobs', // Track service job billing
    'reports', // Generate financial reports, real-time analytics
  ],
  technician: [
    'dashboard',
    'service-jobs', // View assigned jobs, installation completion, log maintenance visit, repair/fault details, request spare parts, recommend exchange
    'service-history', // View service visit history
    'products', 'stock', // View spare parts inventory
  ],
};

// Action-level permissions: which BUTTONS each role may use (from the proposed use case diagram).
// Pages a role can open are in PERMISSIONS; inside a page, a button shows only if its action is listed here.
export const ACTIONS = {
  admin: [ // supervisory: approve, assign, review
    'product.add', 'product.edit',
    'service.create', 'service.assign',
    'return.approve', 'complaint.escalate', 'complaint.resolve',
    'user.manage', 'settings.manage', 'report.export', 'report.schedule',
    'po.approveEscalated', // approve purchase orders escalated above the approval limit
    'refund.adminApprove', // approve refunds above the refund approval limit
    'complaint.toServiceJob', // escalate an unresolved complaint to a service job
    'credit.approveEscalated', // approve credit limits above Finance's authority
  ],
  sales: [
    'sale.create',
    'customer.add', 'customer.edit', 'customer.delete',
    'service.create',
    'return.create', 'complaint.create', 'complaint.escalate',
    'refund.send', // send an approved refund to Finance
    'report.export',
  ],
  storekeeper: [
    'product.add', 'product.edit', 'product.delete',
    'stock.adjust', 'stock.verify', 'stock.alert',
    'service.issueParts', 'return.inspect',
    'stock.receive', 'stock.batch', 'product.obsolete',
    'report.export',
  ],
  purchase: [
    'po.create', 'po.receive', 'po.approve', 'po.edit', 'po.reorder', 'po.remind', 'quote.request', 'quote.price', 'supplier.rate',
    'supplier.add', 'supplier.edit', 'supplier.deactivate', // deactivate = soft delete (mark inactive)
    'report.export',
  ],
  finance: [
    'payment.record', 'payment.remind', 'payment.flagOverdue', 'payable.pay',
    'refund.pay', 'customer.edit', // customer.edit = approve credit limit
    'service.bill', 'payment.reconcile', 'report.schedule', 'credit.approve',
    'report.export',
  ],
  technician: [
    'service.updateStatus', 'service.logVisit', 'service.recordRepair', 'service.requestParts',
  ],
};
