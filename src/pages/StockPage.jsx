import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Eye, Package, TrendingDown, TrendingUp, AlertTriangle, BarChart2, Edit2, Plus, Trash2, ShieldCheck, BellRing, CheckCircle2 } from 'lucide-react';
import { PRODUCTS, CATEGORIES, SUPPLIERS, STOCK_MOVEMENTS, SALES_ORDERS, PURCHASE_ORDERS, SERVICE_JOBS, BATCHES, REORDER_REQUESTS, getLowStockProducts, newReorderId, fmt, newSmId, newProductId, lowStockFirst, newestFirst } from '../data/store';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { ReceivePurchaseTab, BatchesTab, VerifyStockModal, SparePartsTab, CategoriesTab } from '../components/StockExtras';

function ProductModal({ product, onClose, onSave }) {
  const [form, setForm] = useState(product || {
    name: '',
    sku: '',
    category: 'CAT001',
    price: 50000,
    cost: 35000,
    stock: 10,
    minStock: 3,
    unit: 'pcs',
    serial: true,
    warranty: 12,
    supplierId: 'SUP001',
    condition: 'new',
    description: '',
    emoji: '📦'
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const emojis = ['❄️', '🧊', '🫧', '📺', '⚡', '🔧', '🔌', '📦'];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span style={{ fontSize: 20 }}>{product ? '✏️' : '✨'}</span>
          <div className="modal-title">{product ? `Edit Product — ${product.sku}` : 'Add New Product / SKU'}</div>
        </div>
        <div className="modal-body">
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Intel Core i5-14400F Processor"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">SKU / Item Code *</label>
              <input
                className="form-input"
                value={form.sku}
                onChange={e => set('sku', e.target.value)}
                placeholder="e.g. CPU-I5-14400F"
                required
              />
            </div>
          </div>

          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select className="form-select" value={form.supplierId} onChange={e => set('supplierId', e.target.value)}>
                {SUPPLIERS.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Unit of Measure</label>
              <input className="form-input" value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="pcs, sets, units" />
            </div>
          </div>

          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Selling Price (LKR) *</label>
              <input type="number" className="form-input" value={form.price} onChange={e => set('price', +e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Cost Price (LKR) *</label>
              <input type="number" className="form-input" value={form.cost} onChange={e => set('cost', +e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Warranty (Months)</label>
              <input type="number" className="form-input" value={form.warranty} onChange={e => set('warranty', +e.target.value)} />
            </div>
          </div>

          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Initial Stock Qty</label>
              <input type="number" className="form-input" value={form.stock} onChange={e => set('stock', +e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Minimum Safety Stock</label>
              <input type="number" className="form-input" value={form.minStock} onChange={e => set('minStock', +e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Product Icon</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {emojis.map(em => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => set('emoji', em)}
                    style={{
                      fontSize: 16,
                      padding: '4px 6px',
                      borderRadius: 6,
                      border: form.emoji === em ? '2px solid var(--primary-500)' : '1px solid var(--border-default)',
                      background: form.emoji === em ? 'var(--primary-50)' : 'var(--bg-elevated)',
                      cursor: 'pointer'
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea id="prod-description" className="form-textarea" rows={2} value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Short description of the product" />
            </div>
            <div className="form-group">
              <label className="form-label">Condition</label>
              <select id="prod-condition" className="form-select" value={form.condition || 'new'} onChange={e => set('condition', e.target.value)}>
                <option value="new">New</option>
                <option value="refurbished">Refurbished</option>
                <option value="open-box">Open box</option>
                <option value="used">Used</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={form.serial}
                onChange={e => set('serial', e.target.checked)}
              />
              Track Serial / Batch Numbers for this product (Enables warranty traceability)
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!form.name || !form.sku || form.price <= 0}
            onClick={() => onSave(form)}
          >
            {product ? 'Save Product Changes' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdjustModal({ product, onClose, onSave }) {
  const [qty, setQty] = useState(0);
  const [note, setNote] = useState('');
  const [type, setType] = useState('adj');
  const [serialBatch, setSerialBatch] = useState('');
  const newStock = product.stock + (type === 'adj' ? qty : type === 'in' ? +Math.abs(qty) : -Math.abs(qty));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span style={{ fontSize: 20 }}>📊</span>
          <div className="modal-title">Stock Adjustment — {product.name}</div>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 12, background: 'var(--bg-overlay)', borderRadius: 8, padding: 12, marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Current Stock</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-primary)' }}>{product.stock}</div>
            </div>
            <div style={{ width: 1, background: 'var(--border-subtle)' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Min Stock</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--warning-400)' }}>{product.minStock}</div>
            </div>
            <div style={{ width: 1, background: 'var(--border-subtle)' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>After Adjustment</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: newStock < 0 ? 'var(--danger-400)' : newStock <= product.minStock ? 'var(--warning-400)' : 'var(--success-400)' }}>
                {newStock}
              </div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Adjustment Type</label>
            <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
              <option value="adj">Manual Adjustment / Stock Audit Count</option>
              <option value="in">Stock In (Purchase receiving / Return addition)</option>
              <option value="out">Stock Out (Damaged / Return write-off)</option>
            </select>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input type="number" className="form-input" value={qty} onChange={e => setQty(+e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Batch / Serial Tag</label>
              <input className="form-input" value={serialBatch} onChange={e => setSerialBatch(e.target.value)} placeholder="e.g. BATCH-2026-A" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Reason / Note *</label>
            <textarea className="form-textarea" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Damaged unit write-off, count correction…" />
          </div>
          {newStock < 0 && <div className="alert alert-danger">⚠️ Stock cannot go below zero</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-warning" disabled={!note || newStock < 0} onClick={() => onSave({ qty, type, note, serialBatch })}>
            Apply Adjustment
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StockPage() {
  const toast = useToast();
  const { user, canDo, can } = useAuth();
  // Show the Actions column only to roles that have at least one stock action
  const showActions = canDo('stock.adjust') || canDo('product.edit') || canDo('product.delete');
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [adjusting, setAdjusting] = useState(null);
  const [productModal, setProductModal] = useState(null); // null | 'new' | product obj
  const [activeTab, setActiveTab] = useState('products');
  const [verifying, setVerifying] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // Open the right tab for the menu item that brought the user here
  useEffect(() => {
    setActiveTab(location.pathname === '/stock-movements' ? 'movements' : 'products');
  }, [location.pathname]);
  // Buttons elsewhere can ask this page to open a form / tab / filter; apply it once, then clear it
  useEffect(() => {
    if (!location.state) return;
    if (location.state?.filter) setStatusFilter(location.state.filter);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const [products, setProducts] = useState(() => [...PRODUCTS]);

  const filtered = products.filter(p =>
    (catFilter === 'all' || p.category === catFilter) &&
    (statusFilter === 'all' ||
      (statusFilter === 'low' && p.stock <= p.minStock && p.stock > 0) ||
      (statusFilter === 'out' && p.stock === 0) ||
      (statusFilter === 'ok' && p.stock > p.minStock)) &&
    (p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()))
  );

  const lowCount = products.filter(p => p.stock <= p.minStock && p.stock > 0).length;
  const outCount = products.filter(p => p.stock === 0).length;
  const okCount = products.filter(p => p.stock > p.minStock).length;

  const handleAdjust = ({ qty, type, note, serialBatch }) => {
    const p = adjusting;
    const delta = type === 'in' ? +Math.abs(qty) : type === 'out' ? -Math.abs(qty) : qty;
    // change the stock once: build the updated product, then put the same object in the shared data and the page list
    const pidx = PRODUCTS.findIndex(x => x.id === p.id);
    const updatedProduct = { ...(pidx !== -1 ? PRODUCTS[pidx] : p), stock: (pidx !== -1 ? PRODUCTS[pidx].stock : p.stock) + delta };
    if (pidx !== -1) PRODUCTS[pidx] = updatedProduct;
    setProducts(ps => ps.map(x => x.id === p.id ? updatedProduct : x));

    STOCK_MOVEMENTS.push({
      id: newSmId(),
      productId: p.id,
      type,
      qty: Math.abs(qty),
      ref: serialBatch ? `TAG:${serialBatch}` : 'ADJ',
      batchId: (serialBatch && BATCHES.find(b => b.productId === p.id && b.batchNo.toLowerCase() === serialBatch.trim().toLowerCase())?.id) || null,
      note: note + (serialBatch ? ` (Batch: ${serialBatch})` : ''),
      date: format(new Date(), 'yyyy-MM-dd'),
      userId: user?.id
    });

    toast.success(`Stock adjusted for ${p.name}`);
    setAdjusting(null);
  };

  const handleSaveProduct = (form) => {
    if (productModal === 'new') {
      const newP = {
        ...form,
        id: newProductId()
      };
      setProducts(ps => [...ps, newP]);
      PRODUCTS.push(newP);
      STOCK_MOVEMENTS.push({
        id: newSmId(),
        productId: newP.id,
        type: 'in',
        qty: newP.stock,
        ref: 'INIT',
        note: 'Initial catalog registration',
        date: format(new Date(), 'yyyy-MM-dd'),
        userId: user?.id
      });
      toast.success(`Product ${newP.name} added to catalog`);
    } else {
      const updated = { ...productModal, ...form };
      setProducts(ps => ps.map(p => p.id === productModal.id ? updated : p));
      const i = PRODUCTS.findIndex(p => p.id === productModal.id);
      if (i !== -1) PRODUCTS[i] = updated;
      toast.success(`Product ${updated.name} updated`);
    }
    setProductModal(null);
  };

  const handleDeleteProduct = (p) => {
    // a product that is on sales, purchase orders, batches or service jobs stays in the database (mark it obsolete instead)
    const used = SALES_ORDERS.some(o => o.items.some(i => i.productId === p.id)) || PURCHASE_ORDERS.some(o => o.items.some(i => i.productId === p.id)) ||
      SERVICE_JOBS.some(j => j.productId === p.id) || BATCHES.some(b => b.productId === p.id) || STOCK_MOVEMENTS.some(m => m.productId === p.id);
    if (used) { toast.error('This product is used in sales or other records, so it cannot be deleted. Mark it obsolete instead.'); return; }
    if (confirm(`Are you sure you want to delete SKU ${p.sku} (${p.name}) from catalog?`)) {
      setProducts(ps => ps.filter(x => x.id !== p.id));
      const idx = PRODUCTS.findIndex(x => x.id === p.id);
      if (idx !== -1) PRODUCTS.splice(idx, 1);
      toast.success(`Product ${p.name} deleted`);
    }
  };

  // SD 17: count the shelf, compare with the system, correct the differences
  const verifyConsistency = () => setVerifying(true);
  const reload = () => setProducts([...PRODUCTS]);

  const triggerLowStockAlert = () => {
    const lowItems = getLowStockProducts();
    if (lowItems.length > 0) {
      // one stock_alert row per low product (Purchasing sees it on the reorder list)
      let added = 0;
      lowItems.forEach(p => {
        if (REORDER_REQUESTS.some(a => a.productId === p.id && a.status === 'open')) return;
        REORDER_REQUESTS.push({ id: newReorderId(), alertType: 'low_stock', productId: p.id, qty: p.minStock,
          requestDate: format(new Date(), 'yyyy-MM-dd'), status: 'open', raisedBy: user?.id });
        added++;
      });
      toast.warning(`Low-Stock Alert Triggered: ${lowItems.length} items are at or below minimum safety levels!${added ? ` ${added} new alert${added > 1 ? 's' : ''} sent to Purchasing.` : ''}`);
    } else {
      toast.success('All inventory items are currently above safety thresholds.');
    }
  };

  const stockStatus = (p) => {
    if (p.obsolete) return { label: 'Obsolete', cls: 'gray' };
    if (p.stock === 0) return { label: 'Out of Stock', cls: 'danger' };
    if (p.stock <= p.minStock) return { label: 'Low Stock', cls: 'warning' };
    return { label: 'In Stock', cls: 'success' };
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{activeTab === 'movements' ? 'Stock Movements' : 'Stock & Inventory Management'}</h1>
          <p className="page-subtitle">Real-time inventory levels, serial numbers, and warehouse movements</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canDo('stock.verify') && (
            <button className="btn btn-outline" onClick={verifyConsistency} title="Verify stock consistency against ledger">
              <ShieldCheck size={15} /> Verify Consistency
            </button>
          )}
          {canDo('stock.alert') && (
            <button className="btn btn-outline" onClick={triggerLowStockAlert} title="Check and broadcast low-stock alerts">
              <BellRing size={15} color="var(--warning-400)" /> Trigger Low-Stock Alert
            </button>
          )}
          {canDo('product.add') && (
            <button id="btn-add-product" className="btn btn-primary" onClick={() => setProductModal('new')}>
              <Plus size={15} /> Add Product
            </button>
          )}
        </div>
      </div>

      {/* Stat row */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <div className="stat-card primary">
          <div className="stat-card-header"><span className="stat-card-label">Total SKUs</span><div className="stat-card-icon primary"><Package size={16} /></div></div>
          <div className="stat-card-value">{products.length}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-card-header"><span className="stat-card-label">Healthy Stock</span><div className="stat-card-icon success"><TrendingUp size={16} /></div></div>
          <div className="stat-card-value">{okCount}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-card-header"><span className="stat-card-label">Low Stock</span><div className="stat-card-icon warning"><AlertTriangle size={16} /></div></div>
          <div className="stat-card-value">{lowCount}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-card-header"><span className="stat-card-label">Out of Stock</span><div className="stat-card-icon danger"><TrendingDown size={16} /></div></div>
          <div className="stat-card-value">{outCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tabs">
          <button className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>📦 Products Catalog</button>
          <button className={`tab-btn ${activeTab === 'movements' ? 'active' : ''}`} onClick={() => setActiveTab('movements')}>🔄 Stock Movements</button>
          {canDo('stock.receive') && <button id="tab-receive" className={`tab-btn ${activeTab === 'receive' ? 'active' : ''}`} onClick={() => setActiveTab('receive')}>📥 Receive Purchase</button>}
          <button id="tab-batches" className={`tab-btn ${activeTab === 'batches' ? 'active' : ''}`} onClick={() => setActiveTab('batches')}>🏷️ Batches</button>
          <button id="tab-spares" className={`tab-btn ${activeTab === 'spares' ? 'active' : ''}`} onClick={() => setActiveTab('spares')}>🔧 Spare Parts</button>
          {can('categories') && <button id="tab-categories" className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>🗂️ Categories</button>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="search-bar">
            <Search size={15} color="var(--text-muted)" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products or SKU…" style={{ width: 190 }} />
          </div>
          <select className="form-select" value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ width: 150 }}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 140 }}>
            <option value="all">All Status</option>
            <option value="ok">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>

      {activeTab === 'products' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Product Information</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Safety Min</th>
                <th>Status</th>
                <th>Selling Price</th>
                <th>Unit Cost</th>
                {showActions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📦</div>
                      <div className="empty-state-title">No products found</div>
                    </div>
                  </td>
                </tr>
              )}
              {lowStockFirst(filtered).map(p => {
                const st = stockStatus(p);
                const cat = CATEGORIES.find(c => c.id === p.category);
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>{p.emoji}</span>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                            {p.serial && <span className="badge badge-accent" style={{ fontSize: 9.5, padding: '1px 5px' }}>Serial Tracked</span>}
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Warranty: {p.warranty}m</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.sku}</span></td>
                    <td>{cat?.icon} {cat?.name}</td>
                    <td>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 16, color: st.cls === 'danger' ? 'var(--danger-400)' : st.cls === 'warning' ? 'var(--warning-400)' : 'var(--text-primary)' }}>
                          {p.stock}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> {p.unit}</span>
                        <div style={{ marginTop: 3, height: 4, background: 'var(--bg-overlay)', borderRadius: 4, width: 80 }}>
                          <div
                            style={{
                              height: '100%',
                              borderRadius: 4,
                              width: `${Math.min(100, (p.stock / Math.max(p.minStock * 3, 1)) * 100)}%`,
                              background: st.cls === 'danger' ? 'var(--danger-500)' : st.cls === 'warning' ? 'var(--warning-500)' : 'var(--success-500)',
                              transition: 'width .3s'
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td><span style={{ color: 'var(--text-muted)' }}>{p.minStock}</span></td>
                    <td><span className={`badge badge-${st.cls}`}>{st.label}</span></td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>{fmt(p.price)}</span></td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>{fmt(p.cost)}</span></td>
                    {showActions && (<td>
                      <div className="table-action-cell">
                        {canDo('stock.adjust') && <button
                          id={`stock-adjust-${p.id}`}
                          className="btn btn-outline btn-sm"
                          onClick={() => setAdjusting(p)}
                          title="Adjust stock in/out"
                        >
                          Adjust
                        </button>}
                        {canDo('product.edit') && <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => setProductModal(p)}
                          title="Edit Product Details"
                        >
                          <Edit2 size={13} />
                        </button>}
                        {canDo('product.delete') && <button
                          className="btn btn-ghost btn-sm btn-icon"
                          style={{ color: 'var(--danger-400)' }}
                          onClick={() => handleDeleteProduct(p)}
                          title="Delete Product"
                        >
                          <Trash2 size={13} />
                        </button>}
                      </div>
                    </td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'movements' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Product SKU</th>
                <th>Movement Type</th>
                <th>Quantity</th>
                <th>Audit Reference</th>
                <th>Note / Batch Details</th>
              </tr>
            </thead>
            <tbody>
              {newestFirst(STOCK_MOVEMENTS).map(m => {
                const prod = PRODUCTS.find(p => p.id === m.productId);
                return (
                  <tr key={m.id}>
                    <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{m.date}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{prod?.emoji || '📦'}</span>
                        <span style={{ fontWeight: 600 }}>{prod?.name || m.productId}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${m.type === 'in' ? 'success' : m.type === 'out' ? 'danger' : 'warning'}`}>
                        {m.type === 'in' ? '📥 Stock In' : m.type === 'out' ? '📤 Stock Out' : '⚙️ Adjusted'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: m.type === 'in' ? 'var(--success-400)' : m.type === 'out' ? 'var(--danger-400)' : 'var(--warning-400)' }}>
                      {m.type === 'in' ? '+' : m.type === 'out' ? '−' : ''}{m.qty}
                    </td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.ref}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{m.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'receive' && <ReceivePurchaseTab toast={toast} user={user} onChange={reload} />}
      {activeTab === 'batches' && <BatchesTab toast={toast} canMark={canDo('stock.batch')} />}
      {activeTab === 'categories' && <CategoriesTab toast={toast} canEdit={canDo('product.add')} />}
      {activeTab === 'spares' && <SparePartsTab toast={toast} user={user} canIssue={canDo('service.issueParts')} canManage={canDo('product.obsolete')} onChange={reload} />}
      {verifying && <VerifyStockModal toast={toast} user={user} onClose={() => setVerifying(false)} onChange={reload} />}

      {adjusting && (
        <AdjustModal
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onSave={handleAdjust}
        />
      )}

      {productModal && (
        <ProductModal
          product={productModal === 'new' ? null : productModal}
          onClose={() => setProductModal(null)}
          onSave={handleSaveProduct}
        />
      )}
    </div>
  );
}
