// Unit tests: File Design attributes that the system now stores (permissions, staff details,
// parent category, credit approver, batch links, stock alerts, setting changes)
import { describe, test, expect, beforeEach } from 'vitest';
import { fromTables, toTables } from '../src/lib/db/schemaMap';
import * as S from '../src/data/store';
import { loadRows } from './helpers';

let R;
beforeEach(() => { R = loadRows(); S.clearStore(); S.applyState(fromTables(R)); });

describe('permissions come from the permission and role_permission tables', () => {
  test('each role gets its pages and buttons from the database', () => {
    expect(S.PERMISSIONS_LIST).toHaveLength(R.permission.length);
    expect(S.pagesOf('admin')).toContain('users');
    expect(S.pagesOf('technician')).toEqual(expect.arrayContaining(['service-jobs', 'service-history']));
    expect(S.pagesOf('technician')).not.toContain('users');
    expect(S.actionsOf('storekeeper')).toContain('stock.adjust');
    expect(S.actionsOf('sales')).not.toContain('stock.adjust');
  });
  test('a permission removed in the database is gone from the app', () => {
    const page = R.permission.find(p => p.permission_name === 'page:warranty');
    const salesRole = R.role.find(r => r.role_name === 'Sales Staff / Cashier');
    R.role_permission = R.role_permission.filter(rp => !(rp.role_id === salesRole.role_id && rp.permission_id === page.permission_id));
    S.applyState(fromTables(R));
    expect(S.pagesOf('sales')).not.toContain('warranty');
  });
  test('access_type "deny" takes the permission away', () => {
    const page = R.permission.find(p => p.permission_name === 'page:reports');
    const role = R.role.find(r => r.role_name === 'Finance Manager');
    R.role_permission.find(rp => rp.role_id === role.role_id && rp.permission_id === page.permission_id).access_type = 'deny';
    S.applyState(fromTables(R));
    expect(S.pagesOf('finance')).not.toContain('reports');
  });
  test('setRolePages keeps the old granted date and dates new pages today', () => {
    const before = S.ROLE_PERMISSIONS.purchase.find(g => g.name === 'page:suppliers').grantedDate;
    S.setRolePages('purchase', [...S.pagesOf('purchase'), 'warranty']);
    const grants = S.ROLE_PERMISSIONS.purchase;
    expect(grants.find(g => g.name === 'page:suppliers').grantedDate).toBe(before);
    expect(grants.find(g => g.name === 'page:warranty').grantedDate).toBe(S.today());
    expect(S.actionsOf('purchase')).toContain('po.create');               // buttons are not touched
    S.setRolePages('purchase', S.pagesOf('purchase').filter(p => p !== 'stock'));
    expect(S.pagesOf('purchase')).not.toContain('stock');
  });
  test('the change is written to role_permission (granted_date, access_type)', () => {
    S.setRolePages('purchase', [...S.pagesOf('purchase'), 'warranty']);
    const T = toTables(S.currentState());
    const pid = T.permission.find(p => p.permission_name === 'page:warranty').permission_id;
    const row = T.role_permission.find(r => r.role_id === S.ROLES.purchase.dbId && r.permission_id === pid);
    expect(row).toMatchObject({ granted_date: S.today(), access_type: 'allow' });
  });
  test('an empty database is filled from the starting permission lists', () => {
    R.permission = []; R.role_permission = [];
    const s = fromTables(R);
    expect(s.permissions.length).toBeGreaterThan(50);
    expect(s.rolePermissions.admin.map(g => g.name)).toContain('page:users');
    expect(toTables(s).role_permission.length).toBeGreaterThan(50);
  });
});

