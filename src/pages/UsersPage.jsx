import { useState, useEffect } from 'react';
import { USERS, ROLES, AUDIT_LOG, newAuditId, pagesOf, setRolePages, permissionsChangedOn, isValidPhone } from '../data/store';
import { Plus, Shield, Lock, Unlock, Search, Edit2, Trash2, KeyRound, UserPlus } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { createStaffAccount } from '../lib/staffAccounts';
import { format } from 'date-fns';

// Pages that can be given to a role (permission table)
const PAGE_PERMISSIONS = [
  ['dashboard', 'Dashboard'], ['pos', 'Point of Sale'], ['sales', 'Sales Orders'], ['invoices', 'Invoices'],
  ['customers', 'Customers'], ['products', 'Products'], ['stock', 'Stock'], ['stock-movements', 'Stock Movements'],
  ['warranty', 'Warranty Check'], ['suppliers', 'Suppliers'], ['purchase-orders', 'Purchase Orders'],
  ['service-jobs', 'Service Jobs'], ['service-history', 'Service History'], ['returns', 'Returns & Exchanges'],
  ['complaints', 'Complaints'], ['payments', 'Payments'], ['payables', 'Payables'], ['reports', 'Reports'],
  ['users', 'Users & Roles'], ['settings', 'Settings'],
];

// Technician skills (multivalued attribute -> technician_specialisation table)
const SKILLS = ['installation', 'repair', 'maintenance'];
const ACCESS_LEVELS = [['full', 'Full access'], ['standard', 'Standard'], ['read-only', 'Read only']];
const CERT_LEVELS = ['Level 1 – Trainee', 'Level 2 – Technician', 'Level 3 – Senior Technician'];

