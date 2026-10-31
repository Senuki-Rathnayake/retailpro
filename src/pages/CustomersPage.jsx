import { useState } from 'react';
import { Search, Plus, Edit2, Phone, Mail, MapPin, CreditCard, History, Trash2, ShieldCheck } from 'lucide-react';
import { CUSTOMERS, SALES_ORDERS, SERVICE_JOBS, RETURNS, COMPLAINTS, CREDIT_REQUESTS, fmt, newCustId, newCreditReqId, isValidPhone, isValidEmail, today } from '../data/store';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

function CustomerModal({ customer, onClose, onSave, saving = false, canSetLimit = true }) {
  const [form, setForm] = useState(customer || { name:'', phone:'', email:'', address:'', customerType:'individual', creditLimit: canSetLimit ? 50000 : 0, creditRequest:false, requestedLimit:100000 });
  const badPhone = form.phone && !isValidPhone(form.phone.replace(/\s/g, ''));
  const badEmail = form.email && !isValidEmail(form.email);
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span style={{ fontSize:20 }}>{customer ? '✏️' : '➕'}</span>
          <div className="modal-title">{customer ? 'Edit Customer' : 'New Customer'}</div>
        </div>
        <div className="modal-body">
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Customer name" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input id="cust-phone" className="form-input" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="077XXXXXXX" />
              {badPhone && <div style={{ fontSize:11, color:'var(--danger-400)' }}>Use 10 digits starting with 0, or +94 and 9 digits</div>}
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input id="cust-email" className="form-input" type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="email@example.com" />
              {badEmail && <div style={{ fontSize:11, color:'var(--danger-400)' }}>E-mail format is not valid</div>}
            </div>
            {canSetLimit ? (
              <div className="form-group">
                <label className="form-label">Credit Limit (LKR)</label>
                <input className="form-input" type="number" value={form.creditLimit} onChange={e=>set('creditLimit',+e.target.value)} />
              </div>
            ) : !customer ? (
              <div className="form-group">
                <label className="form-label" style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input id="cust-credit-request" type="checkbox" checked={form.creditRequest} onChange={e=>set('creditRequest',e.target.checked)} /> Request a credit account
                </label>
                {form.creditRequest && <input id="cust-requested-limit" className="form-input" type="number" min={0} value={form.requestedLimit} onChange={e=>set('requestedLimit',+e.target.value)} placeholder="Requested limit (LKR)" />}
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>Finance approves credit limits</div>
              </div>
            ) : (
              <div className="form-group"><label className="form-label">Credit Limit</label><div style={{ fontSize:13 }}>{fmt(form.creditLimit)} (set by Finance)</div></div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Customer Type</label>
            <select id="cust-type" className="form-select" value={form.customerType || 'individual'} onChange={e=>set('customerType',e.target.value)}>
              <option value="individual">Individual</option>
              <option value="business">Business</option>
              <option value="government">Government / Institution</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea className="form-textarea" value={form.address} onChange={e=>set('address',e.target.value)} rows={2} placeholder="Street, City" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button id="btn-save-customer" className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.name || !form.phone || saving}>
            {saving ? 'Saving…' : customer ? 'Save Changes' : 'Create Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const toast = useToast();
  const { user, canDo } = useAuth();
  const [customers, setCustomers] = useState(() => [...CUSTOMERS]);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | customer obj
  const [detail, setDetail] = useState(null);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    c.phone.includes(q) ||
    c.email?.toLowerCase().includes(q.toLowerCase())
  );

  const saving = false;
  const syncGlobal = (list) => { CUSTOMERS.splice(0, CUSTOMERS.length, ...list); };

  // SD 25: phone and e-mail are checked before saving; a credit request goes to Finance
  const raiseCredit = (c, form) => {
    if (modal !== 'new' || !form.creditRequest || !(form.requestedLimit > 0)) return '';
    CREDIT_REQUESTS.push({ id: newCreditReqId(), customerId: c.id, currentLimit: c.creditLimit || 0, requestedLimit: form.requestedLimit,
      requestDate: today(), status: 'pending', note: 'Requested at registration', requestedBy: user?.id });
    return ' – credit request sent to Finance';
  };
  const handleSave = async (input) => {
    const { creditRequest, requestedLimit, ...form } = input;
    form.phone = (form.phone || '').replace(/\s/g, '');
    if (!isValidPhone(form.phone) || (form.email && !isValidEmail(form.email))) { toast.error('Invalid phone number or e-mail'); return; }
    if (modal === 'new' && customers.some(c => c.phone === form.phone)) { toast.error('A customer with this phone number already exists'); return; }
    const req = { creditRequest, requestedLimit };
    if (modal === 'new') {
      const newC = { ...form, id: newCustId(), creditLimit: form.creditLimit || 0, creditUsed:0, balance:0, createdAt: new Date().toISOString().slice(0,10) };
      if (newC.creditLimit > 0) { newC.creditApprovedBy = user?.id; newC.creditReviewDate = today(); }   // credit_account.user_id / last_review_date
      setCustomers(cs => [...cs, newC]);
      CUSTOMERS.push(newC);
      toast.success(`New customer registered – ${newC.id}${raiseCredit(newC, req)}`);
    } else {
      if (Number(form.creditLimit) !== Number(modal.creditLimit)) { form.creditApprovedBy = user?.id; form.creditReviewDate = today(); }
      setCustomers(cs => cs.map(c => c.id === modal.id ? { ...c, ...form } : c));
      const i = CUSTOMERS.findIndex(c => c.id === modal.id);
      if (i !== -1) CUSTOMERS[i] = { ...CUSTOMERS[i], ...form };
      toast.success('Customer updated');
    }
    setModal(null);
  };

  const handleDelete = async (c) => {
    if (!confirm(`Are you sure you want to delete customer ${c.name}?`)) return;
    // a customer with sales, jobs, returns or complaints is kept (the database links them)
    const used = SALES_ORDERS.some(o => o.customerId === c.id) || SERVICE_JOBS.some(j => j.customerId === c.id) ||
      RETURNS.some(r => r.customerId === c.id) || COMPLAINTS.some(x => x.customerId === c.id);
    if (used) { toast.error('This customer has sales or other records, so it cannot be deleted.'); return; }
    const list = customers.filter(x => x.id !== c.id);
    syncGlobal(list);
    setCustomers(list);
    toast.success(`Customer ${c.name} deleted`);
    if (detail?.id === c.id) setDetail(null);
  };

  const customerOrders = (id) => SALES_ORDERS.filter(o => o.customerId === id);

  const availableCredit = (c) => c.creditLimit - c.creditUsed;
  const creditPct = (c) => c.creditLimit > 0 ? Math.min(100, (c.creditUsed / c.creditLimit)*100) : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers.length} registered customers</p>
        </div>
        <div className="page-header-actions">
          {canDo('customer.add') && (
            <button id="btn-new-customer" className="btn btn-primary" onClick={() => setModal('new')}>
              <Plus size={15} /> New Customer
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        <div className="search-bar" style={{ flex:1 }}>
          <Search size={16} color="var(--text-muted)" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name, phone, or email…" />
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th>Credit Limit</th>
              <th>Credit Used</th>
              <th>Available</th>
              <th>Balance Owed</th>
              <th>Orders</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-icon">👥</div><div className="empty-state-title">No customers found</div></div></td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight:600, color:'var(--text-primary)' }}>{c.name}</div>
                  <div style={{ fontSize:11.5, color:'var(--text-muted)' }}>{c.id}</div>
                </td>
                <td>
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:13 }}><Phone size={12}/> {c.phone}</span>
                    {c.email && <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text-muted)' }}><Mail size={11}/> {c.email}</span>}
                  </div>
                </td>
                <td><span style={{ fontFamily:'var(--font-mono)', fontSize:13 }}>{fmt(c.creditLimit)}</span></td>
                <td>
                  <div>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:13, color: c.creditUsed > 0 ? 'var(--warning-400)':'var(--text-secondary)' }}>{fmt(c.creditUsed)}</span>
                    {c.creditLimit > 0 && (
                      <div style={{ marginTop:3, height:4, background:'var(--bg-overlay)', borderRadius:4, width:80 }}>
                        <div style={{ height:'100%', borderRadius:4, width:`${creditPct(c)}%`, background: creditPct(c)>80?'var(--danger-500)':creditPct(c)>50?'var(--warning-500)':'var(--success-500)', transition:'width .3s' }} />
                      </div>
                    )}
                  </div>
                </td>
                <td><span style={{ fontFamily:'var(--font-mono)', fontSize:13, color:'var(--success-400)' }}>{fmt(availableCredit(c))}</span></td>
                <td><span style={{ fontFamily:'var(--font-mono)', fontSize:13, color: c.balance>0?'var(--danger-400)':'var(--text-secondary)' }}>{fmt(c.balance)}</span></td>
                <td>
                  <span className="badge badge-primary">{customerOrders(c.id).length}</span>
                </td>
                <td>
                  <div className="table-action-cell">
                    <button className="btn btn-ghost btn-sm btn-icon" title="View Details" onClick={() => setDetail(c)}>
                      <History size={14} />
                    </button>
                    {canDo('customer.edit') && <button className="btn btn-ghost btn-sm btn-icon" title="Edit Customer" onClick={() => setModal(c)}>
                      <Edit2 size={14} />
                    </button>}
                    {canDo('customer.delete') && <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger-400)' }} title="Delete Customer" onClick={() => handleDelete(c)}>
                      <Trash2 size={14} />
                    </button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && <CustomerModal customer={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={handleSave} saving={saving} canSetLimit={canDo('credit.approve') || user?.role === 'admin'} />}

      {/* Detail Drawer */}
      {detail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span style={{ fontSize:22 }}>👤</span>
              <div className="modal-title">{detail.name}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row-2">
                <div className="card-elevated" style={{ padding:16 }}>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8, fontWeight:700, textTransform:'uppercase', letterSpacing:.5 }}>Contact Info</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:13 }}>
                    <span style={{ display:'flex', gap:8, alignItems:'center', color:'var(--text-secondary)' }}><Phone size={13}/>{detail.phone}</span>
                    <span style={{ display:'flex', gap:8, alignItems:'center', color:'var(--text-secondary)' }}><Mail size={13}/>{detail.email}</span>
                    <span style={{ display:'flex', gap:8, alignItems:'center', color:'var(--text-secondary)' }}><MapPin size={13}/>{detail.address}</span>
                    <span style={{ color:'var(--text-secondary)', textTransform:'capitalize' }}>Type: {detail.customerType || 'individual'}{detail.createdAt ? ` · registered ${detail.createdAt}` : ''}</span>
                  </div>
                </div>
                <div className="card-elevated" style={{ padding:16 }}>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8, fontWeight:700, textTransform:'uppercase', letterSpacing:.5 }}>Credit Account</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4, fontSize:13 }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}><span className="text-muted">Limit</span><span style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{fmt(detail.creditLimit)}</span></div>
                    <div style={{ display:'flex', justifyContent:'space-between' }}><span className="text-muted">Used</span><span style={{ fontFamily:'var(--font-mono)', color:'var(--warning-400)' }}>{fmt(detail.creditUsed)}</span></div>
                    <div style={{ display:'flex', justifyContent:'space-between' }}><span className="text-muted">Available</span><span style={{ fontFamily:'var(--font-mono)', color:'var(--success-400)' }}>{fmt(detail.creditLimit - detail.creditUsed)}</span></div>
                    <div style={{ display:'flex', justifyContent:'space-between' }}><span className="text-muted">Balance Owed</span><span style={{ fontFamily:'var(--font-mono)', color: detail.balance>0?'var(--danger-400)':'var(--text-secondary)' }}>{fmt(detail.balance)}</span></div>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:12 }}>Purchase History</div>
                <div className="table-container">
                  <table className="table">
                    <thead><tr><th>Invoice</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
                    <tbody>
                      {customerOrders(detail.id).length === 0 && (
                        <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--text-muted)', padding:20 }}>No orders yet</td></tr>
                      )}
                      {customerOrders(detail.id).map(o => (
                        <tr key={o.id}>
                          <td><span style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{o.invoiceNo}</span></td>
                          <td>{o.date}</td>
                          <td><span style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{fmt(o.grandTotal)}</span></td>
                          <td>
                            <span className={`badge badge-${o.paymentStatus==='paid'?'success':o.paymentStatus==='partial'?'warning':'danger'}`}>
                              {o.paymentStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDetail(null)}>Close</button>
              {canDo('customer.edit') && (
                <button className="btn btn-primary" onClick={() => { setModal(detail); setDetail(null); }}>
                  <Edit2 size={14} /> Edit Customer
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
