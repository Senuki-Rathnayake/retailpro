import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, CheckCircle, AlertTriangle, Clock, Wrench, User, Calendar } from 'lucide-react';
import {
  SERVICE_JOBS, CUSTOMERS, PRODUCTS, USERS, SALES_ORDERS, STOCK_MOVEMENTS, RETURNS, newRetId,
  fmt, newJobId, newSmId, getCustomer, getUser, getProduct,
  SPARE_PART_REQUESTS, newSprId, availableTechnicians, openJobsOf, APP_SETTINGS, today as todayStr, newestFirst } from '../data/store';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

const STATUS_FLOW = ['pending','assigned','in-progress','on-hold','completed','cancelled'];
const STATUS_COLOR = { pending:'gray', assigned:'primary', 'in-progress':'warning', 'on-hold':'accent', completed:'success', cancelled:'danger' };
// SD 37 validateStatusTransition(currentStatus, newStatus)
const TRANSITIONS = {
  pending: ['assigned', 'cancelled'],
  assigned: ['in-progress', 'on-hold', 'cancelled'],
  'in-progress': ['on-hold', 'completed'],
  'on-hold': ['in-progress'],
  completed: [], cancelled: [],
};
const CLOSED = ['completed', 'cancelled'];
const label = (s) => s.replace('-', ' ').replace(/^\w/, c => c.toUpperCase());
const TYPE_ICON = { installation:'🔌', repair:'🔧', maintenance:'🛠️' };
const PRIORITY_COLOR = { normal:'gray', high:'warning', urgent:'danger' };
const BILL_COLOR = { unbilled:'gray', invoiced:'warning', paid:'success', warranty:'primary' };

