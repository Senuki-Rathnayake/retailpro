import { useState, useMemo } from 'react';
import { Search, Plus, ShoppingCart, Trash2, X, User, CheckCircle, CreditCard } from 'lucide-react';
import {
  PRODUCTS, CUSTOMERS, CATEGORIES, SALES_ORDERS, PAYMENTS, STOCK_MOVEMENTS,
  fmt, newSaleId, newInvNo, newPayId, newSmId, checkPromotion
} from '../data/store';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

function CheckoutModal({ cart, customer, onClose, onConfirm }) {
  const [method, setMethod] = useState('cash');
  const [isCreditSale, setIsCreditSale] = useState(false);
  const [delivery, setDelivery] = useState(false);
  const [installation, setInstallation] = useState(false);
  const [amountPaid, setAmountPaid] = useState(cart.reduce((s,i)=>s+i.total,0));
  const [discount, setDiscount] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [promo, setPromo] = useState(null);      // { ok, amount, discount, message }

  const subtotal = cart.reduce((s,i)=>s+i.unitPrice*i.qty,0);
  // SD 22 applyPromotion(code): checked against dates and minimum order value
  const applyPromo = () => setPromo(checkPromotion(promoCode, subtotal - discount));
  const promoAmount = promo?.ok ? promo.amount : 0;
  const grandTotal = subtotal - discount - promoAmount;
  const balance = grandTotal - (isCreditSale ? amountPaid : grandTotal);
  const creditAvail = customer ? (customer.creditLimit - customer.creditUsed) : 0;
  const creditOver = isCreditSale && (customer?.creditUsed + balance) > customer?.creditLimit;

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <CreditCard size={20} color="var(--primary-400)" />
          <div className="modal-title">Checkout</div>
        </div>
        <div className="modal-body">
          {/* Customer */}
          <div style={{ background:'var(--bg-overlay)', borderRadius:8, padding:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>Customer</div>
              <div style={{ fontWeight:700, color:'var(--text-primary)' }}>{customer?.name || 'Walk-in Customer'}</div>
            </div>
            {customer && <div style={{ fontSize:12, color:'var(--success-400)' }}>Credit available: {fmt(creditAvail)}</div>}
          </div>

          {/* Summary */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {cart.map(i => (
              <div key={i.productId} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--text-secondary)' }}>
                <span>{i.name} × {i.qty}</span>
                <span style={{ fontFamily:'var(--font-mono)' }}>{fmt(i.unitPrice*i.qty)}</span>
              </div>
            ))}
            <div className="divider" />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
              <span className="text-muted">Subtotal</span>
              <span style={{ fontFamily:'var(--font-mono)' }}>{fmt(subtotal)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13 }}>
              <span className="text-muted">Discount</span>
              <input
                type="number" value={discount}
                onChange={e=>setDiscount(+e.target.value)}
                style={{ width:100, textAlign:'right', background:'var(--bg-elevated)', border:'1px solid var(--border-default)', borderRadius:6, padding:'4px 8px', color:'var(--text-primary)', fontFamily:'var(--font-mono)', fontSize:13 }}
              />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, fontSize:13 }}>
              <span className="text-muted">Promotion code</span>
              <div style={{ display:'flex', gap:6 }}>
                <input id="promo-code" className="form-input" value={promoCode} onChange={e=>{ setPromoCode(e.target.value); setPromo(null); }} placeholder="e.g. NEWYEAR10" style={{ width:130, padding:'4px 8px', fontSize:13 }} />
                <button id="btn-apply-promo" className="btn btn-outline btn-sm" disabled={!promoCode.trim()} onClick={applyPromo}>Apply</button>
              </div>
            </div>
            {promo && (
              <div id="promo-result" style={{ fontSize:12, color: promo.ok ? 'var(--success-400)' : 'var(--danger-400)', textAlign:'right' }}>
                {promo.ok ? `${promo.message} – ${fmt(promo.amount)} off` : promo.message}
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:17, fontWeight:800, borderTop:'1px solid var(--border-subtle)', paddingTop:8 }}>
              <span>Grand Total</span>
              <span style={{ color:'var(--primary-300)', fontFamily:'var(--font-mono)' }}>{fmt(grandTotal)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select className="form-select" value={method} onChange={e=>setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="transfer">Bank Transfer</option>
            </select>
          </div>

          {/* sales_order.delivery_required / installation_required */}
          <div style={{ display:'flex', gap:18, marginBottom:8 }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
              <input id="pos-delivery" type="checkbox" checked={delivery} onChange={e=>setDelivery(e.target.checked)} /> Delivery required
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
              <input id="pos-installation" type="checkbox" checked={installation} onChange={e=>setInstallation(e.target.checked)} /> Installation required
            </label>
          </div>
          {(delivery || installation) && <div className="form-hint" style={{ marginTop:-4, marginBottom:8 }}>After the sale, register the delivery / installation in Service Jobs (linked to this order).</div>}

          {/* Credit Sale toggle */}
          {customer && (
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13 }}>
              <input type="checkbox" checked={isCreditSale} onChange={e=>setIsCreditSale(e.target.checked)} style={{ width:16, height:16 }} />
              <span style={{ color:'var(--text-secondary)' }}>Record as credit sale (partial payment)</span>
            </label>
          )}
          {isCreditSale && (
            <div className="form-group">
              <label className="form-label">Amount Paid Now (LKR)</label>
              <input type="number" className="form-input" value={amountPaid} onChange={e=>setAmountPaid(+e.target.value)} max={grandTotal} />
              <span className="form-hint">Remaining balance: {fmt(grandTotal - amountPaid)} will be added to customer credit</span>
            </div>
          )}
          {creditOver && (
            <div className="alert alert-danger"><span>⚠️ This would exceed the customer's credit limit!</span></div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" disabled={creditOver} onClick={() => onConfirm({ method, isCreditSale, amountPaid: isCreditSale ? amountPaid : grandTotal, discount: discount + promoAmount, promoCode: promo?.ok ? promo.discount.code : null, grandTotal, deliveryRequired: delivery, installationRequired: installation })}>
            <CheckCircle size={15} /> Confirm Sale
          </button>
        </div>
      </div>
    </div>
  );
}

export default function POSPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);

  const filteredProducts = useMemo(() => PRODUCTS.filter(p =>
    (catFilter === 'all' || p.category === catFilter) &&
    (p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()))
  ), [q, catFilter]);

  const filteredCustomers = useMemo(() => CUSTOMERS.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)
  ).slice(0,5), [customerSearch]);

  const cartTotal = cart.reduce((s,i) => s + i.total, 0);
  const cartCount = cart.reduce((s,i) => s + i.qty, 0);

  const addToCart = (product) => {
    if (product.stock <= 0) return toast.error('Product is out of stock');
    setCart(c => {
      const ex = c.find(i => i.productId === product.id);
      if (ex) {
        if (ex.qty >= product.stock) { toast.warning('Not enough stock'); return c; }
        return c.map(i => i.productId === product.id ? { ...i, qty: i.qty+1, total: (i.qty+1)*i.unitPrice } : i);
      }
      return [...c, { productId: product.id, name: product.name, unitPrice: product.price, qty:1, total: product.price }];
    });
  };

  const updateQty = (productId, delta) => {
    setCart(c => c.map(i => i.productId === productId ? { ...i, qty: Math.max(1,i.qty+delta), total: Math.max(1,i.qty+delta)*i.unitPrice } : i)
                  .filter(i => !(i.productId === productId && i.qty + delta < 1)));
  };

  const removeItem = (productId) => setCart(c => c.filter(i => i.productId !== productId));

  const handleConfirm = ({ method, isCreditSale, amountPaid, discount, promoCode, grandTotal, deliveryRequired = false, installationRequired = false }) => {
    const invNo = newInvNo();
    const soId = newSaleId();
    const today = format(new Date(), 'yyyy-MM-dd');
    // SD 22: check stock again at confirm time; if short, the order is kept on hold (no payment, no stock change)
    const short = cart.filter(i => (PRODUCTS.find(x => x.id === i.productId)?.stock ?? 0) < i.qty);
    if (short.length) {
      SALES_ORDERS.push({ id: soId, invoiceNo: null, customerId: selectedCustomer?.id || null, date: today,
        items: cart.map(i => ({ ...i, discount:0 })), subtotal: cart.reduce((s,i)=>s+i.unitPrice*i.qty,0), discountTotal: discount,
        tax:0, taxRate:0, grandTotal, paymentMethod: method, paymentStatus:'unpaid', amountPaid:0, balance: grandTotal,
        creditSale:false, deliveryRequired, installationRequired, status:'on-hold', holdReason: `Insufficient stock: ${short.map(i => i.name).join(', ')}`, createdBy: user?.id });
      setCart([]); setSelectedCustomer(null); setShowCheckout(false);
      toast.warning(`Insufficient stock – order ${soId} placed on hold`);
      return;
    }
    const balance = grandTotal - amountPaid;

    const order = {
      id: soId, invoiceNo: invNo,
      customerId: selectedCustomer?.id || null,
      date: today,
      items: cart.map(i => ({ ...i, discount:0, total: i.total })),
      subtotal: cart.reduce((s,i)=>s+i.unitPrice*i.qty,0),
      discountTotal: discount, promoCode, tax:0, taxRate:0,
      grandTotal, paymentMethod: method,
      paymentStatus: isCreditSale && balance > 0 ? 'partial' : 'paid',
      amountPaid, balance,
      creditSale: isCreditSale, deliveryRequired, installationRequired, status:'completed', createdBy: user?.id,
    };
    SALES_ORDERS.push(order);

    // Record payment
    PAYMENTS.push({ id: newPayId(), customerId: selectedCustomer?.id, salesOrderId: soId, amount: amountPaid, method, date: today, recordedBy: user?.id, note: `Sale ${invNo}` });

    // Update stock
    cart.forEach(item => {
      const p = PRODUCTS.find(x => x.id === item.productId);
      if (p) {
        p.stock -= item.qty;
        STOCK_MOVEMENTS.push({ id: newSmId(), productId: p.id, type:'out', qty: item.qty, ref: soId, note:'Sale', date: today, userId: user?.id });
      }
    });

    // Update customer credit
    if (isCreditSale && selectedCustomer && balance > 0) {
      const ci = CUSTOMERS.findIndex(c => c.id === selectedCustomer.id);
      if (ci !== -1) { CUSTOMERS[ci].creditUsed += balance; }
    }

    setLastInvoice({ ...order, customerName: selectedCustomer?.name || 'Walk-in' });
    setCart([]);
    setSelectedCustomer(null);
    setShowCheckout(false);
    toast.success(`Sale recorded — ${invNo}`);
  };

  if (lastInvoice) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
        <div className="card-elevated" style={{ maxWidth:480, width:'100%', textAlign:'center', padding:40 }}>
          <div style={{ fontSize:60, marginBottom:16 }}>✅</div>
          <h2 style={{ fontSize:22, fontWeight:800, color:'var(--success-400)', marginBottom:8 }}>Sale Complete!</h2>
          <div style={{ color:'var(--text-muted)', marginBottom:24 }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:20, fontWeight:700, color:'var(--text-primary)', margin:'8px 0' }}>{lastInvoice.invoiceNo}</div>
            <div>Customer: <strong>{lastInvoice.customerName}</strong></div>
            <div>Total: <strong style={{ color:'var(--primary-300)', fontFamily:'var(--font-mono)' }}>{fmt(lastInvoice.grandTotal)}</strong></div>
            <div>Paid: <strong style={{ fontFamily:'var(--font-mono)' }}>{fmt(lastInvoice.amountPaid)}</strong></div>
            {lastInvoice.balance > 0 && <div style={{ color:'var(--warning-400)' }}>Balance Due: {fmt(lastInvoice.balance)}</div>}
          </div>
          <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={() => setLastInvoice(null)}>
            <ShoppingCart size={16}/> New Sale
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Point of Sale</h1>
          <p className="page-subtitle">Create a new sale transaction</p>
        </div>
      </div>

      <div className="pos-layout">
        {/* Left: Products */}
        <div style={{ display:'flex', flexDirection:'column', gap:14, overflow:'hidden' }}>
          {/* Customer selector */}
          <div className="card-elevated" style={{ padding:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>Customer (optional)</div>
            {selectedCustomer ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <User size={18} color="var(--primary-400)" />
                  <div>
                    <div style={{ fontWeight:600 }}>{selectedCustomer.name}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>Credit: {fmt(selectedCustomer.creditLimit - selectedCustomer.creditUsed)} available</div>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedCustomer(null)}><X size={14}/></button>
              </div>
            ) : (
              <div style={{ position:'relative' }}>
                <div className="search-bar">
                  <User size={14} color="var(--text-muted)" />
                  <input value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} placeholder="Search customer by name or phone…" />
                </div>
                {customerSearch && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:50, background:'var(--bg-elevated)', border:'1px solid var(--border-default)', borderRadius:8, marginTop:4, overflow:'hidden' }}>
                    {filteredCustomers.length === 0 ? (
                      <div style={{ padding:12, fontSize:13, color:'var(--text-muted)', textAlign:'center' }}>No customers found</div>
                    ) : filteredCustomers.map(c => (
                      <div key={c.id} style={{ padding:'10px 14px', cursor:'pointer', fontSize:13, borderBottom:'1px solid var(--border-subtle)' }}
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
                        onMouseLeave={e=>e.currentTarget.style.background=''}
                      >
                        <div style={{ fontWeight:600, color:'var(--text-primary)' }}>{c.name}</div>
                        <div style={{ fontSize:11.5, color:'var(--text-muted)' }}>{c.phone} · Credit: {fmt(c.creditLimit - c.creditUsed)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search + Category filter */}
          <div style={{ display:'flex', gap:10 }}>
            <div className="search-bar" style={{ flex:1 }}>
              <Search size={15} color="var(--text-muted)" />
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search products…" />
            </div>
            <select className="form-select" value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{ width:160 }}>
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Product Grid */}
          <div className="pos-product-grid" style={{ flex:1, overflowY:'auto' }}>
            {filteredProducts.map(p => (
              <div
                key={p.id}
                id={`pos-product-${p.id}`}
                className={`pos-product-card ${p.stock <= 0 ? 'out-of-stock' : ''}`}
                onClick={() => addToCart(p)}
              >
                <div className="pos-product-emoji">{p.emoji}</div>
                <div className="pos-product-name">{p.name}</div>
                <div className="pos-product-price">{fmt(p.price)}</div>
                <div className="pos-product-stock" style={{ color: p.stock <= p.minStock ? 'var(--warning-400)' : 'var(--text-muted)' }}>
                  {p.stock <= 0 ? 'Out of stock' : `${p.stock} in stock`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="pos-cart">
          <div className="pos-cart-header">
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <ShoppingCart size={16} color="var(--primary-400)" />
              <span>Cart</span>
              {cartCount > 0 && <span className="badge badge-primary">{cartCount} item{cartCount!==1?'s':''}</span>}
            </div>
          </div>

          <div className="pos-cart-items">
            {cart.length === 0 ? (
              <div className="empty-state" style={{ padding:'40px 16px' }}>
                <div className="empty-state-icon">🛒</div>
                <div className="empty-state-title">Cart is empty</div>
                <div className="empty-state-desc">Click products to add them</div>
              </div>
            ) : cart.map(item => (
              <div key={item.productId} className="pos-cart-item">
                <div className="pos-cart-item-name">{item.name}</div>
                <div className="pos-cart-item-qty">
                  <button className="pos-qty-btn" onClick={() => updateQty(item.productId, -1)}>−</button>
                  <span style={{ minWidth:20, textAlign:'center', fontSize:14, fontWeight:700 }}>{item.qty}</span>
                  <button className="pos-qty-btn" onClick={() => updateQty(item.productId, +1)}>+</button>
                </div>
                <div className="pos-cart-item-price">{fmt(item.total)}</div>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeItem(item.productId)} style={{ color:'var(--danger-400)' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {cart.length > 0 && (
            <div className="pos-cart-footer">
              <div className="pos-cart-total">
                <span className="pos-cart-total-label">Total</span>
                <span className="pos-cart-total-value">{fmt(cartTotal)}</span>
              </div>
              <button
                id="pos-checkout-btn"
                className="btn btn-success"
                style={{ width:'100%', justifyContent:'center', padding:'12px' }}
                onClick={() => setShowCheckout(true)}
              >
                <CheckCircle size={16} /> Checkout
              </button>
              <button className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', marginTop:6, fontSize:12 }} onClick={() => setCart([])}>
                Clear Cart
              </button>
            </div>
          )}
        </div>
      </div>

      {showCheckout && (
        <CheckoutModal cart={cart} customer={selectedCustomer} onClose={() => setShowCheckout(false)} onConfirm={handleConfirm} />
      )}
    </div>
  );
}
