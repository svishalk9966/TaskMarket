import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// Valid role values
export const ROLES = {
  CLIENT: 'client',
  FREELANCER: 'freelancer',
  BOTH: 'both',
};

const STORAGE_KEY = 'tm_selected_role';

const RoleContext = createContext(null);

// sessionStorage — clears on every fresh page open / tab close
// so the modal appears each time the user opens the site
const readStored = () => {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (Object.values(ROLES).includes(v)) return v;
  } catch (_) { /* ignore */ }
  return null;
};

export const RoleProvider = ({ children }) => {
  const [role, setRoleState] = useState(() => {
    // Clear any old localStorage value left from previous builds
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
    return readStored();
  });

  const setRole = useCallback((newRole) => {
    setRoleState(newRole);
    try { sessionStorage.setItem(STORAGE_KEY, newRole); } catch (_) { /* ignore */ }
  }, []);

  const clearRole = useCallback(() => {
    setRoleState(null);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
  }, []);

  // Capability helpers — if role is null (already logged-in user), default to both
  const effectiveRole = role || ROLES.BOTH;
  const canPost = effectiveRole === ROLES.CLIENT || effectiveRole === ROLES.BOTH;
  const canBid  = effectiveRole === ROLES.FREELANCER || effectiveRole === ROLES.BOTH;

  const value = useMemo(() => ({
    role,
    setRole,
    clearRole,
    canPost,
    canBid,
    hasRole: role !== null,
  }), [role, setRole, clearRole, canPost, canBid]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export const useRole = () => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
};