function JobModal({ job, onClose, onSave }) {
  const { canDo } = useAuth();
  const [form, setForm] = useState(job || {
    customerId:'', productId:'', serialNo:'', salesOrderId:'',
    type:'repair', priority:'normal', description:'', assignedTo:'',
    scheduledDate:'', address:'', closeAtCounter:false,
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  // SD 8 getAvailableTechnicians(jobType): right skill and free capacity
  const technicians = availableTechnicians(form.type);
  const pastDate = form.scheduledDate && form.scheduledDate < todayStr();
  const customerOrders = form.customerId ? SALES_ORDERS.filter(o=>o.customerId===form.customerId) : [];

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span style={{ fontSize:20 }}>🔧</span>
          <div className="modal-title">{job ? 'Edit Service Job' : 'New Service Job'}</div>
        </div>
        <div className="modal-body">
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Customer *</label>
              <select className="form-select" value={form.customerId} onChange={e=>set('customerId',e.target.value)}>
                <option value="">Select customer…</option>
                {CUSTOMERS.map(c=><option key={c.id} value={c.id}>{c.name} – {c.phone}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Linked Sales Order</label>
              <select className="form-select" value={form.salesOrderId} onChange={e=>set('salesOrderId',e.target.value)}>
                <option value="">None</option>
                {customerOrders.map(o=><option key={o.id} value={o.id}>{o.invoiceNo} — {fmt(o.grandTotal)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Product</label>
              <select className="form-select" value={form.productId} onChange={e=>set('productId',e.target.value)}>
                <option value="">Select product…</option>
                {PRODUCTS.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Serial Number</label>
              <input className="form-input" value={form.serialNo} onChange={e=>set('serialNo',e.target.value)} placeholder="e.g. SN-20240112" />
            </div>
          </div>
          <div className={canDo('service.assign') ? 'form-row-3' : 'form-row-2'}>
            <div className="form-group">
              <label className="form-label">Job Type *</label>
              <select className="form-select" value={form.type} onChange={e=>set('type',e.target.value)}>
                <option value="installation">Installation</option>
                <option value="repair">Repair</option>
                <option value="maintenance">Maintenance</option>
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
            {canDo('service.assign') && (
              <div className="form-group">
                <label className="form-label">Assign Technician</label>
                <select id="new-job-tech" className="form-select" value={form.assignedTo} onChange={e=>set('assignedTo',e.target.value)}>
                  <option value="">Unassigned</option>
                  {technicians.map(t=><option key={t.id} value={t.id}>{t.avatar} {t.name} ({openJobsOf(t.id)}/{APP_SETTINGS.technicianMaxJobs} jobs)</option>)}
                </select>
                {technicians.length === 0 && <div style={{ fontSize:11, color:'var(--danger-400)' }}>No technician available for this job type</div>}
              </div>
            )}
          </div>
          {/* SD 27 Register installation / delivery request: date, address, job type */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Scheduled Date</label>
              <input id="new-job-date" type="date" className="form-input" value={form.scheduledDate} onChange={e=>set('scheduledDate',e.target.value)} />
              {pastDate && <div style={{ fontSize:11, color:'var(--danger-400)' }}>Scheduled date cannot be in the past</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Site Address</label>
              <input id="new-job-address" className="form-input" value={form.address} onChange={e=>set('address',e.target.value)} placeholder={getCustomer(form.customerId)?.address || 'Where the work will be done'} />
            </div>
          </div>
          {form.salesOrderId && (
            <label style={{ display:'flex', gap:6, alignItems:'center', fontSize:13, marginBottom:8 }}>
              <input id="new-job-close-order" type="checkbox" checked={form.closeAtCounter} onChange={e=>set('closeAtCounter',e.target.checked)} />
              Customer collects the items now – close the order at the counter
            </label>
          )}
          <div className="form-group">
            <label className="form-label">Description / Fault Details *</label>
            <textarea className="form-textarea" rows={3} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Describe the fault or work required…" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button id="btn-save-job" className="btn btn-primary" disabled={!form.customerId || !form.description} onClick={() => onSave(form)}>
            {job ? 'Save Changes' : 'Create Job'}
          </button>
        </div>
      </div>
    </div>
  );
}

function JobDetailModal({ job, onClose, onUpdate }) {
  const { user, canDo } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState(job.status);
  const [visitNote, setVisitNote] = useState('');
  const [visitType, setVisitType] = useState('maintenance');
  const [duration, setDuration] = useState(1);
  const [doneNote, setDoneNote] = useState(job.resolutionNotes || '');
  const [reqPart, setReqPart] = useState('');
  const [reqQty, setReqQty] = useState(1);
  const [, bump] = useState(0);
  const jobRequests = SPARE_PART_REQUESTS.filter(r => r.serviceJobId === job.id);
  // SD 38 getVisitHistory: sortByVisitDate() + calculateTotalDuration(); selectVisit(visitLogId) opens one visit
  const visits = [...(job.visits || [])].map((v, i) => ({ ...v, no: i + 1 })).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const totalHours = visits.reduce((a, v) => a + (Number(v.duration) || 0), 0);
  const [openVisit, setOpenVisit] = useState(null);
  const [partId, setPartId] = useState('');
  const [partQty, setPartQty] = useState(1);
  const [assignTo, setAssignTo] = useState(job.assignedTo || '');
  const [fault, setFault] = useState({ faultFound: job.faultFound || '', repairDone: job.repairDone || '', recommendExchange: !!job.recommendExchange });
  const [fee, setFee] = useState(job.serviceFee || 0);
  const technicians = USERS.filter(u => u.role === 'technician' && u.active !== false);
  const freeTechs = availableTechnicians(job.type, job.id);
  const customer = getCustomer(job.customerId);
  const tech = getUser(job.assignedTo);
  const product = getProduct(job.productId);
  const spareParts = PRODUCTS.filter(p => p.category === 'CAT006');

  // SD 35 logMaintenanceVisit(serviceJobId, notes, visitType, duration)
  const addVisit = () => {
    if (!visitNote) return;
    if (CLOSED.includes(job.status)) { toast.error('Cannot log a visit on a closed job'); return; }
    if (!(Number(duration) > 0)) { toast.error('Duration must be greater than zero'); return; }
    const updated = { ...job, visits: [...(job.visits||[]), { date: todayStr(), note: visitNote, type: visitType, duration: Number(duration), userId: user?.id }],
      visitCount: (job.visits?.length || 0) + 1, updatedAt: todayStr() };
    if (['assigned', 'on-hold'].includes(job.status)) { updated.status = 'in-progress'; setStatus('in-progress'); }
    onUpdate(updated, 'Visit details saved');
    setVisitNote('');
  };

  // SD 35 requestSparePartsFromStock(serviceJobId, productId, qty)
  const requestPart = () => {
    if (!reqPart || !(reqQty > 0)) return;
    if (CLOSED.includes(job.status)) { toast.error('Cannot request parts for a closed job'); return; }
    SPARE_PART_REQUESTS.push({ id: newSprId(), serviceJobId: job.id, productId: reqPart, requestedQty: Number(reqQty), issuedQty: 0,
      requestDate: todayStr(), status: 'requested', requestedBy: user?.id, issuedBy: null });
    toast.success('Request sent to store');
    setReqPart(''); setReqQty(1); bump(n => n + 1);
  };

  // SD 8 / SD 9: assign or re-assign a technician, checking skill and free capacity
  const reassign = () => {
    if (assignTo && !freeTechs.some(t => t.id === assignTo)) { toast.error('Selected technician has no free capacity'); return; }
    const first = !job.assignedTo;
    onUpdate({ ...job, assignedTo: assignTo || null, status: assignTo && job.status === 'pending' ? 'assigned' : (!assignTo && job.status === 'assigned' ? 'pending' : job.status), updatedAt: todayStr() },
      !assignTo ? 'Technician removed' : first ? `Technician assigned – ${getUser(assignTo)?.name}` : `Job reassigned to ${getUser(assignTo)?.name}`);
  };
  const autoAssign = () => {
    if (freeTechs.length === 0) { toast.error('No technician available for this job type'); return; }
    const t = [...freeTechs].sort((a, b) => openJobsOf(a.id) - openJobsOf(b.id))[0];
    setAssignTo(t.id);
    onUpdate({ ...job, assignedTo: t.id, status: job.status === 'pending' ? 'assigned' : job.status, updatedAt: todayStr() }, `Technician assigned – ${t.name}`);
  };

  // SD 37 updateJobStatus / SD 34 recordInstallationComplete
  const changeStatus = () => {
    if (status === job.status) return;
    if (status === 'completed' && job.status !== 'in-progress') { toast.error('Job must be in progress before completing'); return; }
    if (!(TRANSITIONS[job.status] || []).includes(status)) { toast.error('Cannot change status from the current state'); return; }
    const updated = { ...job, status, updatedAt: todayStr() };
    if (status === 'completed') {
      updated.completedAt = todayStr();
      updated.resolutionNotes = doneNote;
      const so = SALES_ORDERS.find(o => o.id === job.salesOrderId);
      if (so) so.deliveryStatus = 'delivered';
    }
    onUpdate(updated, status === 'completed' ? 'Job completed – you are now available' : 'Job status updated');
  };

  // Record repair / fault details (technician); optional exchange recommendation
  const saveRepair = () => {
    const updated = { ...job, ...fault, updatedAt: format(new Date(),'yyyy-MM-dd') };
    if (fault.recommendExchange && !job.exchangeRequestId) {
      const ret = {
        id: newRetId(), type:'exchange', customerId: job.customerId, salesOrderId: job.salesOrderId,
        productId: job.productId, reason: `Technician recommends exchange (${job.id}): ${fault.faultFound}`,
        status:'pending', warrantyValid: job.warrantyValid, requestedBy: user?.id, approvedBy:null,
        refundAmount:0, refundStatus:'none', inspectionResult:null, canRestock:null, serviceJobId: job.id,
        createdAt: format(new Date(),'yyyy-MM-dd'), resolvedAt:null,
      };
      RETURNS.push(ret);
      updated.exchangeRequestId = ret.id;
      toast.info(`Exchange request ${ret.id} sent for manager approval`);
    }
    onUpdate(updated, 'Repair details saved');
  };

  // Track service job billing (finance)
  const saveBilling = (billingStatus) => {
    onUpdate({ ...job, serviceFee: Number(fee) || 0, billingStatus }, billingStatus === 'invoiced' ? 'Service job billed – invoice raised' : 'Service job marked paid');
  };

  const addPart = () => {
    if (!partId) return;
    const p = PRODUCTS.find(x=>x.id===partId);
    if (!p || p.stock < partQty) { toast.error('Insufficient stock'); return; }
    const updated = {
      ...job,
      partsUsed: [...(job.partsUsed||[]), { productId: partId, qty: partQty, note: p.name }],
    };
    // Deduct stock
    const pidx = PRODUCTS.findIndex(x=>x.id===partId);
    if (pidx !== -1) {
      PRODUCTS[pidx].stock -= partQty;
      STOCK_MOVEMENTS.push({ id: newSmId(), productId: partId, type:'out', qty: partQty, ref: job.id, note:'Service part used', date: format(new Date(),'yyyy-MM-dd'), userId: user?.id });
    }
    onUpdate(updated, `Part issued: ${p.name} × ${partQty}`);
    setPartId('');
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <span style={{ fontSize:20 }}>{TYPE_ICON[job.type]}</span>
          <div>
            <div className="modal-title">{job.id} — {job.type.charAt(0).toUpperCase()+job.type.slice(1)}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>{customer?.name} · {product?.name}</div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto' }} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {/* Left */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="card-elevated" style={{ padding:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:.5, color:'var(--text-muted)' }}>Job Details</span>
                <span className={`badge badge-${STATUS_COLOR[job.status]}`}>{job.status.replace('-',' ')}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:13 }}>
                <div style={{ display:'flex', gap:10 }}><span className="text-muted">Priority</span><span className={`badge badge-${PRIORITY_COLOR[job.priority]}`}>{job.priority}</span></div>
                <div style={{ display:'flex', gap:10 }}><span className="text-muted">Customer</span><strong>{customer?.name}</strong></div>
                <div style={{ display:'flex', gap:10 }}><span className="text-muted">Product</span><span>{product?.emoji} {product?.name}</span></div>
                <div style={{ display:'flex', gap:10 }}><span className="text-muted">Serial No</span><span style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{job.serialNo || '—'}</span></div>
                <div style={{ display:'flex', gap:10 }}><span className="text-muted">Technician</span><span>{tech ? `${tech.avatar} ${tech.name}` : 'Unassigned'}</span></div>
                <div style={{ display:'flex', gap:10 }}><span className="text-muted">Warranty</span><span className={`badge badge-${job.warrantyValid?'success':'danger'}`}>{job.warrantyValid?'Valid':'Expired'}</span></div>
              </div>
              <div style={{ marginTop:10, padding:10, background:'var(--bg-overlay)', borderRadius:6, fontSize:13, color:'var(--text-secondary)' }}>
                {job.description}
              </div>
            </div>

            {/* Assign / re-assign technician (admin) */}
            {canDo('service.assign') && (
              <div className="card-elevated" style={{ padding:14 }}>
                <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:.5, color:'var(--text-muted)', marginBottom:10 }}>Assign Technician</div>
                <div style={{ display:'flex', gap:8 }}>
                  <select id="job-assign-select" className="form-select" value={assignTo} onChange={e=>setAssignTo(e.target.value)} style={{ flex:1 }} disabled={CLOSED.includes(job.status)}>
                    <option value="">Unassigned</option>
                    {technicians.map(t=>{
                      const free = freeTechs.some(f => f.id === t.id);
                      return <option key={t.id} value={t.id}>{t.avatar} {t.name} – {openJobsOf(t.id)}/{APP_SETTINGS.technicianMaxJobs} jobs{(t.skills||[]).includes(job.type) ? '' : ' (no skill)'}{free || t.id === job.assignedTo ? '' : ' – full'}</option>;
                    })}
                  </select>
                  <button id="job-assign-btn" className="btn btn-primary btn-sm" disabled={(assignTo||null) === (job.assignedTo||null) || CLOSED.includes(job.status)} onClick={reassign}>
                    {job.assignedTo ? 'Re-assign' : 'Assign'}
                  </button>
                  {!job.assignedTo && !CLOSED.includes(job.status) && <button id="job-auto-assign" className="btn btn-outline btn-sm" onClick={autoAssign}>Auto</button>}
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
                  {freeTechs.length ? `${freeTechs.length} technician(s) free for ${job.type}` : 'No technician available for this job type'}
                </div>
              </div>
            )}

            {/* Billing (finance edits, others see it) */}
            <div className="card-elevated" style={{ padding:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:.5, color:'var(--text-muted)' }}>Billing</span>
                <span className={`badge badge-${BILL_COLOR[job.billingStatus] || 'gray'}`}>{job.billingStatus || 'unbilled'}</span>
              </div>
              <div style={{ fontSize:13, marginBottom: canDo('service.bill') ? 10 : 0 }}>
                Service fee: <strong style={{ fontFamily:'var(--font-mono)' }}>{fmt(job.serviceFee || 0)}</strong>
                {job.warrantyValid && <span style={{ color:'var(--text-muted)' }}> · covered by warranty</span>}
              </div>
              {canDo('service.bill') && (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <input id="job-fee-input" type="number" min={0} className="form-input" value={fee} onChange={e=>setFee(e.target.value)} style={{ width:120 }} />
                  <button className="btn btn-outline btn-sm" onClick={() => saveBilling('invoiced')}>Mark Invoiced</button>
                  <button className="btn btn-success btn-sm" onClick={() => saveBilling('paid')}>Mark Paid</button>
                </div>
              )}
            </div>

            {/* Status update (technician only) */}
            {canDo('service.updateStatus') && (
            <div className="card-elevated" style={{ padding:14 }}>
              <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:.5, color:'var(--text-muted)', marginBottom:10 }}>Update Status</div>
              <select id="job-status-select" className="form-select" value={status} onChange={e=>setStatus(e.target.value)} style={{ marginBottom:8 }}>
                {STATUS_FLOW.map(s=><option key={s} value={s}>{label(s)}{s !== job.status && !(TRANSITIONS[job.status]||[]).includes(s) ? ' (not allowed)' : ''}</option>)}
              </select>
              {status === 'completed' && (
                <textarea id="job-completion-notes" className="form-textarea" rows={2} value={doneNote} onChange={e=>setDoneNote(e.target.value)} placeholder="Completion / resolution notes…" style={{ marginBottom:8 }} />
              )}
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>
                Allowed from {label(job.status)}: {(TRANSITIONS[job.status]||[]).map(label).join(', ') || 'none (job is closed)'}
              </div>
              <button id="job-status-btn" className="btn btn-primary btn-sm" style={{ width:'100%', justifyContent:'center' }} onClick={changeStatus}>
                Update Status
              </button>
            </div>
            )}

            {/* Parts Used */}
            <div className="card-elevated" style={{ padding:14 }}>
              <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:.5, color:'var(--text-muted)', marginBottom:10 }}>Parts Used</div>
              {job.partsUsed?.length === 0 && <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:10 }}>No parts used yet</div>}
              {job.partsUsed?.map((p,i) => {
                const prod = getProduct(p.productId);
                return <div key={i} style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:4 }}>🔧 {prod?.name || p.productId} × {p.qty}</div>;
              })}
              {canDo('service.issueParts') && (
              <div style={{ display:'flex', gap:8, marginTop:8 }}>
                <select className="form-select" value={partId} onChange={e=>setPartId(e.target.value)} style={{ flex:1 }}>
                  <option value="">Select spare part…</option>
                  {PRODUCTS.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name} (Stock: {p.stock})</option>)}
                </select>
                <input type="number" className="form-input" value={partQty} min={1} onChange={e=>setPartQty(+e.target.value)} style={{ width:60 }} />
                <button className="btn btn-outline btn-sm" onClick={addPart} title="Issue spare part"><Plus size={13}/></button>
              </div>
              )}
              {/* SD 35 technician requests spare parts from the store */}
              {canDo('service.requestParts') && (
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:6 }}>Request from store</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <select id="job-req-part" className="form-select" value={reqPart} onChange={e=>setReqPart(e.target.value)} style={{ flex:1 }}>
                      <option value="">Select spare part…</option>
                      {spareParts.filter(p => !p.obsolete).map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                    </select>
                    <input id="job-req-qty" type="number" className="form-input" value={reqQty} min={1} onChange={e=>setReqQty(+e.target.value)} style={{ width:60 }} />
                    <button id="job-req-btn" className="btn btn-outline btn-sm" disabled={!reqPart} onClick={requestPart}>Request</button>
                  </div>
                </div>
              )}
              {jobRequests.length > 0 && (
                <div style={{ marginTop:8, fontSize:12, color:'var(--text-muted)' }}>
                  {jobRequests.map(r => <div key={r.id}>{r.id}: {getProduct(r.productId)?.name} × {r.requestedQty} – {r.status}</div>)}
                </div>
              )}
            </div>
          </div>

          {/* Right: Timeline */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Repair / fault details (technician) */}
            {(canDo('service.recordRepair') || job.faultFound) && (
              <div className="card-elevated" style={{ padding:14 }}>
                <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:.5, color:'var(--text-muted)', marginBottom:10 }}>Repair / Fault Details</div>
                {canDo('service.recordRepair') ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <textarea id="job-fault" className="form-textarea" rows={2} value={fault.faultFound} onChange={e=>setFault(f=>({...f, faultFound:e.target.value}))} placeholder="Fault found (diagnosis)…" />
                    <textarea id="job-repair" className="form-textarea" rows={2} value={fault.repairDone} onChange={e=>setFault(f=>({...f, repairDone:e.target.value}))} placeholder="Repair done / parts replaced…" />
                    <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--text-secondary)' }}>
                      <input id="job-recommend" type="checkbox" checked={fault.recommendExchange} disabled={!!job.exchangeRequestId} onChange={e=>setFault(f=>({...f, recommendExchange:e.target.checked}))} />
                      Recommend exchange or replacement
                    </label>
                    {job.exchangeRequestId && <div style={{ fontSize:12, color:'var(--text-muted)' }}>Exchange request {job.exchangeRequestId} created.</div>}
                    <button id="job-repair-save" className="btn btn-primary btn-sm" style={{ justifyContent:'center' }} disabled={!fault.faultFound} onClick={saveRepair}>Save Repair Details</button>
                  </div>
                ) : (
                  <div style={{ fontSize:13, display:'flex', flexDirection:'column', gap:4 }}>
                    <div><span className="text-muted">Fault:</span> {job.faultFound}</div>
                    {job.repairDone && <div><span className="text-muted">Repair:</span> {job.repairDone}</div>}
                    {job.recommendExchange && <div className="badge badge-warning" style={{ alignSelf:'flex-start' }}>Exchange recommended</div>}
                  </div>
                )}
              </div>
            )}

            <div className="card-elevated" style={{ padding:14, flex:1 }}>
              <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:.5, color:'var(--text-muted)', marginBottom:12 }}>Visit Log</div>
              {visits.length === 0 && <div id="no-visits" style={{ fontSize:13, color:'var(--text-muted)', marginBottom:12 }}>No visits recorded for this job</div>}
              {visits.length > 0 && (
                <div id="visit-total" style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:10 }}>
                  {visits.length} visit{visits.length !== 1 ? 's' : ''} · total time {totalHours} h
                </div>
              )}
              <div className="timeline">
                {visits.map((v,i) => (
                  <div key={i} id={`visit-${v.no}`} className="timeline-item" style={{ cursor:'pointer' }} onClick={() => setOpenVisit(openVisit === v.no ? null : v.no)} title="Click to see the full visit">
                    <div className="timeline-dot primary" />
                    <div className="timeline-content">
                      <div className="timeline-time">{v.date} · {getUser(v.userId)?.name}{v.type ? ` · ${v.type}` : ''}{v.duration ? ` · ${v.duration} h` : ''}</div>
                      <div className="timeline-text">{v.note}</div>
                      {openVisit === v.no && (
                        <div id="visit-detail" style={{ marginTop:6, padding:8, background:'var(--bg-overlay)', borderRadius:6, fontSize:12 }}>
                          <div><b>Visit {v.no}</b> on {v.date}</div>
                          <div>Type: {v.type || '—'} · Duration: {v.duration ? `${v.duration} h` : '—'}</div>
                          <div>Logged by: {getUser(v.userId)?.name || v.userId}</div>
                          <div>Notes: {v.note}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

 {canDo('service.logVisit') && (
              <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', gap:8 }}>
                  <select id="visit-type" className="form-select" value={visitType} onChange={e=>setVisitType(e.target.value)} style={{ flex:1 }}>
                    <option value="maintenance">Maintenance</option>
                    <option value="diagnosis">Diagnosis</option>
                    <option value="repair">Repair</option>
                    <option value="installation">Installation</option>
                    <option value="follow-up">Follow-up</option>
                  </select>
                  <input id="visit-duration" type="number" min={0.5} step={0.5} className="form-input" value={duration} onChange={e=>setDuration(e.target.value)} style={{ width:90 }} title="Duration (hours)" />
                  <span style={{ alignSelf:'center', fontSize:12 }}>hours</span>
                </div>
                <textarea id="visit-note" className="form-textarea" rows={2} value={visitNote} onChange={e=>setVisitNote(e.target.value)} placeholder="Log this visit — work done, findings, next steps…" />
                <button id="visit-save" className="btn btn-accent btn-sm" style={{ justifyContent:'center' }} onClick={addVisit} disabled={!visitNote}>
                  <Plus size={13}/> Log Visit
                </button>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ServiceJobsPage() {
  const toast = useToast();
  const { user, canDo } = useAuth();
  const [jobs, setJobs] = useState(() => [...SERVICE_JOBS]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  // Open the right tab for the menu item that brought the user here
  // Buttons elsewhere can ask this page to open a form / tab / filter; apply it once, then clear it
  useEffect(() => {
    if (!location.state) return;
    if (location.state?.open === 'new' && canDo('service.create')) setModal('new');
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const [detail, setDetail] = useState(null);

  // Technicians see only the jobs assigned to them ("View assigned service jobs")
  // SD 33 findByTechnician(technicianId) + sortByPriorityAndDate()
  const isTech = user?.role === 'technician';
  const PRIO = { urgent: 0, high: 1, normal: 2 };
  const visibleJobs = isTech
    // newest job first; jobs from the same day: higher priority first
    ? newestFirst(jobs.filter(j => j.assignedTo === user.id), 'createdAt').sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '') || (PRIO[a.priority] ?? 3) - (PRIO[b.priority] ?? 3))
    : newestFirst(jobs, 'createdAt');

  const filtered = visibleJobs.filter(j => {
    const c = getCustomer(j.customerId);
    return (statusFilter === 'all' || j.status === statusFilter) &&
      (typeFilter === 'all' || j.type === typeFilter) &&
      (j.id.toLowerCase().includes(q.toLowerCase()) || c?.name.toLowerCase().includes(q.toLowerCase()) || j.description.toLowerCase().includes(q.toLowerCase()));
  });

  const handleCreate = (form) => {
    const today = format(new Date(),'yyyy-MM-dd');
    if (form.scheduledDate && form.scheduledDate < today) { toast.error('Scheduled date cannot be in the past'); return; }
    if (form.assignedTo && !availableTechnicians(form.type).some(t => t.id === form.assignedTo)) { toast.error('Selected technician has no free capacity'); return; }
    const { closeAtCounter, ...rest } = form;
    const so = SALES_ORDERS.find(o => o.id === form.salesOrderId);
    if (so) {
      so.status = closeAtCounter ? 'completed' : 'service-scheduled';
      if (form.type === 'installation') so.installationRequired = true;   // sales_order.installation_required
      else so.deliveryRequired = so.deliveryRequired || !closeAtCounter;
    }
    const newJob = {
      id: newJobId(), ...rest, address: form.address || getCustomer(form.customerId)?.address || '',
      warrantyValid: true, warrantyExpiry: '', serviceFee: 0, billingStatus: 'unbilled',
      visits:[], partsUsed:[],
      status: form.assignedTo ? 'assigned' : 'pending',
      createdBy: user?.id, createdAt: today, updatedAt: today, completedAt: null,
    };
    SERVICE_JOBS.push(newJob);
    setJobs(js => [...js, newJob]);
    toast.success(so ? `Installation request ${newJob.id} registered${closeAtCounter ? ' – order closed at counter' : ''}` : `Service job ${newJob.id} created`);
    setModal(null);
  };

  const handleUpdate = (updated, msg) => {
    setJobs(js => js.map(j => j.id === updated.id ? updated : j));
    const i = SERVICE_JOBS.findIndex(j => j.id === updated.id);
    if (i !== -1) SERVICE_JOBS[i] = updated;
    if (detail?.id === updated.id) setDetail(updated);
    toast.success(msg || 'Job updated');
  };

  // SD 55 Track service job billing: completed, chargeable jobs that are not billed yet
  const toBill = jobs.filter(j => j.status === 'completed' && !j.warrantyValid && (!j.billingStatus || j.billingStatus === 'unbilled'));
  const billJob = (j) => handleUpdate({ ...j, billingStatus: 'invoiced', serviceFee: j.serviceFee || 5000, billedAt: todayStr() }, `Service job ${j.id} billed – invoice raised`);

  // SD 9 Review service performance: period + technician workload
  const [perfFrom, setPerfFrom] = useState('');
  const [perfTo, setPerfTo] = useState('');
  const perfOk = !perfFrom && !perfTo ? true : !!perfFrom && !!perfTo && perfFrom <= perfTo && perfTo <= todayStr();
  const inPeriod = (d) => !perfFrom || (d && d >= perfFrom && d <= perfTo);
  const perfRows = USERS.filter(u => u.role === 'technician').map(t => {
    const mine = jobs.filter(j => j.assignedTo === t.id);
    return { t, done: mine.filter(j => j.status === 'completed' && inPeriod(j.completedAt || j.updatedAt)).length,
      open: openJobsOf(t.id), visits: mine.reduce((a, j) => a + (j.visits || []).filter(v => inPeriod(v.date)).length, 0) };
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Service Jobs</h1>
          <p className="page-subtitle">{visibleJobs.length} total · {visibleJobs.filter(j=>j.status==='pending').length} pending · {visibleJobs.filter(j=>j.status==='in-progress').length} in progress</p>
        </div>
        <div className="page-header-actions">
          {canDo('service.create') && (
            <button id="btn-new-service-job" className="btn btn-primary" onClick={() => setModal('new')}>
              <Plus size={15}/> New Job
            </button>
          )}
        </div>
      </div>

      {/* SD 55 billing list (Finance) */}
      {canDo('service.bill') && (
        <div className="card" id="billing-list" style={{ marginBottom:16 }}>
          <div className="card-header"><div className="card-title">💰 Completed jobs waiting for billing</div></div>
          <div className="card-body">
            {toBill.length === 0 ? <div id="all-billed" className="alert alert-success">All completed jobs are billed</div> : (
              <table className="table">
                <thead><tr><th>Job</th><th>Customer</th><th>Type</th><th>Completed</th><th>Fee</th><th>Actions</th></tr></thead>
                <tbody>{newestFirst(toBill, 'completedAt').map(j => (
                  <tr key={j.id}><td>{j.id}</td><td>{getCustomer(j.customerId)?.name}</td><td>{j.type}</td><td>{j.completedAt || '—'}</td><td>{fmt(j.serviceFee || 5000)}</td>
                    <td><button id={`bill-${j.id}`} className="btn btn-primary btn-sm" onClick={() => billJob(j)}>Bill job</button></td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* SD 9 technician workload for a period (Admin) */}
      {canDo('service.assign') && (
        <div className="card" id="tech-workload" style={{ marginBottom:16 }}>
          <div className="card-header" style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <div className="card-title">📊 Technician workload</div>
            <label style={{ fontSize:13 }}>From <input id="perf-from" type="date" className="form-input" style={{ width:150, display:'inline-block' }} value={perfFrom} onChange={e=>setPerfFrom(e.target.value)} /></label>
            <label style={{ fontSize:13 }}>To <input id="perf-to" type="date" className="form-input" style={{ width:150, display:'inline-block' }} value={perfTo} onChange={e=>setPerfTo(e.target.value)} /></label>
          </div>
          <div className="card-body">
            {!perfOk ? <div id="perf-error" className="alert alert-danger">Please select a valid period</div> : (
              <table className="table">
                <thead><tr><th>Technician</th><th>Skills</th><th>Completed{perfFrom ? ' (period)' : ''}</th><th>Visits{perfFrom ? ' (period)' : ''}</th><th>Open jobs</th><th>Free capacity</th></tr></thead>
                <tbody>{perfRows.map(r => (
                  <tr key={r.t.id}><td>{r.t.avatar} {r.t.name}</td><td>{(r.t.skills||[]).join(', ')}</td><td>{r.done}</td><td>{r.visits}</td><td>{r.open}</td>
                    <td><span className={`badge badge-${r.open < APP_SETTINGS.technicianMaxJobs ? 'success' : 'danger'}`}>{Math.max(0, APP_SETTINGS.technicianMaxJobs - r.open)} of {APP_SETTINGS.technicianMaxJobs}</span></td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div className="search-bar" style={{ flex:1 }}>
          <Search size={15} color="var(--text-muted)" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by job ID, customer, or description…" />
        </div>
        <select className="form-select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ width:160 }}>
          <option value="all">All Status</option>
          {STATUS_FLOW.map(s=><option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select className="form-select" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{ width:150 }}>
          <option value="all">All Types</option>
          <option value="installation">Installation</option>
          <option value="repair">Repair</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>

      {/* Job Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))', gap:16 }}>
        {filtered.length === 0 && (
          <div className="empty-state" style={{ gridColumn:'1/-1' }}>
            <div className="empty-state-icon">🔧</div>
            <div id="no-jobs" className="empty-state-title">{isTech && visibleJobs.length === 0 ? 'No service jobs assigned to you' : 'No service jobs found'}</div>
          </div>
        )}
        {filtered.map(j => {
          const customer = getCustomer(j.customerId);
          const tech = getUser(j.assignedTo);
          const product = getProduct(j.productId);
          return (
            <div
              key={j.id}
              id={`job-card-${j.id}`}
              className="job-card"
              style={{ cursor:'pointer' }}
              onClick={() => setDetail(j)}
            >
              <div className="job-card-header">
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:20 }}>{TYPE_ICON[j.type]}</span>
                    <span className="job-id" style={{ fontFamily:'var(--font-mono)' }}>{j.id}</span>
                    <span className={`badge badge-${PRIORITY_COLOR[j.priority]}`}>{j.priority}</span>
                  </div>
                  <div className="job-title">{j.type.charAt(0).toUpperCase()+j.type.slice(1)} — {customer?.name}</div>
                </div>
                <span className={`badge badge-${STATUS_COLOR[j.status]}`}>{j.status.replace('-',' ')}</span>
              </div>
              <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:10, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                {j.description}
              </div>
              <div className="job-meta">
                {product && <span>📦 {product.name}</span>}
                <span>👤 {tech ? tech.name : 'Unassigned'}</span>
                {isTech && customer && <span>📞 {customer.phone}</span>}
                {isTech && (j.address || customer?.address) && <span>📍 {j.address || customer.address}</span>}
                {j.scheduledDate && <span>🗓️ {j.scheduledDate}</span>}
                <span>📅 {j.createdAt}</span>
                {canDo('service.bill') && <span>💰 {fmt(j.serviceFee || 0)} · {j.billingStatus || 'unbilled'}</span>}
                <span className={`badge badge-${j.warrantyValid?'success':'danger'}`} style={{ fontSize:10 }}>{j.warrantyValid?'Warranty':'No Warranty'}</span>
              </div>
              {j.visits?.length > 0 && (
                <div style={{ marginTop:8, fontSize:12, color:'var(--text-muted)' }}>
                  💬 {j.visits.length} visit{j.visits.length!==1?'s':''} · Last: {j.visits[j.visits.length-1]?.date}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal && <JobModal job={modal==='new'?null:modal} onClose={()=>setModal(null)} onSave={handleCreate} />}
      {detail && <JobDetailModal job={detail} onClose={()=>setDetail(null)} onUpdate={handleUpdate} />}
    </div>
  );
}
