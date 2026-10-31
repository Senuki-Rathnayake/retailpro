import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, CreditCard, DollarSign, Clock, CheckCircle, Send, AlertTriangle } from 'lucide-react';
import {
  PAYMENTS, SUPPLIER_PAYMENTS, SALES_ORDERS, CUSTOMERS, SUPPLIERS, PURCHASE_ORDERS,
  fmt, newPayId, getCustomer, getSupplier, getSalesOrder, RECONCILIATIONS, getAllTransactions,
  CREDIT_REQUESTS, SERVICE_JOBS, APP_SETTINGS, today, newSupplierPayId, newReconId, newestFirst } from '../data/store';
import { differenceInDays } from 'date-fns';

// SD 50: how many days an unpaid invoice has been open
const ageOf = (date) => Math.max(0, differenceInDays(new Date(), new Date(date)));
const bucketOf = (days) => (days <= 30 ? '0–30 days' : days <= 60 ? '31–60 days' : 'Over 60 days');
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

function PaymentModal({ type, onClose, onSave }) {
  const [form, setForm] = useState({ customerId:'', salesOrderId:'', amount:0, method:'cash', note:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const orders = form.customerId ? SALES_ORDERS.filter(o=>o.customerId===form.customerId && o.paymentStatus !== 'paid') : [];

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <CreditCard size={18} color="var(--success-400)" />
          <div className="modal-title">Record Customer Payment</div>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Customer *</label>
            <select className="form-select" value={form.customerId} onChange={e=>set('customerId',e.target.value)}>
              <option value="">Select customer…</option>
              {CUSTOMERS.map(c=><option key={c.id} value={c.id}>{c.name} (Balance: {fmt(c.balance)})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Sales Order</label>
            <select className="form-select" value={form.salesOrderId} onChange={e=>set('salesOrderId',e.target.value)}>
              <option value="">Select order…</option>
              {orders.map(o=><option key={o.id} value={o.id}>{o.invoiceNo} — Balance: {fmt(o.balance)}</option>)}
            </select>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Amount (LKR) *</label>
              <input type="number" className="form-input" value={form.amount} onChange={e=>set('amount',+e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Method</label>
              <select className="form-select" value={form.method} onChange={e=>set('method',e.target.value)}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Note</label>
            <input className="form-input" value={form.note} onChange={e=>set('note',e.target.value)} placeholder="Optional reference or note" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" disabled={!form.customerId||form.amount<=0} onClick={()=>onSave(form)}>
            <CheckCircle size={14}/> Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const toast = useToast();
  const { user, canDo } = useAuth();
  const [payments, setPayments] = useState(() => [...PAYMENTS]);
  const [supplierPayments, setSupplierPayments] = useState(() => [...SUPPLIER_PAYMENTS]);
  const [activeTab, setActiveTab] = useState('customer');
  const [modal, setModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // Open the right tab for the menu item that brought the user here
  useEffect(() => {
    setActiveTab(location.pathname === '/payables' ? 'payables' : 'customer');
  }, [location.pathname]);
  // Buttons elsewhere can ask this page to open a form / tab / filter; apply it once, then clear it
  useEffect(() => {
    if (!location.state) return;
    if (location.state?.tab) setActiveTab(location.state.tab);
    if (location.state?.open === 'new' && canDo('payment.record')) setModal(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const [q, setQ] = useState('');
  const [, bump] = useState(0);
  const [txFrom, setTxFrom] = useState('');
  const [txTo, setTxTo] = useState('');
  const [txType, setTxType] = useState('all');
  const [txOpen, setTxOpen] = useState(null);      // SD 49 source record of a transaction
  const [payForm, setPayForm] = useState({});      // SD 46 supplier payment amount / method per PO
  const supPaidSoFar = (poId) => SUPPLIER_PAYMENTS.filter(sp => sp.purchaseOrderId === poId && sp.date).reduce((a, sp) => a + sp.amount, 0);

  // SD 46 Manage supplier payments: amount + method, part payments allowed
  const paySupplier = (po) => {
    const f = payForm[po.id] || {};
    const balance = po.grandTotal - supPaidSoFar(po.id);
    const amount = Number(f.amount ?? balance);
    if (!(amount > 0)) { toast.error('Enter the amount to pay'); return; }
    if (amount > balance) { toast.error('Amount cannot exceed the balance due'); return; }
    const placeholder = SUPPLIER_PAYMENTS.find(x => x.purchaseOrderId === po.id && !x.date);
    const rec = { supplierId: po.supplierId, purchaseOrderId: po.id, amount, method: f.method || 'transfer', date: today(), recordedBy: user?.id, note: amount === balance ? `${po.id} settled` : `${po.id} part payment`, status: 'paid' };
    if (placeholder) Object.assign(placeholder, rec); else SUPPLIER_PAYMENTS.push({ id: newSupplierPayId(), ...rec });
    const left = balance - amount;
    if (left <= 0) { const i = PURCHASE_ORDERS.findIndex(o => o.id === po.id); if (i !== -1) PURCHASE_ORDERS[i].payableStatus = 'paid'; }
    setSupplierPayments([...SUPPLIER_PAYMENTS]);
    setPayForm(pf => ({ ...pf, [po.id]: {} }));
    toast.success(left > 0 ? `Supplier payment recorded – balance ${fmt(left)}` : `Supplier payment recorded – ${po.id} fully paid`);
  };

  // SD 48 Approve credit limits: payment history and approval authority are checked
  // the Actions column of the credit requests shows only when a request can be decided by this role
  const creditActions = CREDIT_REQUESTS.some(r => (r.status === 'pending' && canDo('credit.approve')) || (r.status === 'escalated' && canDo('credit.approveEscalated')));
  const decideCredit = (r, approve) => {
    const c = CUSTOMERS.find(x => x.id === r.customerId);
    if (!approve) { r.status = 'rejected'; r.decidedBy = user?.id; toast.success(`Credit request ${r.id} rejected`); bump(n => n + 1); return; }
    const late = SALES_ORDERS.filter(o => o.customerId === r.customerId && o.paymentStatus !== 'paid' && (o.flaggedOverdue || ageOf(o.date) > 60));
    if (late.length) { r.status = 'rejected'; r.reason = 'Poor payment history'; toast.error(`Request rejected – poor payment history (${late.length} overdue invoice${late.length > 1 ? 's' : ''})`); bump(n => n + 1); return; }
    if (r.requestedLimit > APP_SETTINGS.creditApprovalLimit && !canDo('credit.approveEscalated')) {
      r.status = 'escalated'; r.escalatedBy = user?.id;
      toast.warning(`Request exceeds your authority (${fmt(APP_SETTINGS.creditApprovalLimit)}) – escalated to Admin`); bump(n => n + 1); return;
    }
    if (c) { c.creditLimit = r.requestedLimit; c.creditApprovedBy = user?.id; c.creditReviewDate = today(); }   // credit_account.user_id / last_review_date
    r.status = 'approved'; r.decidedBy = user?.id; r.decidedAt = today();
    toast.success(`Credit limit approved – ${c?.name} now ${fmt(r.requestedLimit)}`);
    bump(n => n + 1);
  };

  const totalReceived = payments.reduce((s,p)=>s+p.amount,0);
  const totalPaid = supplierPayments.reduce((s,p)=>s+p.amount,0);
  const outstandingInvoices = SALES_ORDERS.filter(o=>o.paymentStatus!=='paid');
  const totalOutstanding = outstandingInvoices.reduce((s,o)=>s+o.balance,0);

  const handlePayment = (form) => {
    const today = format(new Date(),'yyyy-MM-dd');
    const payment = { id: newPayId(), ...form, date: today, recordedBy: user?.id };
    PAYMENTS.push(payment);
    setPayments(ps => [...ps, payment]);

    // Update sales order
    if (form.salesOrderId) {
      const so = SALES_ORDERS.find(o=>o.id===form.salesOrderId);
      if (so) {
        so.amountPaid = (so.amountPaid||0) + form.amount;
        so.balance = Math.max(0, so.balance - form.amount);
        if (so.balance <= 0) { so.paymentStatus = 'paid'; }
        // Update customer credit
        const ci = CUSTOMERS.findIndex(c=>c.id===form.customerId);
        if (ci !== -1) { CUSTOMERS[ci].creditUsed = Math.max(0, CUSTOMERS[ci].creditUsed - form.amount); }
      }
    }

    toast.success(`Payment of ${fmt(form.amount)} recorded`);
    setModal(false);
  };

  const filteredPayments = payments.filter(p => {
    const c = getCustomer(p.customerId);
    return !q || c?.name.toLowerCase().includes(q.toLowerCase()) || p.id.includes(q);
  });

  const filteredPayables = PURCHASE_ORDERS.filter(po => {
    const s = getSupplier(po.supplierId);
    return po.payableStatus === 'pending' && (!q || s?.name.toLowerCase().includes(q.toLowerCase()) || po.id.includes(q));
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{activeTab === 'payables' ? 'Supplier Payables' : 'Payments & Finance'}</h1>
          <p className="page-subtitle">Track receipts, outstanding balances, and payables</p>
        </div>
        <div className="page-header-actions">
          {canDo('payment.record') && (<button id="btn-record-payment" className="btn btn-primary" onClick={() => setModal(true)}>
            <Plus size={14}/> Record Payment
          </button>)}
        </div>
      </div>

      {/* KPI */}
      <div className="stat-grid" style={{ gridTemplateColumns:'repeat(3,1fr)', marginBottom:20 }}>
        <div className="stat-card success">
          <div className="stat-card-header"><span className="stat-card-label">Total Received</span><div className="stat-card-icon success"><DollarSign size={16}/></div></div>
          <div className="stat-card-value">{fmt(totalReceived)}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-card-header"><span className="stat-card-label">Outstanding</span><div className="stat-card-icon warning"><Clock size={16}/></div></div>
          <div className="stat-card-value">{fmt(totalOutstanding)}</div>
          <div className="stat-card-change down">{outstandingInvoices.length} invoices</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-card-header"><span className="stat-card-label">Supplier Payables</span><div className="stat-card-icon danger"><CreditCard size={16}/></div></div>
          <div className="stat-card-value">{fmt(PURCHASE_ORDERS.filter(p=>p.payableStatus==='pending').reduce((s,p)=>s+p.grandTotal,0))}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'center' }}>
        <div className="tabs">
          <button className={`tab-btn ${activeTab==='customer'?'active':''}`} onClick={()=>setActiveTab('customer')}>💳 Customer Payments</button>
          <button className={`tab-btn ${activeTab==='outstanding'?'active':''}`} onClick={()=>setActiveTab('outstanding')}>⏰ Outstanding</button>
          <button className={`tab-btn ${activeTab==='payables'?'active':''}`} onClick={()=>setActiveTab('payables')}>🏭 Supplier Payables</button>
          <button id="tab-transactions" className={`tab-btn ${activeTab==='transactions'?'active':''}`} onClick={()=>setActiveTab('transactions')}>📒 All Transactions</button>
          <button id="tab-reconcile" className={`tab-btn ${activeTab==='reconcile'?'active':''}`} onClick={()=>setActiveTab('reconcile')}>⚖️ Reconcile</button>
          {(canDo('credit.approve') || canDo('credit.approveEscalated')) && <button id="tab-credit" className={`tab-btn ${activeTab==='credit'?'active':''}`} onClick={()=>setActiveTab('credit')}>🧾 Credit Requests ({CREDIT_REQUESTS.filter(r => ['pending','escalated'].includes(r.status)).length})</button>}
        </div>
        <div className="search-bar" style={{ marginLeft:'auto' }}>
          <Search size={14} color="var(--text-muted)"/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…" style={{ width:200 }} />
        </div>
      </div>

      {activeTab === 'transactions' && (() => {
        const rangeOk = (!txFrom && !txTo) || (txFrom && txTo && txFrom <= txTo && txTo <= today());
        const rows = getAllTransactions().filter(t => (!q || `${t.id} ${t.party} ${t.ref} ${t.kind}`.toLowerCase().includes(q.toLowerCase())) &&
          (txType === 'all' || t.kind === txType) && (!rangeOk || !txFrom || (t.date >= txFrom && t.date <= txTo)));
        const inTotal = rows.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0);
        const outTotal = rows.filter(t => t.amount < 0).reduce((a, t) => a - t.amount, 0);
        return (
          <div>
            <div style={{ display:'flex', gap:10, alignItems:'center', fontSize:13, marginBottom:10, flexWrap:'wrap' }}>
              <label>From <input id="tx-from" type="date" className="form-input" style={{ width:150, display:'inline-block' }} value={txFrom} onChange={e=>setTxFrom(e.target.value)} /></label>
              <label>To <input id="tx-to" type="date" className="form-input" style={{ width:150, display:'inline-block' }} value={txTo} onChange={e=>setTxTo(e.target.value)} /></label>
              <select id="tx-type" className="form-select" style={{ width:180 }} value={txType} onChange={e=>setTxType(e.target.value)}>
                <option value="all">All types</option><option>Customer payment</option><option>Supplier payment</option><option>Service fee</option><option>Refund</option>
              </select>
              {(txFrom || txTo || txType !== 'all') && <button className="btn btn-ghost btn-sm" onClick={() => { setTxFrom(''); setTxTo(''); setTxType('all'); }}>Clear</button>}
            </div>
            {!rangeOk && <div id="tx-range-error" className="alert alert-danger" style={{ marginBottom:10 }}>Please select a valid date range</div>}
            {rangeOk && rows.length === 0 && <div id="tx-empty" className="alert alert-info" style={{ marginBottom:10 }}>No transactions for this filter</div>}
            <div style={{ display:'flex', gap:16, fontSize:13, marginBottom:10, flexWrap:'wrap' }}>
              <span>Money in: <strong style={{ color:'var(--success-400)', fontFamily:'var(--font-mono)' }}>{fmt(inTotal)}</strong></span>
              <span>Money out: <strong style={{ color:'var(--danger-400)', fontFamily:'var(--font-mono)' }}>{fmt(outTotal)}</strong></span>
              <span>Net: <strong style={{ fontFamily:'var(--font-mono)' }}>{fmt(inTotal - outTotal)}</strong></span>
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Date</th><th>Transaction</th><th>Type</th><th>Customer / Supplier</th><th>Reference</th><th>Method</th><th>Amount</th></tr></thead>
                <tbody>
                  {rows.map(t => (
                    <tr key={t.id} id={`tx-${t.id}`} style={{ cursor:'pointer' }} onClick={() => setTxOpen(t)} title="Open the source record">
                      <td style={{ fontSize:12 }}>{t.date}</td>
                      <td style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{t.id}</td>
                      <td><span className={`badge badge-${t.amount >= 0 ? 'success' : 'danger'}`}>{t.kind}</span></td>
                      <td>{t.party}</td>
                      <td style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{t.ref}</td>
                      <td style={{ fontSize:12, textTransform:'capitalize' }}>{t.method}</td>
                      <td style={{ fontFamily:'var(--font-mono)', fontWeight:700, color: t.amount >= 0 ? 'var(--success-400)' : 'var(--danger-400)' }}>{t.amount >= 0 ? '+' : '−'}{fmt(Math.abs(t.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {txOpen && (() => {
        const so = SALES_ORDERS.find(o => o.id === txOpen.ref);
        const po = PURCHASE_ORDERS.find(o => o.id === txOpen.ref);
        const job = SERVICE_JOBS.find(j => j.id === txOpen.ref);
        return (
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setTxOpen(null)}>
            <div className="modal" id="tx-detail">
              <div className="modal-header"><span style={{ fontSize:20 }}>📄</span><div className="modal-title">{txOpen.kind} {txOpen.id}</div>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto' }} onClick={() => setTxOpen(null)}>✕</button></div>
              <div className="modal-body" style={{ fontSize:13, display:'flex', flexDirection:'column', gap:6 }}>
                <div>Date: {txOpen.date} · Method: {txOpen.method} · Amount: <b>{fmt(Math.abs(txOpen.amount))}</b></div>
                <div>Customer / supplier: {txOpen.party}</div>
                {so && <><div style={{ fontWeight:700, marginTop:8 }}>Invoice {so.invoiceNo || so.id}</div>
                  {so.items.map((it, i) => <div key={i}>{it.name} × {it.qty} – {fmt(it.total)}</div>)}
                  <div>Total {fmt(so.grandTotal)} · Paid {fmt(so.amountPaid)} · Balance {fmt(so.balance)} · {so.paymentStatus}</div></>}
                {po && <><div style={{ fontWeight:700, marginTop:8 }}>Purchase order {po.id} – payable {po.payableStatus}</div>
                  {po.items.map((it, i) => <div key={i}>{it.name} × {it.qty} – {fmt(it.total)}</div>)}
                  <div>Total {fmt(po.grandTotal)} · Paid so far {fmt(supPaidSoFar(po.id))}</div></>}
                {job && <><div style={{ fontWeight:700, marginTop:8 }}>Service job {job.id}</div><div>{job.type} – {job.description}</div><div>Fee {fmt(job.serviceFee)} · {job.billingStatus}</div></>}
                {!so && !po && !job && <div>No source record linked.</div>}
              </div>
            </div>
          </div>
        );
      })()}

      {activeTab === 'credit' && (
        <div className="table-container" id="credit-requests">
          <table className="table">
            <thead><tr><th>Request</th><th>Customer</th><th>Current limit</th><th>Requested</th><th>Unpaid invoices</th><th>Date</th><th>Status</th>{creditActions && <th>Actions</th>}</tr></thead>
            <tbody>
              {CREDIT_REQUESTS.length === 0 && <tr><td colSpan={creditActions ? 8 : 7}><div className="empty-state-title">No credit requests</div></td></tr>}
              {newestFirst(CREDIT_REQUESTS, 'requestDate').map(r => {
                const c = getCustomer(r.customerId);
                const unpaid = SALES_ORDERS.filter(o => o.customerId === r.customerId && o.paymentStatus !== 'paid');
                const canAct = (r.status === 'pending' && canDo('credit.approve')) || (r.status === 'escalated' && canDo('credit.approveEscalated'));
                return (
                  <tr key={r.id}>
                    <td style={{ fontFamily:'var(--font-mono)' }}>{r.id}</td><td>{c?.name}<div style={{ fontSize:11, color:'var(--text-muted)' }}>{r.note}</div></td>
                    <td>{fmt(r.currentLimit)}</td><td style={{ fontWeight:700 }}>{fmt(r.requestedLimit)}</td>
                    <td>{unpaid.length ? `${unpaid.length} (${fmt(unpaid.reduce((a, o) => a + o.balance, 0))})` : 'none'}</td>
                    <td style={{ fontSize:12 }}>{r.requestDate}</td>
                    <td><span className={`badge badge-${r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}`}>{r.status}</span>{r.reason && <div style={{ fontSize:11 }}>{r.reason}</div>}</td>
                    {creditActions && <td>{canAct && <div className="table-action-cell">
                      <button id={`credit-approve-${r.id}`} className="btn btn-success btn-sm" onClick={() => decideCredit(r, true)}>Approve</button>
                      <button id={`credit-reject-${r.id}`} className="btn btn-danger btn-sm" onClick={() => decideCredit(r, false)}>Reject</button>
                    </div>}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'reconcile' && (() => {
        const paidFor = (soId) => PAYMENTS.filter(p => p.salesOrderId === soId && !p.note?.startsWith('Refund')).reduce((a, p) => a + p.amount, 0);
        const sales = SALES_ORDERS.map(o => ({ o, received: paidFor(o.id), ok: paidFor(o.id) === (o.amountPaid || 0) }));
        const supPaid = (poId) => SUPPLIER_PAYMENTS.filter(sp => sp.purchaseOrderId === poId && sp.date).reduce((a, sp) => a + sp.amount, 0);
        const purchases = PURCHASE_ORDERS.filter(po => po.status === 'received').map(po => {
          const paid = supPaid(po.id);
          const ok = po.payableStatus === 'paid' ? paid === po.grandTotal : paid < po.grandTotal;
          return { po, paid, ok };
        });
        const issues = sales.filter(r => !r.ok).length + purchases.filter(r => !r.ok).length;
        const last = RECONCILIATIONS[RECONCILIATIONS.length - 1];
        return (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className={`alert alert-${issues ? 'warning' : 'success'}`} style={{ fontSize:13, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <span>{issues ? `${issues} record(s) do not match. Check them before reconciling.` : 'All sales and purchase payments match their orders.'}</span>
              {last && <span style={{ color:'var(--text-muted)' }}>Last reconciled {last.date} ({last.result})</span>}
              {canDo('payment.reconcile') && (
                <button id="btn-reconcile" className="btn btn-primary btn-sm" style={{ marginLeft:'auto' }} onClick={() => {
                  RECONCILIATIONS.push({ id:newReconId(), date: format(new Date(),'yyyy-MM-dd'), userId: user?.id, result: issues ? `${issues} mismatch(es)` : 'balanced' });
                  toast.success(issues ? `Reconciliation saved with ${issues} mismatch(es)` : 'Sales and purchases reconciled');
                  bump(n => n + 1);
                }}>Mark Reconciled</button>
              )}
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Invoice</th><th>Customer</th><th>Invoice total</th><th>Recorded paid</th><th>Payments received</th><th>Result</th></tr></thead>
                <tbody>
                  {sales.map(({ o, received, ok }) => (
                    <tr key={o.id}>
                      <td style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{o.invoiceNo}</td>
                      <td>{getCustomer(o.customerId)?.name}</td>
                      <td style={{ fontFamily:'var(--font-mono)' }}>{fmt(o.grandTotal)}</td>
                      <td style={{ fontFamily:'var(--font-mono)' }}>{fmt(o.amountPaid || 0)}</td>
                      <td style={{ fontFamily:'var(--font-mono)' }}>{fmt(received)}</td>
                      <td><span className={`badge badge-${ok ? 'success' : 'danger'}`}>{ok ? 'Match' : 'Mismatch'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Purchase order</th><th>Supplier</th><th>Order total</th><th>Payable</th><th>Supplier payments</th><th>Result</th></tr></thead>
                <tbody>
                  {purchases.map(({ po, paid, ok }) => (
                    <tr key={po.id}>
                      <td style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{po.id}</td>
                      <td>{getSupplier(po.supplierId)?.name}</td>
                      <td style={{ fontFamily:'var(--font-mono)' }}>{fmt(po.grandTotal)}</td>
                      <td><span className={`badge badge-${po.payableStatus === 'paid' ? 'success' : 'warning'}`}>{po.payableStatus}</span></td>
                      <td style={{ fontFamily:'var(--font-mono)' }}>{fmt(paid)}</td>
                      <td><span className={`badge badge-${ok ? 'success' : 'danger'}`}>{ok ? 'Match' : 'Mismatch'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {activeTab === 'customer' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Payment ID</th><th>Customer</th><th>Order</th><th>Amount</th><th>Method</th><th>Date</th><th>Note</th></tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-icon">💳</div><div className="empty-state-title">No payments</div></div></td></tr>
              )}
              {newestFirst(filteredPayments).map(p => {
                const c = getCustomer(p.customerId);
                return (
                  <tr key={p.id}>
                    <td><span style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{p.id}</span></td>
                    <td style={{ fontWeight:600 }}>{c?.name || 'Walk-in'}</td>
                    <td><span style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{p.salesOrderId || '—'}</span></td>
                    <td><span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--success-400)' }}>{fmt(p.amount)}</span></td>
                    <td><span className="badge badge-gray">{p.method}</span></td>
                    <td style={{ fontSize:12 }}>{p.date}</td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{p.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'outstanding' && outstandingInvoices.length > 0 && (
        <div id="dues-ageing" style={{ display:'flex', gap:12, marginBottom:12, flexWrap:'wrap' }}>
          {['0–30 days', '31–60 days', 'Over 60 days'].map(b => {
            const inB = outstandingInvoices.filter(o => bucketOf(ageOf(o.date)) === b);
            return (
              <div key={b} className="card-elevated" style={{ padding:'10px 16px', minWidth:170 }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase' }}>{b}</div>
                <div style={{ fontWeight:800, fontFamily:'var(--font-mono)', color: b === 'Over 60 days' ? 'var(--danger-400)' : b === '31–60 days' ? 'var(--warning-400)' : 'inherit' }}>{fmt(inB.reduce((a, o) => a + o.balance, 0))}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>{inB.length} invoice{inB.length !== 1 ? 's' : ''}</div>
              </div>
            );
          })}
        </div>
      )}
      {activeTab === 'outstanding' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Paid</th><th>Balance</th><th>Date</th><th>Age</th><th>Status</th>{(canDo('payment.remind') || canDo('payment.flagOverdue')) && <th>Actions</th>}</tr>
            </thead>
            <tbody>
              {outstandingInvoices.length === 0 && (
                <tr><td colSpan={9}><div className="empty-state"><div className="empty-state-icon">✅</div><div id="all-up-to-date" className="empty-state-title">All payments are up to date</div></div></td></tr>
              )}
              {newestFirst(outstandingInvoices).map(o => {
                const c = getCustomer(o.customerId);
                return (
                  <tr key={o.id}>
                    <td><span style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{o.invoiceNo}</span></td>
                    <td style={{ fontWeight:600 }}>{c?.name}</td>
                    <td><span style={{ fontFamily:'var(--font-mono)' }}>{fmt(o.grandTotal)}</span></td>
                    <td><span style={{ fontFamily:'var(--font-mono)', color:'var(--success-400)' }}>{fmt(o.amountPaid)}</span></td>
                    <td><span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--danger-400)' }}>{fmt(o.balance)}</span></td>
                    <td style={{ fontSize:12 }}>{o.date}</td>
                    <td><span className={`badge badge-${ageOf(o.date) > 60 ? 'danger' : ageOf(o.date) > 30 ? 'warning' : 'gray'}`}>{ageOf(o.date)} d · {bucketOf(ageOf(o.date))}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span className="badge badge-warning">{o.paymentStatus}</span>
                        {o.flaggedOverdue && <span className="badge badge-danger">Overdue</span>}
                      </div>
                    </td>
                    {(canDo('payment.remind') || canDo('payment.flagOverdue')) && <td>
                      <div className="table-action-cell">
                        {canDo('payment.remind') && <button
                          className="btn btn-outline btn-sm"
                          onClick={() => toast.success(`Payment reminder sent to ${c?.name} (${c?.phone || c?.email})`)}
                          title="Send Payment Reminder"
                        >
                          <Send size={12} /> Reminder
                        </button>}
                        {canDo('payment.flagOverdue') && <button
                          className={`btn btn-sm ${o.flaggedOverdue ? 'btn-danger' : 'btn-ghost'}`}
                          style={{ color: o.flaggedOverdue ? '#fff' : 'var(--danger-400)' }}
                          onClick={() => {
                            o.flaggedOverdue = !o.flaggedOverdue;
                            toast.warning(o.flaggedOverdue ? `Invoice ${o.invoiceNo} flagged as overdue` : `Overdue flag removed for ${o.invoiceNo}`);
                            setActiveTab('outstanding');
                          }}
                          title="Flag Overdue"
                        >
                          <AlertTriangle size={12} /> Flag Overdue
                        </button>}
                      </div>
                    </td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'payables' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>PO</th><th>Supplier</th><th>Amount</th><th>Paid / balance</th><th>Received Date</th><th>Due</th><th>Status</th></tr>
            </thead>
            <tbody>
              {PURCHASE_ORDERS.filter(po=>po.payableStatus==='pending').length === 0 && (
                <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-icon">✅</div><div className="empty-state-title">No pending payables</div></div></td></tr>
              )}
              {newestFirst(PURCHASE_ORDERS.filter(po=>po.payableStatus==='pending'), 'receivedDate').map(po => {
                const sup = getSupplier(po.supplierId);
                const supData = SUPPLIERS.find(s=>s.id===po.supplierId);
                const dueDate = po.receivedDate ? format(new Date(new Date(po.receivedDate).getTime() + (supData?.paymentTerms||30)*24*3600*1000),'yyyy-MM-dd') : '—';
                return (
                  <tr key={po.id}>
                    <td><span style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{po.id}</span></td>
                    <td style={{ fontWeight:600 }}>{sup?.name}</td>
                    <td><span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--danger-400)' }}>{fmt(po.grandTotal)}</span></td>
                    <td style={{ fontSize:12, fontFamily:'var(--font-mono)' }}>{fmt(supPaidSoFar(po.id))} / {fmt(po.grandTotal - supPaidSoFar(po.id))}</td>
                    <td style={{ fontSize:12 }}>{po.receivedDate || '—'}</td>
                    <td style={{ fontSize:12 }}>{dueDate}</td>
                    <td>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <span className="badge badge-warning">{supPaidSoFar(po.id) > 0 ? 'Part paid' : 'Pending'}</span>
                        {canDo('payable.pay') && (<>
                          <input id={`sp-amount-${po.id}`} type="number" min={0} className="form-input" style={{ width:120 }} placeholder="Amount"
                            value={payForm[po.id]?.amount ?? (po.grandTotal - supPaidSoFar(po.id))}
                            onChange={e => setPayForm(pf => ({ ...pf, [po.id]: { ...pf[po.id], amount: e.target.value } }))} />
                          <select id={`sp-method-${po.id}`} className="form-select" style={{ width:110 }} value={payForm[po.id]?.method || 'transfer'}
                            onChange={e => setPayForm(pf => ({ ...pf, [po.id]: { ...pf[po.id], method: e.target.value } }))}>
                            <option value="transfer">Transfer</option><option value="cheque">Cheque</option><option value="cash">Cash</option>
                          </select>
                          <button id={`sp-pay-${po.id}`} className="btn btn-success btn-sm" onClick={() => paySupplier(po)}><CheckCircle size={12}/> Pay</button>
                        </>)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && <PaymentModal type="customer" onClose={() => setModal(false)} onSave={handlePayment} />}
    </div>
  );
}
