import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, CheckCircle, XCircle, AlertTriangle, RefreshCw, ArrowUpRight, PackageCheck, AlertOctagon } from 'lucide-react';
import {
  RETURNS, COMPLAINTS, CUSTOMERS, PRODUCTS, SALES_ORDERS, PAYMENTS, STOCK_MOVEMENTS,
  fmt, newRetId, newCmpId, newPayId, newSmId, getCustomer, getProduct, getSalesOrder, getWarrantyStatus,
  SERVICE_JOBS, newJobId, APP_SETTINGS, today, newestFirst } from '../data/store';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

function ReturnModal({ onClose, onSave }) {
  const [form, setForm] = useState({ type:'refund', customerId:'', salesOrderId:'', productId:'', reason:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const orders = form.customerId ? SALES_ORDERS.filter(o=>o.customerId===form.customerId) : [];
  const order = SALES_ORDERS.find(o => o.id === form.salesOrderId);
  const orderProducts = order ? PRODUCTS.filter(p => order.items.some(i => i.productId === p.id)) : PRODUCTS;
  // Verify warranty status (warranty_record) before the request can be saved
  const warranty = getWarrantyStatus(form.productId, form.salesOrderId);
  const blocked = form.type === 'exchange' && warranty.known && !warranty.valid;
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <RefreshCw size={18} color="var(--warning-400)" />
          <div className="modal-title">New Return / Exchange Request</div>
        </div>
        <div className="modal-body">
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Request Type</label>
              <select className="form-select" value={form.type} onChange={e=>set('type',e.target.value)}>
                <option value="refund">Refund</option>
                <option value="exchange">Exchange</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Customer *</label>
              <select className="form-select" value={form.customerId} onChange={e=>set('customerId',e.target.value)}>
                <option value="">Select…</option>
                {CUSTOMERS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Sales Order</label>
              <select className="form-select" value={form.salesOrderId} onChange={e=>{ set('salesOrderId',e.target.value); set('productId',''); }}>
                <option value="">Select order…</option>
                {orders.map(o=><option key={o.id} value={o.id}>{o.invoiceNo}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Product</label>
              <select className="form-select" value={form.productId} onChange={e=>set('productId',e.target.value)}>
                <option value="">Select product…</option>
                {orderProducts.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
              </select>
            </div>
          </div>
          <div id="return-warranty-status" className={`alert alert-${!warranty.known ? 'info' : warranty.valid ? 'success' : 'danger'}`} style={{ fontSize: 13 }}>
            🛡️ {warranty.message}
            {blocked && ' — an exchange needs a valid warranty.'}
          </div>
          <div className="form-group">
            <label className="form-label">Reason *</label>
            <textarea className="form-textarea" rows={3} value={form.reason} onChange={e=>set('reason',e.target.value)} placeholder="Describe the issue…" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-warning" disabled={!form.customerId||!form.salesOrderId||!form.productId||!form.reason||blocked} onClick={()=>onSave({ ...form, warrantyValid: warranty.valid })}>
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}

function ComplaintModal({ onClose, onSave }) {
  const [form, setForm] = useState({ customerId:'', subject:'', description:'', priority:'normal' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <AlertTriangle size={18} color="var(--danger-400)" />
          <div className="modal-title">Log New Complaint</div>
        </div>
        <div className="modal-body">
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Customer *</label>
              <select className="form-select" value={form.customerId} onChange={e=>set('customerId',e.target.value)}>
                <option value="">Select…</option>
                {CUSTOMERS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-select" value={form.priority} onChange={e=>set('priority',e.target.value)}>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Subject *</label>
            <input className="form-input" value={form.subject} onChange={e=>set('subject',e.target.value)} placeholder="Brief summary of the complaint" />
          </div>
          <div className="form-group">
            <label className="form-label">Description *</label>
            <textarea className="form-textarea" rows={3} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Detailed description…" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" disabled={!form.customerId||!form.subject||!form.description} onClick={()=>onSave(form)}>
            Log Complaint
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReturnsPage() {
  const toast = useToast();
  const { user, canDo } = useAuth();
  const [returns, setReturns] = useState(() => [...RETURNS]);
  const [complaints, setComplaints] = useState(() => [...COMPLAINTS]);
  const [activeTab, setActiveTab] = useState('returns');
  const location = useLocation();
  const navigate = useNavigate();
  // Open the right tab for the menu item that brought the user here
  useEffect(() => {
    setActiveTab(location.pathname === '/complaints' ? 'complaints' : 'returns');
  }, [location.pathname]);
  // Buttons elsewhere can ask this page to open a form / tab / filter; apply it once, then clear it
  useEffect(() => {
    if (!location.state) return;

    navigate(location.pathname, { replace: true, state: null });
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const [modal, setModal] = useState(null);
  const [q, setQ] = useState('');
  const [trackNo, setTrackNo] = useState('');
  const [tracked, setTracked] = useState(null);   // SD 32 Track refund status
  const save = (updated) => {
    setReturns(rs => rs.map(r => r.id === updated.id ? updated : r));
    const i = RETURNS.findIndex(r => r.id === updated.id);
    if (i !== -1) RETURNS[i] = updated;
  };

  const handleReturnSave = (form) => {
    const ret = {
      id: newRetId(), status:'pending', ...form,
      requestedBy: user?.id, approvedBy:null, refundAmount:0, refundStatus:'none',
      inspectionResult:null, canRestock:null,
      createdAt: format(new Date(),'yyyy-MM-dd'), resolvedAt:null,
    };
    RETURNS.push(ret);
    setReturns(rs => [...rs, ret]);
    toast.success('Return request submitted for approval');
    setModal(null);
  };

  const handleComplaintSave = (form) => {
    const cmp = {
      id: newCmpId(), ...form, status:'open', assignedTo: null,
      resolution:null, createdBy: user?.id,
      createdAt: format(new Date(),'yyyy-MM-dd'), resolvedAt:null,
    };
    COMPLAINTS.push(cmp);
    setComplaints(cs => [...cs, cmp]);
    toast.success('Complaint logged');
    setModal(null);
  };

  // SD 10 approveRequest: the warranty is checked first; an expired warranty is rejected automatically
  const approveReturn = (ret, approved) => {
    const w = getWarrantyStatus(ret.productId, ret.salesOrderId);
    const expired = w.known ? !w.valid : !ret.warrantyValid;
    if (approved && expired) {
      save({ ...ret, status:'rejected', approvedBy: user?.id, resolvedAt: today(), rejectReason:'Warranty expired' });
      toast.error('Request rejected – warranty expired');
      return;
    }
    const updated = { ...ret, status: approved ? 'approved' : 'rejected', approvedBy: user?.id, resolvedAt: today() };
    if (approved && ret.type === 'refund') {
      const so = SALES_ORDERS.find(o => o.id === ret.salesOrderId);
      const line = so?.items?.find(it => it.productId === ret.productId);
      updated.refundAmount = line ? Math.round(line.total / (line.qty || 1)) : (so?.amountPaid || 0);
      updated.refundStatus = 'awaiting-item';     // Sales sends it to Finance after the item comes back
    }
    save(updated);
    if (!approved) toast.success('Request rejected');
    else toast.success(ret.type === 'refund' ? 'Request approved – refund authorised' : 'Request approved – exchange authorised');
  };

  // SD 29 Process refund (Sales): only when the returned item has been received and inspected
  const sendToFinance = (ret) => {
    if (!ret.inventoryUpdated) { toast.warning('Waiting for the returned item'); return; }
    save({ ...ret, refundStatus:'pending', sentToFinanceAt: today(), sentBy: user?.id });
    toast.success(`Refund ${ret.id} sent to Finance`);
  };

  // SD 54 Process approved refund payment (Finance): above the limit it needs Admin approval
  const processRefund = (ret) => {
    if (ret.refundAmount > APP_SETTINGS.refundApprovalLimit && !ret.adminApproved) {
      save({ ...ret, refundStatus:'needs-admin' });
      toast.warning(`Needs Admin approval – refund is above ${fmt(APP_SETTINGS.refundApprovalLimit)}`);
      return;
    }
    const payment = { id: newPayId(), customerId: ret.customerId, salesOrderId: ret.salesOrderId, amount: ret.refundAmount, method:'transfer', date: today(), recordedBy: user?.id, note:`Refund for ${ret.id}`, type:'refund' };
    PAYMENTS.push(payment);
    save({ ...ret, refundStatus:'processed', refundPaidAt: today(), refundReceiptNo: payment.id, paidBy: user?.id });
    toast.success(`Refund of ${fmt(ret.refundAmount)} paid – receipt ${payment.id}`);
  };
  const adminApproveRefund = (ret) => {
    save({ ...ret, refundStatus:'pending', adminApproved: true, adminApprovedBy: user?.id });
    toast.success(`Refund ${ret.id} approved by Admin – Finance can now pay it`);
  };

  // SD 32 trackRefund(refundNo)
  const trackRefund = () => {
    const r = RETURNS.find(x => x.id.toLowerCase() === trackNo.trim().toLowerCase() && x.type === 'refund');
    if (!r) { setTracked({ none: true }); toast.error('No refund found for this number'); return; }
    setTracked(r);
  };
  const REFUND_TEXT = { none:'not started', 'awaiting-item':'waiting for the returned item', pending:'with Finance', 'needs-admin':'waiting for Admin approval', processed:'paid' };

  const resolveComplaint = (cmp, resolution) => {
    const updated = { ...cmp, status:'resolved', resolution, resolvedAt: format(new Date(),'yyyy-MM-dd') };
    setComplaints(cs => cs.map(c => c.id === cmp.id ? updated : c));
    const i = COMPLAINTS.findIndex(c => c.id === cmp.id);
    if (i !== -1) COMPLAINTS[i] = updated;
    toast.success('Complaint resolved');
  };

  const inspectReturn = (ret, restock) => {
    const updated = {
      ...ret,
      inspectionResult: restock ? 'Serviceable / Inspected' : 'Damaged / Write-off',
      canRestock: restock,
      inventoryUpdated: true,
      receivedBy: user?.id,   // returned_item.user_id (storekeeper who received and inspected it)
    };
    if (restock) {
      const pidx = PRODUCTS.findIndex(p => p.id === ret.productId);
      if (pidx !== -1) {
        PRODUCTS[pidx].stock += 1;
        STOCK_MOVEMENTS.push({
          id: newSmId(), productId: ret.productId, type: 'in', qty: 1,
          ref: ret.id, note: 'Return restocked as serviceable inventory',
          date: format(new Date(), 'yyyy-MM-dd'), userId: user?.id
        });
      }
      toast.success('Item inspected and restocked as serviceable inventory');
    } else {
      STOCK_MOVEMENTS.push({
        id: newSmId(), productId: ret.productId, type: 'adj', qty: -1,
        ref: ret.id, note: 'Damaged returned item written off to scrap',
        date: format(new Date(), 'yyyy-MM-dd'), userId: user?.id
      });
      toast.warning('Item inspected and written off as scrap');
    }
    setReturns(rs => rs.map(r => r.id === ret.id ? updated : r));
    const i = RETURNS.findIndex(r => r.id === ret.id);
    if (i !== -1) RETURNS[i] = updated;
  };

  // SD 11: an unresolved complaint can be escalated into a service job
  const complaintToJob = (cmp) => {
    const job = { id: newJobId(), customerId: cmp.customerId, productId: cmp.productId || '', serialNo:'', salesOrderId: cmp.salesOrderId || '',
      type:'repair', priority:'urgent', description:`From complaint ${cmp.id}: ${cmp.subject} – ${cmp.description || ''}`, assignedTo:null,
      warrantyValid:true, warrantyExpiry:'', serviceFee:0, billingStatus:'unbilled', visits:[], partsUsed:[], status:'pending',
      complaintId: cmp.id, createdBy: user?.id, createdAt: today(), updatedAt: today(), completedAt:null };
    SERVICE_JOBS.push(job);
    const updated = { ...cmp, escalated: true, priority:'urgent', serviceJobId: job.id, status:'in-service' };
    setComplaints(cs => cs.map(c => c.id === cmp.id ? updated : c));
    const i = COMPLAINTS.findIndex(c => c.id === cmp.id);
    if (i !== -1) COMPLAINTS[i] = updated;
    toast.success(`Complaint escalated to service job ${job.id}`);
  };

  const escalateComplaint = (cmp) => {
    const updated = { ...cmp, priority: 'urgent', escalated: true };
    setComplaints(cs => cs.map(c => c.id === cmp.id ? updated : c));
    const i = COMPLAINTS.findIndex(c => c.id === cmp.id);
    if (i !== -1) COMPLAINTS[i] = updated;
    toast.warning(`Complaint ${cmp.id} escalated to Senior Management`);
  };

  // the last column of a row: buttons this role may use, or a short result (inspection, rejection, service job)
  const retAction = (r) => (r.status === 'pending' && canDo('return.approve')) || (r.status === 'approved' && !r.inventoryUpdated && canDo('return.inspect')) ||
    (r.status === 'approved' && r.refundStatus === 'awaiting-item' && canDo('refund.send')) ||
    (r.status === 'approved' && r.refundStatus === 'pending' && canDo('refund.pay')) || (r.refundStatus === 'needs-admin' && canDo('refund.adminApprove'));
  const retCell = (r) => retAction(r) || r.inventoryUpdated || (r.status === 'rejected' && !!r.rejectReason);
  const cmpAction = (c) => c.status === 'open' && ((!c.escalated && canDo('complaint.escalate')) || (canDo('complaint.toServiceJob') && !c.serviceJobId) || canDo('complaint.resolve'));
  const cmpCell = (c) => cmpAction(c) || !!c.serviceJobId || c.status === 'resolved';
  const filteredReturns = returns.filter(r => {
    const c = getCustomer(r.customerId);
    return !q || r.id.includes(q) || c?.name.toLowerCase().includes(q.toLowerCase()) || r.reason?.toLowerCase().includes(q.toLowerCase());
  });

  const filteredComplaints = complaints.filter(c => {
    const cu = getCustomer(c.customerId);
    return !q || c.id.includes(q) || cu?.name.toLowerCase().includes(q.toLowerCase()) || c.subject?.toLowerCase().includes(q.toLowerCase());
  });
  // the last column shows only when at least one listed row has something in it
  const showRetCol = filteredReturns.some(retCell);
  const retButtons = filteredReturns.some(retAction);
  const showCmpCol = filteredComplaints.some(cmpCell);
  const cmpButtons = filteredComplaints.some(cmpAction);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{activeTab === 'complaints' ? 'Customer Complaints' : 'Returns & Exchanges'}</h1>
          <p className="page-subtitle">{returns.filter(r=>r.status==='pending').length} pending returns · {complaints.filter(c=>c.status==='open').length} open complaints</p>
        </div>
        <div className="page-header-actions">
          {canDo('complaint.create') && <button className="btn btn-outline" onClick={() => setModal('complaint')}><AlertTriangle size={14}/> Log Complaint</button>}
          {canDo('return.create') && <button className="btn btn-primary" onClick={() => setModal('return')}><Plus size={14}/> New Request</button>}
        </div>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <div className="tabs">
          <button className={`tab-btn ${activeTab==='returns'?'active':''}`} onClick={()=>setActiveTab('returns')}>🔄 Returns & Exchanges ({returns.length})</button>
          <button className={`tab-btn ${activeTab==='complaints'?'active':''}`} onClick={()=>setActiveTab('complaints')}>⚠️ Complaints ({complaints.length})</button>
        </div>
        <div className="search-bar" style={{ marginLeft:'auto' }}>
          <Search size={14} color="var(--text-muted)" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…" style={{ width:200 }} />
        </div>
      </div>

      {activeTab === 'returns' && (
        <div className="card" id="track-refund" style={{ marginBottom:16 }}>
          <div className="card-body" style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <strong style={{ fontSize:13 }}>Track refund</strong>
            <input id="track-refund-no" className="form-input" style={{ width:180 }} placeholder="Refund no. e.g. RET-001" value={trackNo}
              onChange={e=>{ setTrackNo(e.target.value); setTracked(null); }} onKeyDown={e=>e.key==='Enter'&&trackRefund()} />
            <button id="btn-track-refund" className="btn btn-outline btn-sm" disabled={!trackNo.trim()} onClick={trackRefund}>Track</button>
            {tracked && (tracked.none
              ? <span id="track-result" style={{ color:'var(--danger-400)', fontSize:13 }}>No refund found for this number</span>
              : tracked.refundStatus === 'processed'
                ? <span id="track-result" style={{ color:'var(--success-400)', fontSize:13 }}>Refund {tracked.id} paid on {tracked.refundPaidAt || tracked.resolvedAt} – receipt {tracked.refundReceiptNo || PAYMENTS.find(x => x.note === `Refund for ${tracked.id}`)?.id || 'on file'} – {fmt(tracked.refundAmount)}</span>
                : <span id="track-result" style={{ color:'var(--warning-400)', fontSize:13 }}>Refund {tracked.id} is {tracked.status === 'rejected' ? 'rejected' : tracked.status === 'pending' ? 'waiting for approval' : REFUND_TEXT[tracked.refundStatus] || tracked.refundStatus} – not yet paid</span>)}
          </div>
        </div>
      )}

      {activeTab === 'returns' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>ID</th><th>Type</th><th>Customer</th><th>Product</th><th>Reason</th><th>Warranty</th><th>Status</th><th>Refund</th>{showRetCol && <th>{retButtons ? 'Actions' : 'Result'}</th>}</tr>
            </thead>
            <tbody>
              {filteredReturns.length === 0 && (
                <tr><td colSpan={showRetCol ? 9 : 8}><div className="empty-state"><div className="empty-state-icon">🔄</div><div className="empty-state-title">No returns found</div></div></td></tr>
              )}
              {newestFirst(filteredReturns, 'createdAt').map(r => {
                const c = getCustomer(r.customerId);
                const p = getProduct(r.productId);
                return (
                  <tr key={r.id}>
                    <td><span style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{r.id}</span></td>
                    <td><span className={`badge badge-${r.type==='refund'?'danger':'warning'}`}>{r.type}</span></td>
                    <td style={{ fontWeight:600 }}>{c?.name}</td>
                    <td style={{ fontSize:13 }}>{p?.emoji} {p?.name}</td>
                    <td style={{ fontSize:12, color:'var(--text-muted)', maxWidth:200 }}>{r.reason}</td>
                    <td><span className={`badge badge-${r.warrantyValid?'success':'danger'}`}>{r.warrantyValid?'Valid':'No'}</span></td>
                    <td><span className={`badge badge-${r.status==='approved'?'success':r.status==='rejected'?'danger':'warning'}`}>{r.status}</span></td>
                    <td>
                      {r.refundAmount > 0 ? (
                        <div>
                          <div style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'var(--primary-300)' }}>{fmt(r.refundAmount)}</div>
                          <span className={`badge badge-${r.refundStatus==='processed'?'success':r.refundStatus==='needs-admin'?'danger':'warning'}`} style={{ fontSize:10 }}>{r.refundStatus}</span>
                        </div>
                      ) : '—'}
                    </td>
                    {showRetCol && <td>
                      <div className="table-action-cell">
                        {r.status === 'pending' && canDo('return.approve') && (
                          <>
                            <button id={`approve-ret-${r.id}`} className="btn btn-success btn-sm" onClick={() => approveReturn(r, true)}><CheckCircle size={12}/> Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => approveReturn(r, false)}><XCircle size={12}/> Reject</button>
                          </>
                        )}
                        {r.status === 'approved' && !r.inventoryUpdated && canDo('return.inspect') && (
                          <>
                            <button className="btn btn-outline btn-sm" onClick={() => inspectReturn(r, true)} title="Inspect and Restock Serviceable"><PackageCheck size={12}/> Restock</button>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-400)' }} onClick={() => inspectReturn(r, false)} title="Inspect and Write-off Damaged"><AlertOctagon size={12}/> Write-Off</button>
                          </>
                        )}
                        {r.inventoryUpdated && (
                          <span className="badge badge-gray" style={{ fontSize: 10 }}>{r.inspectionResult}</span>
                        )}
                        {r.status === 'approved' && r.refundStatus === 'awaiting-item' && canDo('refund.send') && (
                          <button id={`send-refund-${r.id}`} className="btn btn-outline btn-sm" onClick={() => sendToFinance(r)}>➡️ Send to Finance</button>
                        )}
                        {r.status === 'approved' && r.refundStatus === 'pending' && canDo('refund.pay') && (
                          <button id={`pay-refund-${r.id}`} className="btn btn-primary btn-sm" onClick={() => processRefund(r)}>💳 Refund</button>
                        )}
                        {r.refundStatus === 'needs-admin' && canDo('refund.adminApprove') && (
                          <button id={`admin-refund-${r.id}`} className="btn btn-warning btn-sm" onClick={() => adminApproveRefund(r)}>Approve refund</button>
                        )}
                        {r.status === 'rejected' && r.rejectReason && <span className="badge badge-danger" style={{ fontSize:10 }}>{r.rejectReason}</span>}
                      </div>
                    </td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'complaints' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>ID</th><th>Customer</th><th>Subject</th><th>Priority</th><th>Status</th><th>Date</th>{showCmpCol && <th>{cmpButtons ? 'Actions' : 'Result'}</th>}</tr>
            </thead>
            <tbody>
              {filteredComplaints.length === 0 && (
                <tr><td colSpan={showCmpCol ? 7 : 6}><div className="empty-state"><div className="empty-state-icon">💬</div><div className="empty-state-title">No complaints found</div></div></td></tr>
              )}
              {newestFirst(filteredComplaints, 'createdAt').map(c => {
                const cu = getCustomer(c.customerId);
                return (
                  <tr key={c.id}>
                    <td><span style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{c.id}</span></td>
                    <td style={{ fontWeight:600 }}>{cu?.name}</td>
                    <td>
                      <div style={{ fontWeight:600, fontSize:13 }}>{c.subject}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>{c.description?.slice(0,60)}…</div>
                    </td>
                    <td><span className={`badge badge-${c.priority==='urgent'?'danger':c.priority==='high'?'warning':'gray'}`}>{c.priority}</span></td>
                    <td><span className={`badge badge-${c.status==='resolved'?'success':'warning'}`}>{c.status}</span></td>
                    <td style={{ fontSize:12 }}>{c.createdAt}</td>
                    {showCmpCol && <td>
                      <div className="table-action-cell">
                        {c.status === 'open' && (
                          <>
                            {!c.escalated && canDo('complaint.escalate') && (
                              <button
                                className="btn btn-outline btn-sm"
                                style={{ color: 'var(--warning-400)' }}
                                onClick={() => escalateComplaint(c)}
                                title="Escalate to Manager"
                              >
                                <ArrowUpRight size={12}/> Escalate
                              </button>
                            )}
                            {canDo('complaint.toServiceJob') && !c.serviceJobId && (
                              <button id={`cmp-job-${c.id}`} className="btn btn-outline btn-sm" onClick={() => complaintToJob(c)} title="Create a service job for this complaint">🔧 To service job</button>
                            )}
                            {canDo('complaint.resolve') && (
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => { const r = window.prompt('Enter resolution note:'); if(r) resolveComplaint(c, r); }}
                              >
                                <CheckCircle size={12}/> Resolve
                              </button>
                            )}
                          </>
                        )}
                        {c.serviceJobId && <span className="badge badge-primary" style={{ fontSize:10 }}>🔧 {c.serviceJobId}</span>}
                        {c.status === 'resolved' && <div style={{ fontSize:12, color:'var(--success-400)' }}>✅ {c.resolution?.slice(0,25)}</div>}
                      </div>
                    </td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal === 'return' && <ReturnModal onClose={() => setModal(null)} onSave={handleReturnSave} />}
      {modal === 'complaint' && <ComplaintModal onClose={() => setModal(null)} onSave={handleComplaintSave} />}
    </div>
  );
}