describe('staff details', () => {
  test('username, phone, department and access level are loaded and saved', () => {
    const u = S.USERS.find(x => x.role === 'sales');
    expect(u).toMatchObject({ username: 'kamal.p', phone: '0771234502', department: 'Sales', accessLevel: 'standard' });
    u.accessLevel = 'read-only';
    const row = toTables(S.currentState()).user.find(r => r.user_id === u.id);
    expect(row.access_level).toBe('read-only');
    expect(row.username).toBe('kamal.p');
  });
  test('created date and last sign-in are read (the database fills them)', () => {
    const u = S.USERS[0];
    expect(u.createdAt).toBeTruthy();
    expect(toTables(S.currentState()).user[0]).not.toHaveProperty('created_at');
  });
  test('technician certification level and zone', () => {
    const t = S.USERS.find(x => x.role === 'technician');
    expect(t.certification).toMatch(/Level 3/);
    expect(t.zone).toMatch(/Colombo/);
  });
});

describe('settings remember who changed them', () => {
  test('markSettingsUpdated fills updated_at and user_id of the changed rows only', () => {
    const admin = S.USERS.find(x => x.role === 'admin');
    S.markSettingsUpdated(['taxRate'], admin.id);
    const rows = toTables(S.currentState()).system_setting;
    const tax = rows.find(r => r.setting_key === 'taxRate');
    expect(tax.user_id).toBe(admin.id);
    expect(tax.updated_at.slice(0, 10)).toBe(new Date().toISOString().slice(0, 10));
    expect(S.lastSettingsUpdate().updatedBy).toBe(admin.id);
  });
});

describe('categories', () => {
  test('a category can have a parent category (same table)', () => {
    const cpu = S.CATEGORIES.find(c => c.id === 'CAT001');
    expect(cpu.parentId).toBe('CAT007');
    expect(S.CATEGORIES.find(c => c.id === 'CAT007').parentId).toBeNull();
    cpu.parentId = 'CAT008';
    expect(toTables(S.currentState()).category.find(c => c.category_id === 1).parent_category_id).toBe(8);
  });
  test('a parent that does not exist is not written as a foreign key', () => {
    S.CATEGORIES[0].parentId = 'CAT099';
    expect(toTables(S.currentState()).category.find(c => c.category_id === 1).parent_category_id).toBeNull();
  });
});

describe('other links', () => {
  test('credit account remembers who approved the limit and when', () => {
    const c = S.CUSTOMERS.find(x => x.creditLimit > 0);
    expect(c.creditApprovedBy).toBe(S.USERS.find(u => u.role === 'finance').id);
    expect(c.creditReviewDate).toBeTruthy();
    const row = toTables(S.currentState()).credit_account.find(a => a.account_id === Number(c.id.slice(1)));
    expect(row.user_id).toBe(c.creditApprovedBy);
  });
  test('a stock movement points to its batch', () => {
    const m = S.STOCK_MOVEMENTS.find(x => x.batchId);
    expect(S.BATCHES.some(b => b.id === m.batchId)).toBe(true);
    expect(toTables(S.currentState()).stock_movement.find(r => r.movement_id === Number(m.id.slice(2))).batch_id).toBe(Number(m.batchId.slice(1)));
  });
  test('batches have a manufacture date before the received date', () => {
    for (const b of S.BATCHES) expect(b.manufactureDate < b.receivedDate).toBe(true);
  });
  test('low-stock alerts are loaded and saved with their alert type', () => {
    const a = S.REORDER_REQUESTS.find(x => x.alertType === 'low_stock');
    expect(a.status).toBe('open');
    a.status = 'closed';
    const row = toTables(S.currentState()).stock_alert.find(r => r.alert_id === Number(a.id.slice(3)));
    expect(row).toMatchObject({ alert_type: 'low_stock', is_resolved: true });
  });
  test('the returned item records the storekeeper who received it', () => {
    const row = toTables(S.currentState()).returned_item[0];
    expect(row.user_id).toBe(S.USERS.find(u => u.role === 'storekeeper').id);
  });
  test('sales orders keep delivery / installation flags and the promotion used', () => {
    const T = toTables(S.currentState());
    expect(T.sales_order.some(o => o.installation_required)).toBe(true);
    expect(T.sales_order.some(o => o.discount_id)).toBe(true);
  });
  test('complaint and exchange request can point to a service job', () => {
    expect(S.COMPLAINTS.some(c => c.serviceJobId)).toBe(true);
    expect(S.RETURNS.some(r => r.serviceJobId)).toBe(true);
  });
});
