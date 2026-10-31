import { useState } from 'react';
import { Search, Eye, Receipt, FileText } from 'lucide-react';
import { SALES_ORDERS, CUSTOMERS, PRODUCTS, fmt, getCustomer, newestFirst } from '../data/store';

function InvoiceDetail({ order, onClose }) {
  const customer = getCustomer(order.customerId);
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <Receipt size={20} color="var(--primary-400)" />
          <div className="modal-title">Invoice {order.invoiceNo}</div>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto' }} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Invoice Header */}
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
            <div>
              <div style={{ fontSize:22, fontWeight:800, color:'var(--primary-300)', marginBottom:4 }}>🏪 RetailPro</div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>Business Management Suite</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:16 }}>{order.invoiceNo}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>{order.date}</div>
              <span className={`badge badge-${order.paymentStatus==='paid'?'success':order.paymentStatus==='partial'?'warning':'danger'}`}>
                {order.paymentStatus}
              </span>
            </div>
          </div>

          {/* Customer */}
          {customer && (
            <div style={{ background:'var(--bg-overlay)', borderRadius:8, padding:14, marginBottom:16 }}>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:.5 }}>Bill To</div>
              <div style={{ fontWeight:700, fontSize:15 }}>{customer.name}</div>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>{customer.phone} · {customer.email}</div>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>{customer.address}</div>
            </div>
          )}

          {/* Line Items */}
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>Total</th></tr></thead>
              <tbody>
                {order.items.map((item,i) => (
                  <tr key={i}>
                    <td style={{ fontWeight:600 }}>{item.name}</td>
                    <td>{item.qty}</td>
                    <td style={{ fontFamily:'var(--font-mono)' }}>{fmt(item.unitPrice)}</td>
                    <td style={{ fontFamily:'var(--font-mono)', color:'var(--success-400)' }}>{item.discount>0?`-${fmt(item.discount)}`:'—'}</td>
                    <td style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end', marginTop:16 }}>
            <div style={{ display:'flex', gap:40, fontSize:13 }}><span className="text-muted">Subtotal</span><span style={{ fontFamily:'var(--font-mono)' }}>{fmt(order.subtotal)}</span></div>
            {order.discountTotal > 0 && <div style={{ display:'flex', gap:40, fontSize:13 }}><span className="text-muted">Discount</span><span style={{ fontFamily:'var(--font-mono)', color:'var(--success-400)' }}>−{fmt(order.discountTotal)}</span></div>}
            <div style={{ height:1, width:200, background:'var(--border-default)' }} />
            <div style={{ display:'flex', gap:40, fontSize:18, fontWeight:800 }}><span>Grand Total</span><span style={{ fontFamily:'var(--font-mono)', color:'var(--primary-300)' }}>{fmt(order.grandTotal)}</span></div>
            <div style={{ display:'flex', gap:40, fontSize:13 }}><span className="text-muted">Paid</span><span style={{ fontFamily:'var(--font-mono)', color:'var(--success-400)' }}>{fmt(order.amountPaid)}</span></div>
            {order.balance > 0 && <div style={{ display:'flex', gap:40, fontSize:13 }}><span className="text-muted">Balance Due</span><span style={{ fontFamily:'var(--font-mono)', color:'var(--danger-400)' }}>{fmt(order.balance)}</span></div>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Print</button>
        </div>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detail, setDetail] = useState(null);

  const filtered = SALES_ORDERS.filter(o => {
    const c = getCustomer(o.customerId);
    return (statusFilter === 'all' || o.paymentStatus === statusFilter) &&
      (!q || o.invoiceNo.toLowerCase().includes(q.toLowerCase()) || c?.name.toLowerCase().includes(q.toLowerCase()));
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">{SALES_ORDERS.length} total invoices</p>
        </div>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        <div className="search-bar" style={{ flex:1 }}>
          <Search size={15} color="var(--text-muted)"/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search invoice or customer…" />
        </div>
        <select className="form-select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ width:160 }}>
          <option value="all">All Status</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr><th>Invoice #</th><th>Customer</th><th>Date</th><th>Items</th><th>Grand Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>View</th></tr>
          </thead>
          <tbody>
            {newestFirst(filtered).map(o => {
              const c = getCustomer(o.customerId);
              return (
                <tr key={o.id}>
                  <td><span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:13 }}>{o.invoiceNo}</span></td>
                  <td style={{ fontWeight:600 }}>{c?.name || 'Walk-in'}</td>
                  <td style={{ fontSize:12 }}>{o.date}</td>
                  <td><span className="badge badge-gray">{o.items.length} item{o.items.length!==1?'s':''}</span></td>
                  <td><span style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{fmt(o.grandTotal)}</span></td>
                  <td><span style={{ fontFamily:'var(--font-mono)', color:'var(--success-400)' }}>{fmt(o.amountPaid)}</span></td>
                  <td><span style={{ fontFamily:'var(--font-mono)', color: o.balance>0?'var(--danger-400)':'var(--text-secondary)' }}>{fmt(o.balance)}</span></td>
                  <td><span className={`badge badge-${o.paymentStatus==='paid'?'success':o.paymentStatus==='partial'?'warning':'danger'}`}>{o.paymentStatus}</span></td>
                  <td>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDetail(o)} title="View Invoice">
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detail && <InvoiceDetail order={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
