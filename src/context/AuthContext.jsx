import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { USERS, ROLES, AUDIT_LOG, newAuditId, pagesOf, actionsOf } from '../data/store';
import { roleKeyFrom } from '../lib/db/schemaMap';
import { loadCompanyData, startAutoSave, closeCompanyData } from '../lib/db/sync';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const auditLogin = (u) => AUDIT_LOG.unshift({
  id: newAuditId(), action: 'LOGIN', userId: u.id,
  detail: `${u.name} (${ROLES[u.role]?.label || u.role}) signed in successfully`,
  timestamp: new Date().toISOString(),
});

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // true while a saved Supabase session is being restored after a page refresh
  const [restoring, setRestoring] = useState(isSupabaseConfigured);

  // Load the staff profile ("user" + role tables) for a Supabase Auth user,
  // then read all company data from the database
  const loadProfile = useCallback(async (authUser) => {
    const { data: profile, error: pErr } = await supabase
      .from('user').select('*').eq('user_id', authUser.id).maybeSingle();
    if (pErr) return { error: 'Could not load your staff profile. ' + pErr.message };
    if (!profile) return { error: 'No staff profile exists for this account. Ask the Administrator.' };
    if (profile.is_locked || profile.is_active === false) {
      return { error: 'Your account has been locked by Administrator. Contact management.' };
    }
    let roleName = null;
    if (profile.role_id) {
      const { data: r } = await supabase.from('role').select('role_name, is_active').eq('role_id', profile.role_id).maybeSingle();
      roleName = r?.role_name || null;
    }
    const role = roleKeyFrom(roleName) || roleKeyFrom(profile.user_type);
    if (!role) return { error: 'No role is assigned to this account. Ask the Administrator to assign one.' };
    try {
      await loadCompanyData();
    } catch (e) {
      return { error: 'Could not load the company data from the database. ' + e.message };
    }
    const me = USERS.find(u => u.id === authUser.id) || {};
    return {
      user: {
        ...me,
        id: authUser.id,
        authId: authUser.id,
        name: profile.full_name || authUser.email,
        email: authUser.email,
        avatar: me.avatar || '👤',
        role,
        source: 'supabase',
        permissions: pagesOf(role),        // from the role_permission table
        actions: actionsOf(role),
      },
    };
  }, []);

  // Keep the user signed in after a page refresh (Supabase session)
  useEffect(() => {
    if (!isSupabaseConfigured) { setRestoring(false); return; }
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data?.session?.user) {
        const res = await loadProfile(data.session.user);
        if (!cancelled && res.user) { setUser(res.user); startAutoSave(); }
      }
      if (!cancelled) setRestoring(false);
    }).catch(() => { if (!cancelled) setRestoring(false); });
    return () => { cancelled = true; };
  }, [loadProfile]);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    const fail = (message) => { setError(message); setLoading(false); return { success: false, message }; };
    if (!isSupabaseConfigured) return fail('The database is not connected. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the .env file.');

    // Supabase Auth checks the e-mail and password
    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authErr) {
      const msg = authErr.message === 'Invalid login credentials' ? 'Invalid email or password.'
        : /not confirmed/i.test(authErr.message) ? 'This account is not active yet. Please ask the Administrator.'
        : authErr.message;
      return fail(msg);
    }
    const res = await loadProfile(data.user);
    if (res.error) { await supabase.auth.signOut(); return fail(res.error); }
    await supabase.from('user').update({ last_login_at: new Date().toISOString() }).eq('user_id', data.user.id);
    setUser(res.user);
    auditLogin(res.user);
    startAutoSave();
    setLoading(false);
    return { success: true };
  }, [loadProfile]);

  const logout = useCallback(async () => {
    if (user) {
      AUDIT_LOG.unshift({
        id: newAuditId(),
        action: 'LOGOUT',
        userId: user.id,
        detail: `${user.name} logged out`,
        timestamp: new Date().toISOString(),
      });
    }
    setUser(null);
    await closeCompanyData();
    if (isSupabaseConfigured) supabase.auth.signOut();
  }, [user]);

  // Supabase sends a password-reset e-mail (resetPasswordForEmail)
  const resetPassword = useCallback(async (email) => {
    if (!isSupabaseConfigured) return { success: false, message: 'The database is not connected.' };
    const { error: rErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (rErr) return { success: false, message: rErr.message };
    return { success: true, message: 'A password reset link has been sent to your e-mail.' };
  }, []);

  const can = useCallback((permission) => {
    if (!user) return false;
    return user.permissions.includes(permission);
  }, [user]);

  // canDo('stock.adjust') -> true only if the logged-in role may use that button
  const canDo = useCallback((action) => {
    if (!user) return false;
    return (user.actions || []).includes(action);
  }, [user]);

  const roleInfo = user ? ROLES[user.role] : null;

  return (
    <AuthContext.Provider value={{ user, login, logout, resetPassword, can, canDo, loading, restoring, error, roleInfo, authMode: isSupabaseConfigured ? 'supabase' : 'demo' }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
