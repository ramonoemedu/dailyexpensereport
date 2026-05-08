import { useState, useEffect, useCallback } from 'react';

export interface AuthUser {
  uid: string;
  email: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentFamilyId, setCurrentFamilyId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDoc, setUserDoc] = useState<any>(null);
  const [allFamilies, setAllFamilies] = useState<Record<string, string>>({});
  const [allFamilyNames, setAllFamilyNames] = useState<Record<string, string>>({});
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);

  const loadUserContext = useCallback(async (token: string) => {
    try {
      const meRes = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!meRes.ok) {
        localStorage.removeItem('authToken');
        setUser(null);
        setUserDoc(null);
        setCurrentFamilyId(null);
        setUserRole(null);
        setAllFamilies({});
        setLoading(false);
        return;
      }

      const meData = await meRes.json();
      const profile = meData.profile || null;
      const profileFamilies = profile?.families || {};

      setUser({ uid: meData.uid, email: profile?.loginEmail || profile?.email || '' });
      setUserDoc(profile);
      setAllFamilies(profileFamilies);
      setAllFamilyNames(meData.familyNames || {});
      setIsSystemAdmin(profile?.systemAdmin === true);

      const savedFamilyId = typeof window !== 'undefined' ? localStorage.getItem('preferredFamilyId') : null;
      let resolvedFamilyId = savedFamilyId && profileFamilies[savedFamilyId] ? savedFamilyId : meData.currentFamilyId;
      if (!resolvedFamilyId) {
        resolvedFamilyId = Object.keys(profileFamilies)[0] || null;
      }

      setCurrentFamilyId(resolvedFamilyId);
      setUserRole(resolvedFamilyId ? profileFamilies[resolvedFamilyId] : null);
    } catch {
      localStorage.removeItem('authToken');
      setUser(null);
      setUserDoc(null);
      setCurrentFamilyId(null);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (!token) {
      setLoading(false);
      return;
    }
    loadUserContext(token);
  }, [loadUserContext]);

  const switchFamily = useCallback(async (familyId: string) => {
    if (!user) return false;
    if (!allFamilies[familyId] && !isSystemAdmin) return false;

    try {
      if (typeof window !== 'undefined') localStorage.setItem('preferredFamilyId', familyId);
      setCurrentFamilyId(familyId);
      setUserRole(allFamilies[familyId] || 'admin');

      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      if (!token) return false;

      const res = await fetch('/api/users/me/switch-family', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [user, allFamilies, isSystemAdmin]);

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('preferredFamilyId');
    }
    setUser(null);
    setUserDoc(null);
    setCurrentFamilyId(null);
    setUserRole(null);
    setAllFamilies({});
    setAllFamilyNames({});
    setIsSystemAdmin(false);
  }, []);

  return {
    user,
    userDoc,
    currentFamilyId,
    userRole,
    loading,
    allFamilies,
    allFamilyNames,
    switchFamily,
    isSystemAdmin,
    logout,
  };
}
