import { useState } from 'react';
import { Search, Plus, Star, Phone, Mail, Building, Ban, RotateCcw } from 'lucide-react';
import { SUPPLIERS, PURCHASE_ORDERS, fmt, isValidPhone, isValidEmail, newSupplierId } from '../data/store';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

function SupplierModal({ supplier, onClose, onSave }) {
  const [form, setForm] = useState(supplier || { name:'', contact:'', phone:'', email:'', address:'', paymentTerms:30, leadTime:7, rating:4 });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <Building size={18} color="var(--warning-400)" />
          <div className="modal-title">{supplier ? 'Edit Supplier' : 'New Supplier'}</div>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Company Name *</label>
            <input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Supplier company name" />
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input className="form-input" value={form.contact} onChange={e=>set('contact',e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input id="sup-phone" className="form-input" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="011XXXXXXX" />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input id="sup-email" className="form-input" type="email" value={form.email} onChange={e=>set('email',e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Terms (days)</label>
              <input id="sup-terms" className="form-input" type="number" min={0} max={180} value={form.paymentTerms} onChange={e=>set('paymentTerms',+e.target.value)} />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Lead Time (days)</label>
              <input id="sup-lead" className="form-input" type="number" min={0} max={365} value={form.leadTime ?? ''} onChange={e=>set('leadTime', e.target.value === '' ? null : +e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input id="sup-address" className="form-input" value={form.address || ''} onChange={e=>set('address',e.target.value)} placeholder="Street, City" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button id="sup-save" className="btn btn-primary" disabled={!form.name} onClick={()=>onSave(form)}>
            {supplier ? 'Save' : 'Create Supplier'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StarRating({ rating }) {
  return (
    <div style={{ display:'flex', gap:2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={13} fill={i<=rating?'var(--warning-400)':'none'} stroke={i<=rating?'var(--warning-400)':'var(--text-muted)'} />
      ))}
      <span style={{ fontSize:12, color:'var(--text-muted)', marginLeft:4 }}>{rating}</span>
    </div>
  );
}

export default function SuppliersPage() {
  const toast = useToast();
  const { canDo } = useAuth();
  const [suppliers, setSuppliers] = useState(() => [...SUPPLIERS]);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.contact?.toLowerCase().includes(q.toLowerCase())
  );

  const [history, setHistory] = useState(null);   // SD 44 supplier history and performance
  const [newRating, setNewRating] = useState(4);

  // SD 43: contact details and payment terms are checked before saving
  const validSupplier = (f) => f.contact?.trim() && isValidPhone(f.phone) && f.email && isValidEmail(f.email) &&
    Number.isInteger(Number(f.paymentTerms)) && f.paymentTerms >= 0 && f.paymentTerms <= 180;
  const handleSave = (form) => {
    if (!validSupplier(form)) { toast.error('Invalid contact or payment terms'); return; }
    if (!modal || modal === 'new') {
      const newS = { ...form, id:newSupplierId(), outstanding:0 };
      SUPPLIERS.push(newS);
      setSuppliers(ss => [...ss, newS]);
      toast.success('Supplier created');
    } else {
      setSuppliers(ss => ss.map(s => s.id===modal.id?{...s,...form}:s));
      const i = SUPPLIERS.findIndex(s=>s.id===modal.id);
      if (i!==-1) SUPPLIERS[i]={...SUPPLIERS[i],...form};
      toast.success('Supplier updated');
    }
    setModal(null);
  };

  // Open orders = purchase orders not yet received or cancelled
  const openOrders = (id) => PURCHASE_ORDERS.filter(po => po.supplierId === id && !['received', 'cancelled'].includes(po.status));
  const isInactive = (s) => s.status === 'inactive';

  // Delete a supplier = mark inactive (soft delete). The supplier stays in the
  // database because purchase orders, quotations and payables refer to it.
  const markInactive = (s) => {
    const open = openOrders(s.id);
    if (open.length > 0) {
      toast.error(`Cannot deactivate – open orders exist (${open.map(o => o.id).join(', ')})`);
      return;
    }
    if (!confirm(`Mark ${s.name} as inactive? It will no longer be offered for new purchase orders.`)) return;
    setStatus(s.id, 'inactive');
    toast.success(`${s.name} marked inactive`);
  };
  const reactivate = (s) => {
    setStatus(s.id, 'active');
    toast.success(`${s.name} is active again`);
  };
  const setStatus = (id, status) => {
    const i = SUPPLIERS.findIndex(x => x.id === id);
    if (i !== -1) SUPPLIERS[i] = { ...SUPPLIERS[i], status };
    setSuppliers(ss => ss.map(x => (x.id === id ? { ...x, status } : x)));
  };

  const openHistory = (s) => { setHistory(s); setNewRating(s.rating); };
  const saveRating = () => {
    const i = SUPPLIERS.findIndex(x => x.id === history.id);
    if (i !== -1) SUPPLIERS[i] = { ...SUPPLIERS[i], rating: newRating };
    setSuppliers(ss => ss.map(x => (x.id === history.id ? { ...x, rating: newRating } : x)));
    setHistory(h => ({ ...h, rating: newRating }));
    toast.success(`Supplier rating updated – ${history.name} is now ${newRating} / 5`);
  };
  const supplierOrderCount = (id) => PURCHASE_ORDERS.filter(po=>po.supplierId===id).length;
  const supplierTotalValue = (id) => PURCHASE_ORDERS.filter(po=>po.supplierId===id).reduce((s,po)=>s+po.grandTotal,0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">{suppliers.filter(s => !isInactive(s)).length} active suppliers{suppliers.some(isInactive) ? ` · ${suppliers.filter(isInactive).length} inactive` : ''}</p>
        </div>
        <div className="page-header-actions">
          {canDo('supplier.add') && (
            <button id="btn-new-supplier" className="btn btn-primary" onClick={()=>setModal('new')}>
              <Plus size={14}/> New Supplier
            </button>
          )}
        </div>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        <div className="search-bar" style={{ flex:1 }}>
          <Search size={15} color="var(--text-muted)"/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search suppliers…" />
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:16 }}>
        {filtered.map(s => (
          <div key={s.id} className="card-elevated" style={{ padding:20, opacity: isInactive(s) ? 0.6 : 1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)', marginBottom:4 }}>{s.name}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'var(--font-mono)', display:'flex', alignItems:'center', gap:8 }}>
                  {s.id}
                  {isInactive(s) && <span className="badge badge-gray">Inactive</span>}
                </div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button id={`sup-history-${s.id}`} className="btn btn-ghost btn-sm" onClick={() => openHistory(s)}>History</button>
                {canDo('supplier.edit') && !isInactive(s) && <button className="btn btn-outline btn-sm" onClick={() => setModal(s)}>Edit</button>}
                {canDo('supplier.deactivate') && !isInactive(s) && (
                  <button className="btn btn-outline btn-sm" title="Mark supplier inactive" aria-label={`Mark ${s.name} inactive`} onClick={() => markInactive(s)}>
                    <Ban size={13} /> Mark inactive
                  </button>
                )}
                {canDo('supplier.deactivate') && isInactive(s) && (
                  <button className="btn btn-outline btn-sm" aria-label={`Reactivate ${s.name}`} onClick={() => reactivate(s)}>
                    <RotateCcw size={13} /> Reactivate
                  </button>
                )}
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:13, marginBottom:14 }}>
              <span style={{ display:'flex', gap:8, color:'var(--text-secondary)' }}><Building size={13}/>{s.contact}</span>
              <span style={{ display:'flex', gap:8, color:'var(--text-secondary)' }}><Phone size={13}/>{s.phone}</span>
              <span style={{ display:'flex', gap:8, color:'var(--text-secondary)' }}><Mail size={13}/>{s.email}</span>
              {s.address && <span style={{ display:'flex', gap:8, color:'var(--text-secondary)' }}>📍 {s.address}</span>}
              {s.leadTime != null && <span style={{ display:'flex', gap:8, color:'var(--text-secondary)' }}>🚚 Lead time {s.leadTime} days</span>}
            </div>

            <StarRating rating={s.rating} />

            <div className="divider" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, textAlign:'center' }}>
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.5 }}>Orders</div>
                <div style={{ fontWeight:700, fontSize:17 }}>{supplierOrderCount(s.id)}</div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.5 }}>Total Value</div>
                <div style={{ fontWeight:700, fontSize:14, color:'var(--primary-300)', fontFamily:'var(--font-mono)' }}>{fmt(supplierTotalValue(s.id))}</div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.5 }}>Terms</div>
                <div style={{ fontWeight:700, fontSize:17 }}>{s.paymentTerms}d</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {history && (() => {
        const pos = PURCHASE_ORDERS.filter(po => po.supplierId === history.id);
        const recv = pos.filter(po => po.status === 'received');
        const onTime = recv.filter(po => !po.expectedDate || !po.receivedDate || po.receivedDate <= po.expectedDate).length;
        return (
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setHistory(null)}>
            <div className="modal modal-lg" id="supplier-history">
              <div className="modal-header"><span style={{ fontSize:20 }}>📈</span><div className="modal-title">{history.name} – history and performance</div>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto' }} onClick={() => setHistory(null)}>✕</button></div>
              <div className="modal-body">
                {pos.length === 0 ? <div id="no-supplier-history" className="alert alert-info">No purchase history for this supplier</div> : (
                  <>
                    <div style={{ display:'flex', gap:24, fontSize:13, marginBottom:10 }}>
                      <span>Orders: <b>{pos.length}</b></span><span>Received: <b>{recv.length}</b></span>
                      <span>On time: <b>{recv.length ? Math.round(onTime * 100 / recv.length) : 0}%</b></span>
                      <span>Total value: <b>{fmt(pos.reduce((a, p) => a + p.grandTotal, 0))}</b></span>
                    </div>
                    <table className="table">
                      <thead><tr><th>PO</th><th>Date</th><th>Expected</th><th>Received</th><th>Total</th><th>Status</th></tr></thead>
                      <tbody>{pos.map(po => <tr key={po.id}><td>{po.id}</td><td>{po.date}</td><td>{po.expectedDate || '—'}</td><td>{po.receivedDate || '—'}</td><td>{fmt(po.grandTotal)}</td><td>{po.status}</td></tr>)}</tbody>
                    </table>
                  </>
                )}
                {canDo('supplier.rate') && (
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:12 }}>
                    <span style={{ fontSize:13 }}>Rating</span>
                    <select id="sup-rating" className="form-select" style={{ width:90 }} value={newRating} onChange={e => setNewRating(+e.target.value)}>
                      {[1,1.5,2,2.5,3,3.5,4,4.5,5].concat(history.rating % 0.5 ? [history.rating] : []).sort((a,b)=>a-b).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <button id="sup-rating-save" className="btn btn-primary btn-sm" disabled={newRating === history.rating} onClick={saveRating}>Update rating</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {modal && <SupplierModal supplier={modal==='new'?null:modal} onClose={()=>setModal(null)} onSave={handleSave} />}
    </div>
  );
}