function UserModal({ user, onClose, onSave, saving }) {
  const [form, setForm] = useState(user || {
    name: '',
    username: '',
    email: '',
    phone: '',
    department: '',
    accessLevel: 'standard',
    password: '123456',
    role: 'sales',
    avatar: '🧑‍💼',
    active: true,
    skills: [...SKILLS],
    certification: CERT_LEVELS[1],
    zone: '',
  });
  const toggleSkill = (sk) => setForm(f => {
    const cur = f.skills || [];
    return { ...f, skills: cur.includes(sk) ? cur.filter(x => x !== sk) : [...cur, sk] };
  });
  const phoneOk = !form.phone || isValidPhone(form.phone);
  const skillsOk = form.role !== 'technician' || (form.skills || []).length > 0;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const avatarOptions = ['👩‍💼', '🧑‍💼', '🧑‍🏭', '🧑‍💻', '👩‍💻', '🧑‍🔧', '👨‍🔧', '👨‍💼'];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <UserPlus size={20} color="var(--primary-400)" />
          <div className="modal-title">{user ? 'Edit User Account' : 'Create New User Account'}</div>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              className="form-input"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Kasun Fernando"
              required
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                className="form-input"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="name@gmail.com"
                required
              />
            </div>
            {!user && (
            <div className="form-group">
              <label className="form-label">Password * (min. 6 characters)</label>
              <input
                type="password"
                className="form-input"
                value={form.password || ''}
                onChange={e => set('password', e.target.value)}
                placeholder="Set password"
              />
            </div>
            )}
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input id="user-username" className="form-input" value={form.username || ''} onChange={e => set('username', e.target.value.replace(/\s/g, ''))} placeholder="e.g. kamal.p" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input id="user-phone" className="form-input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="07X XXX XXXX" />
              {!phoneOk && <div style={{ color: 'var(--danger-400)', fontSize: 11.5, marginTop: 4 }}>Enter a valid Sri Lankan phone number</div>}
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Department</label>
              <input id="user-department" className="form-input" value={form.department || ''} onChange={e => set('department', e.target.value)} placeholder="e.g. Sales, Stores, Service" />
            </div>
            <div className="form-group">
              <label className="form-label">Access Level</label>
              <select id="user-access" className="form-select" value={form.accessLevel || 'standard'} onChange={e => set('accessLevel', e.target.value)}>
                {ACCESS_LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Role Assignment *</label>
              <select
                id="user-role"
                className="form-select"
                value={form.role}
                onChange={e => set('role', e.target.value)}
              >
                {Object.entries(ROLES).map(([key, r]) => (
                  <option key={key} value={key}>{r.label}{r.active === false ? ' (inactive)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Avatar Emoji</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {avatarOptions.map(av => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => set('avatar', av)}
                    style={{
                      fontSize: 18,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: form.avatar === av ? '2px solid var(--primary-500)' : '1px solid var(--border-default)',
                      background: form.avatar === av ? 'var(--primary-50)' : 'var(--bg-elevated)',
                      cursor: 'pointer'
                    }}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {form.role === 'technician' && (
            <div className="card" style={{ padding: 12, marginTop: 4 }}>
              <div className="form-group">
                <label className="form-label">Skills (specialisations) *</label>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {SKILLS.map(sk => (
                    <label key={sk} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, textTransform: 'capitalize' }}>
                      <input id={`user-skill-${sk}`} type="checkbox" checked={(form.skills || []).includes(sk)} onChange={() => toggleSkill(sk)} /> {sk}
                    </label>
                  ))}
                </div>
                {!skillsOk && <div style={{ color: 'var(--danger-400)', fontSize: 11.5, marginTop: 4 }}>Choose at least one skill</div>}
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Certification Level</label>
                  <select id="user-cert" className="form-select" value={form.certification || ''} onChange={e => set('certification', e.target.value)}>
                    <option value="">– Not set –</option>
                    {CERT_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Assigned Zone</label>
                  <input id="user-zone" className="form-input" value={form.zone || ''} onChange={e => set('zone', e.target.value)} placeholder="e.g. Colombo North" />
                </div>
              </div>
            </div>
          )}
          {user?.createdAt && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Account created {String(user.createdAt).slice(0, 10)} · last sign-in {user.lastLogin ? String(user.lastLogin).slice(0, 16).replace('T', ' ') : 'never'}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={saving || !form.name || !form.email || !phoneOk || !skillsOk || (!user && (form.password || '').length < 6)}
            onClick={() => onSave(form)}
          >
            {saving ? 'Saving…' : user ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [users, setUsers] = useState(() => [...USERS]);
  const [q, setQ] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [modal, setModal] = useState(null); // null | 'new' | user object
  const [saving, setSaving] = useState(false);

  const [permDraft, setPermDraft] = useState(() =>
    Object.fromEntries(Object.keys(ROLES).map(k => [k, pagesOf(k)])));
  const [, setSavedTick] = useState(0);

  const togglePerm = (role, perm) => setPermDraft(d => ({
    ...d, [role]: d[role].includes(perm) ? d[role].filter(p => p !== perm) : [...d[role], perm],
  }));

  // Roles can be switched off; a user cannot be given an inactive role
  const [roleActive, setRoleActive] = useState(() => Object.fromEntries(Object.entries(ROLES).map(([k, r]) => [k, r.active !== false])));
  const toggleRoleActive = (key) => {
    if (key === 'admin') { toast.error('The Admin role cannot be switched off'); return; }
    const next = !roleActive[key];
    ROLES[key].active = next;
    setRoleActive(r => ({ ...r, [key]: next }));
    toast.info(`${ROLES[key].label} role is now ${next ? 'active' : 'inactive'}`);
  };

  const savePerms = (role) => {
    if (ROLES[role]?.active === false) { toast.error('Selected role is not active'); return; }
    setRolePages(role, permDraft[role]);   // saved to the role_permission table
    setSavedTick(t => t + 1);
    AUDIT_LOG.unshift({
      id: newAuditId(), action: 'PERMISSIONS_UPDATED', userId: me?.id,
      detail: `Permissions for ${ROLES[role]?.label || role} updated (${permDraft[role].length} pages)`,
      timestamp: new Date().toISOString(),
    });
    toast.success(`Role and permissions updated for ${ROLES[role]?.label || role}`);
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(q.toLowerCase()) ||
    u.email.toLowerCase().includes(q.toLowerCase()) ||
    u.role.toLowerCase().includes(q.toLowerCase())
  );

  const toggleActive = (userId) => {
    const u = USERS.find(x => x.id === userId);
    if (!u) return;
    const newStatus = !u.active;
    u.active = newStatus;   // saved to "user".is_locked
    setUsers(us => us.map(x => x.id === userId ? { ...x, active: newStatus } : x));

    AUDIT_LOG.unshift({
      id: newAuditId(),
      action: newStatus ? 'UNLOCK_ACCOUNT' : 'LOCK_ACCOUNT',
      userId: u.id,
      detail: `Account ${u.name} (${u.email}) was ${newStatus ? 'unlocked' : 'locked'}`,
      timestamp: new Date().toISOString(),
    });

    toast.info(`User account ${u.name} is now ${newStatus ? 'Active' : 'Locked'}`);
  };

  const handleSaveUser = async (form) => {
    if (ROLES[form.role]?.active === false) { toast.error('Selected role is not active'); return; }
    if (modal === 'new') {
      if (USERS.some(u => u.email.toLowerCase() === form.email.trim().toLowerCase())) {
        toast.error('A user with this e-mail already exists.');
        return;
      }
      // 1) create the Supabase Auth account so the new staff member can sign in straight away
      setSaving(true);
      const res = await createStaffAccount(form);
      setSaving(false);
      if (!res.ok) { toast.error(res.message); return; }
      const newU = {
        ...form,
        email: form.email.trim(),
        id: res.authId,          // the Supabase Auth id is the user's id in every table
        authId: res.authId,
        avatar: '👤',
        active: true,
        createdAt: new Date().toISOString(),
      };
      if (newU.role !== 'technician') { delete newU.skills; delete newU.certification; delete newU.zone; }
      delete newU.password;
      USERS.push(newU);
      setUsers(us => [...us, newU]);

      AUDIT_LOG.unshift({
        id: newAuditId(),
        action: 'CREATE_USER',
        userId: newU.id,
        detail: `New user account created: ${newU.name} as ${ROLES[newU.role]?.label || newU.role}`,
        timestamp: new Date().toISOString(),
      });

      toast.success(`User ${newU.name} created. They can sign in now with ${newU.email} and their password.`);
    } else {
      const updated = { ...modal, ...form };
      delete updated.password;
      if (updated.role === 'technician' && !updated.skills?.length) updated.skills = [...SKILLS];
      setUsers(us => us.map(u => u.id === modal.id ? updated : u));
      const i = USERS.findIndex(u => u.id === modal.id);
      if (i !== -1) USERS[i] = updated;

      AUDIT_LOG.unshift({
        id: newAuditId(),
        action: 'UPDATE_USER',
        userId: modal.id,
        detail: `Updated user profile and credentials for ${updated.name}`,
        timestamp: new Date().toISOString(),
      });

      toast.success(`User ${updated.name} updated`);
    }
    setModal(null);
  };

  const handleDeleteUser = (u) => {
    if (users.length <= 1) {
      toast.error('Cannot delete the last remaining user account');
      return;
    }
    if (confirm(`Are you sure you want to delete user ${u.name}?`)) {
      setUsers(us => us.filter(x => x.id !== u.id));
      const idx = USERS.findIndex(x => x.id === u.id);
      if (idx !== -1) USERS.splice(idx, 1);

      AUDIT_LOG.unshift({
        id: newAuditId(),
        action: 'DELETE_USER',
        userId: u.id,
        detail: `Deleted user ${u.name} (${u.email})`,
        timestamp: new Date().toISOString(),
      });

      toast.success(`User ${u.name} deleted`);
    }
  };

  const roleColors = {
    admin: 'accent', sales: 'primary', storekeeper: 'success',
    purchase: 'warning', finance: 'danger', technician: 'accent'
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Users & Role Permissions</h1>
          <p className="page-subtitle">{users.length} registered accounts · {users.filter(u => u.active).length} active</p>
        </div>
        <div className="page-header-actions">
          <button id="btn-add-user" className="btn btn-primary" onClick={() => setModal('new')}>
            <Plus size={15} /> Add User
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div className="tabs">
          <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>👥 Users</button>
          <button className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>📋 Audit Log</button>
          <button className={`tab-btn ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => setActiveTab('roles')}>🛡️ Roles & Permissions</button>
        </div>
        <div className="search-bar" style={{ marginLeft: 'auto' }}>
          <Search size={14} color="var(--text-muted)" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search users…" style={{ width: 200 }} />
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>User Profile</th>
                <th>Email Address</th>
                <th>Role & Scope</th>
                <th>Account Status</th>
                <th>Last Sign-in</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 24 }}>{u.avatar}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}{u.username && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)' }}> · @{u.username}</span>}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{u.department || (u.role === 'technician' && u.skills?.length ? u.skills.join(', ') : ROLES[u.role]?.label)}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>{u.email}</td>
                  <td>
                    <span className={`badge badge-${roleColors[u.role] || 'gray'}`}>
                      <Shield size={10} /> {ROLES[u.role]?.label || u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${u.active ? 'success' : 'danger'}`}>
                      {u.active ? '✓ Active' : '✕ Locked'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {u.lastLogin ? String(u.lastLogin).slice(0, 16).replace('T', ' ') : 'Never'}
                    </span>
                  </td>
                  <td>
                    <div className="table-action-cell">
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        title="Edit user"
                        onClick={() => setModal(u)}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className={`btn btn-sm ${u.active ? 'btn-outline' : 'btn-success'}`}
                        onClick={() => toggleActive(u.id)}
                        title={u.active ? 'Lock Account' : 'Unlock Account'}
                      >
                        {u.active ? <><Lock size={12} /> Lock</> : <><Unlock size={12} /> Unlock</>}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        style={{ color: 'var(--danger-400)' }}
                        title="Delete User"
                        onClick={() => handleDeleteUser(u)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Timestamp</th><th>Action Code</th><th>User</th><th>Audit Event Details</th></tr>
            </thead>
            <tbody>
              {AUDIT_LOG.map(a => {
                const u = USERS.find(x => x.id === a.userId);
                return (
                  <tr key={a.id}>
                    <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {format(new Date(a.timestamp), 'MMM d, yyyy · HH:mm')}
                    </td>
                    <td>
                      <span className="badge badge-primary" style={{ fontSize: 10 }}>{a.action}</span>
                    </td>
                    <td style={{ fontSize: 13 }}>{u?.avatar || '👤'} {u?.name || a.userId}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.detail}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'roles' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px' }}>
            Tick the pages each role may open, then press <strong>Save permissions</strong>. Staff get the new permissions the next time they sign in.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {Object.entries(ROLES).map(([key, role]) => {
              const roleUsers = USERS.filter(u => u.role === key);
              const current = permDraft[key] || [];
              const changed = current.slice().sort().join() !== pagesOf(key).slice().sort().join();
              const since = permissionsChangedOn(key);
              return (
                <div key={key} className="card-elevated" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{role.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {roleUsers.length} staff member{roleUsers.length !== 1 ? 's' : ''} · {roleUsers.map(u => u.avatar).join(' ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input id={`role-active-${key}`} type="checkbox" checked={roleActive[key]} onChange={() => toggleRoleActive(key)} /> Active
                      </label>
                      <span className={`badge badge-${roleActive[key] ? role.color : 'gray'}`}>{roleActive[key] ? key : 'inactive'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginBottom: 12 }}>
                    {PAGE_PERMISSIONS.map(([perm, label]) => {
                      const locked = key === 'admin' && (perm === 'users' || perm === 'dashboard');
                      return (
                        <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)', cursor: locked ? 'not-allowed' : 'pointer' }}>
                          <input
                            id={`perm-${key}-${perm}`}
                            type="checkbox"
                            checked={current.includes(perm)}
                            disabled={locked}
                            onChange={() => togglePerm(key, perm)}
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <button id={`perm-save-${key}`} className="btn btn-primary btn-sm" disabled={!changed} onClick={() => savePerms(key)}>
                      Save permissions
                    </button>
                    {since && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Last granted {since}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modal && (
        <UserModal
          user={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSaveUser}
          saving={saving}
        />
      )}
    </div>
  );
}
