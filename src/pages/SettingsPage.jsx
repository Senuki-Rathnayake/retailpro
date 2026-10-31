import { useState } from 'react';
import { Save, Shield, Settings, Bell, Database, RefreshCw, FileText, Sun, Moon } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { APP_SETTINGS, CATEGORIES, PRODUCTS, AUDIT_LOG, newAuditId, markSettingsUpdated, lastSettingsUpdate, getUser, currentState } from '../data/store';
import { loadCompanyData, saveNow } from '../lib/db/sync';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function SettingsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // every value comes from the system_setting table
  const [settings, setSettings] = useState(() => ({ ...APP_SETTINGS }));
  const [errors, setErrors] = useState({});
  const [lastUpd, setLastUpd] = useState(() => lastSettingsUpdate());
  const [busy, setBusy] = useState(false);

  // Download every record as a JSON file (a backup copy of the database)
  const downloadBackup = async () => {
    await saveNow();
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data: currentState() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rajida-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    AUDIT_LOG.unshift({ id: newAuditId(), action: 'BACKUP_DOWNLOADED', userId: user?.id, detail: 'Backup of all records downloaded', timestamp: new Date().toISOString() });
    toast.success('Backup file downloaded');
  };
  // Read everything again from the database
  const reloadData = async () => {
    setBusy(true);
    try { await saveNow(); await loadCompanyData(); setSettings({ ...APP_SETTINGS }); setLastUpd(lastSettingsUpdate()); toast.success('Data reloaded from the database'); }
    catch (e) { toast.error('Could not reload: ' + e.message); }
    finally { setBusy(false); }
  };

  // Warranty policy (Manage warranty policy settings)
  const [policy, setPolicy] = useState({ months: APP_SETTINGS.warrantyMonths, terms: APP_SETTINGS.warrantyTerms, categories: [] });

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  // Validation rules for each setting (value is valid for this setting?)
  const RULES = {
    businessName: v => String(v).trim().length >= 3 || 'Business name needs at least 3 characters',
    taxRate: v => (v >= 0 && v <= 50) || 'Tax rate must be between 0 and 50%',
    invoicePrefix: v => /^[A-Z]{2,5}-$/.test(v) || 'Use 2–5 capital letters and a dash, e.g. INV-',
    poPrefix: v => /^[A-Z]{2,5}-$/.test(v) || 'Use 2–5 capital letters and a dash, e.g. PO-',
    servicePrefix: v => /^[A-Z]{2,5}-$/.test(v) || 'Use 2–5 capital letters and a dash, e.g. SRV-',
    lowStockThreshold: v => (Number.isInteger(+v) && v >= 1 && v <= 1000) || 'Threshold must be a whole number from 1 to 1000',
    returnWindowDays: v => (v >= 0 && v <= 90) || 'Return window must be 0–90 days',
    purchaseBudgetLimit: v => v > 0 || 'Budget limit must be greater than zero',
    poApprovalLimit: v => v > 0 || 'Approval limit must be greater than zero',
    refundApprovalLimit: v => v > 0 || 'Refund limit must be greater than zero',
    creditApprovalLimit: v => v > 0 || 'Credit limit authority must be greater than zero',
    technicianMaxJobs: v => (Number.isInteger(+v) && v >= 1 && v <= 20) || 'Jobs per technician must be 1–20',
  };

  const handleSave = (e) => {
    e?.preventDefault?.();
    const errs = {};
    Object.entries(RULES).forEach(([k, rule]) => { const r = rule(settings[k]); if (r !== true) errs[k] = r; });
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error(`Value is not valid for this setting: ${Object.values(errs)[0]}`);
      return;
    }
    const changed = Object.keys(settings).filter(k => String(APP_SETTINGS[k]) !== String(settings[k]));
    Object.keys(settings).forEach(k => { APP_SETTINGS[k] = typeof APP_SETTINGS[k] === 'number' ? Number(settings[k]) : settings[k]; });
    markSettingsUpdated(changed, user?.id);   // system_setting.updated_at and user_id
    setLastUpd(lastSettingsUpdate());
    AUDIT_LOG.unshift({ id: newAuditId(), action: 'SETTINGS_UPDATED', userId: user?.id, detail: 'System settings updated', timestamp: new Date().toISOString() });
    toast.success('Settings updated');
  };

  const savePolicy = () => {
    const months = Number(policy.months);
    if (!(months > 0)) { toast.error('Warranty period must be greater than zero'); return; }
    if (!policy.terms.trim()) { toast.error('Please enter the warranty terms'); return; }
    APP_SETTINGS.warrantyMonths = months;
    APP_SETTINGS.warrantyTerms = policy.terms.trim();
    markSettingsUpdated(['warrantyMonths', 'warrantyTerms'], user?.id);
    setLastUpd(lastSettingsUpdate());
    // apply to the selected product categories
    let updated = 0;
    PRODUCTS.forEach(p => { if (policy.categories.includes(p.category)) { p.warranty = months; updated++; } });
    AUDIT_LOG.unshift({ id: newAuditId(), action: 'WARRANTY_POLICY_UPDATED', userId: user?.id, detail: `Warranty policy set to ${months} months${updated ? ` for ${updated} products` : ''}`, timestamp: new Date().toISOString() });
    toast.success(`Warranty policy updated${updated ? ` – ${updated} products now have ${months} months warranty` : ''}`);
  };
  const toggleCat = (id) => setPolicy(p => ({ ...p, categories: p.categories.includes(id) ? p.categories.filter(c => c !== id) : [...p.categories, id] }));
  const err = (k) => errors[k] ? <div className="form-error" style={{ color: 'var(--danger-400)', fontSize: 12, marginTop: 4 }}>{errors[k]}</div> : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Settings</h1>
          <p className="page-subtitle">Configure business profiles, tax rates, warranty terms, and operational rules</p>
          {lastUpd && <p id="settings-last-update" style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>Last changed {String(lastUpd.updatedAt).slice(0, 16).replace('T', ' ')} by {getUser(lastUpd.updatedBy)?.name || 'a former staff member'}</p>}
        </div>
        <div className="page-header-actions">
          <button id="btn-save-settings" className="btn btn-primary" onClick={handleSave}>
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Appearance & Theme Mode */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            {theme === 'dark' ? <Moon size={20} color="var(--accent-400)" /> : <Sun size={20} color="var(--warning-400)" />}
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Interface Theme & Appearance</h3>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Choose your preferred color theme. This setting is remembered automatically on your device.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Dark Mode card */}
            <button
              type="button"
              onClick={() => theme !== 'dark' && toggleTheme()}
              style={{
                padding: '16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                borderRadius: 'var(--radius-lg)',
                border: theme === 'dark' ? '2px solid var(--primary-500)' : '2px solid var(--border-default)',
                background: theme === 'dark'
                  ? 'linear-gradient(135deg, var(--primary-600), var(--primary-500))'
                  : 'var(--bg-elevated)',
                color: theme === 'dark' ? '#fff' : 'var(--text-primary)',
                cursor: theme === 'dark' ? 'default' : 'pointer',
                boxShadow: theme === 'dark' ? '0 4px 16px rgba(37,99,235,.4)' : 'none',
                transition: 'all 0.2s',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <Moon size={22} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Dark Mode</span>
              <span style={{ fontSize: 11, opacity: 0.75 }}>Sleek slate dark aesthetic</span>
            </button>

            {/* Light Mode card */}
            <button
              type="button"
              onClick={() => theme !== 'light' && toggleTheme()}
              style={{
                padding: '16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                borderRadius: 'var(--radius-lg)',
                border: theme === 'light' ? '2px solid var(--primary-500)' : '2px solid var(--border-default)',
                background: theme === 'light'
                  ? 'linear-gradient(135deg, var(--primary-600), var(--primary-500))'
                  : 'var(--bg-elevated)',
                color: theme === 'light' ? '#fff' : 'var(--text-primary)',
                cursor: theme === 'light' ? 'default' : 'pointer',
                boxShadow: theme === 'light' ? '0 4px 16px rgba(37,99,235,.4)' : 'none',
                transition: 'all 0.2s',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <Sun size={22} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Light Mode</span>
              <span style={{ fontSize: 11, opacity: 0.75 }}>Crisp high-contrast day mode</span>
            </button>
          </div>
        </div>

        {/* Business Profile */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Settings size={20} color="var(--primary-400)" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Company & Store Profile</h3>
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Business Name</label>
            <input
              type="text"
              className="form-input"
              value={settings.businessName}
              onChange={e => handleChange('businessName', e.target.value)}
            />
            {err('businessName')}
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">VAT / Tax Registration Number</label>
            <input
              type="text"
              className="form-input"
              value={settings.taxId}
              onChange={e => handleChange('taxId', e.target.value)}
            />
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Currency</label>
              <input
                type="text"
                className="form-input"
                value={settings.currency}
                disabled
              />
            </div>
            <div className="form-group">
              <label className="form-label">Standard VAT / Tax Rate (%)</label>
              <input
                type="number"
                className="form-input"
                value={settings.taxRate}
                onChange={e => handleChange('taxRate', +e.target.value)}
              />
              {err('taxRate')}
            </div>
          </div>
        </div>

        {/* Invoice & Order Prefixes */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <FileText size={20} color="var(--accent-400)" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Document Identifiers</h3>
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Invoice Number Prefix</label>
            <input
              type="text"
              className="form-input"
              value={settings.invoicePrefix}
              onChange={e => handleChange('invoicePrefix', e.target.value)}
            />
            {err('invoicePrefix')}
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Purchase Order Prefix</label>
            <input
              type="text"
              className="form-input"
              value={settings.poPrefix}
              onChange={e => handleChange('poPrefix', e.target.value)}
            />
            {err('poPrefix')}
          </div>
          <div className="form-group">
            <label className="form-label">Service Job Card Prefix</label>
            <input
              type="text"
              className="form-input"
              value={settings.servicePrefix}
              onChange={e => handleChange('servicePrefix', e.target.value)}
            />
            {err('servicePrefix')}
          </div>
        </div>

        {/* Warranty Policy (Manage warranty policy settings) */}
        <div className="card" style={{ padding: 24 }} id="warranty-policy">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Shield size={20} color="var(--success-400)" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Warranty Policy</h3>
          </div>
          <div className="form-row-2" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="policy-months">Warranty Period (months)</label>
              <input id="policy-months" type="number" className="form-input" value={policy.months} onChange={e => setPolicy(p => ({ ...p, months: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="set-return">Return Window (Days)</label>
              <input id="set-return" type="number" className="form-input" value={settings.returnWindowDays} onChange={e => handleChange('returnWindowDays', +e.target.value)} />
              {err('returnWindowDays')}
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label" htmlFor="policy-terms">Warranty Terms</label>
            <textarea id="policy-terms" className="form-textarea" rows={3} value={policy.terms} onChange={e => setPolicy(p => ({ ...p, terms: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Apply to product categories</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIES.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '4px 10px', border: '1px solid var(--border-default)', borderRadius: 999, cursor: 'pointer' }}>
                  <input type="checkbox" checked={policy.categories.includes(c.id)} onChange={() => toggleCat(c.id)} /> {c.name}
                </label>
              ))}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 14 }}>
            <input type="checkbox" checked={settings.enableWarrantyCheck} onChange={e => handleChange('enableWarrantyCheck', e.target.checked)} />
            Check the warranty before accepting an exchange
          </label>
          <button id="btn-save-policy" type="button" className="btn btn-primary" onClick={savePolicy}><Save size={15} /> Save Warranty Policy</button>
        </div>

        {/* Approval limits used by purchase orders, refunds, credit and service jobs */}
        <div className="card" style={{ padding: 24 }} id="approval-limits">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Settings size={20} color="var(--primary-400)" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Approval Limits (LKR)</h3>
          </div>
          {[
            ['purchaseBudgetLimit', 'Purchase order budget limit (Purchasing Manager)'],
            ['poApprovalLimit', 'Purchase order approval limit (above → Admin)'],
            ['refundApprovalLimit', 'Refund approval limit (above → Admin)'],
            ['creditApprovalLimit', 'Credit limit Finance can approve'],
            ['technicianMaxJobs', 'Open jobs per technician'],
          ].map(([k, label]) => (
            <div className="form-group" style={{ marginBottom: 12 }} key={k}>
              <label className="form-label" htmlFor={`set-${k}`}>{label}</label>
              <input id={`set-${k}`} type="number" className="form-input" value={settings[k]} onChange={e => handleChange(k, e.target.value === '' ? '' : +e.target.value)} />
              {err(k)}
            </div>
          ))}
        </div>

        {/* System & Alerts */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Bell size={20} color="var(--warning-400)" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Inventory Alerts & Backups</h3>
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Default Low-Stock Warning Threshold</label>
            <input
              type="number"
              className="form-input"
              value={settings.lowStockThreshold}
              onChange={e => handleChange('lowStockThreshold', +e.target.value)}
            />
            {err('lowStockThreshold')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={settings.emailAlerts}
                onChange={e => handleChange('emailAlerts', e.target.checked)}
              />
              Send instant email alerts to Storekeeper on critical low stock
            </label>
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-outline"
              id="btn-backup"
              onClick={downloadBackup}
            >
              <Database size={15} /> Download Backup
            </button>
            <button
              type="button"
              className="btn btn-outline"
              id="btn-reload-data"
              disabled={busy}
              onClick={reloadData}
            >
              <RefreshCw size={15} /> {busy ? 'Reloading…' : 'Reload from Database'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
