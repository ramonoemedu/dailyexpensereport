
import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentFamilyId, setCurrentFamilyId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDoc, setUserDoc] = useState<any>(null);
  const [allFamilies, setAllFamilies] = useState<Record<string, string>>({});
  const [allFamilyNames, setAllFamilyNames] = useState<Record<string, string>>({});
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(true);
      if (firebaseUser) {
        try {
          // Primary path: resolve profile + family context via server API (Admin SDK).
          const token = await firebaseUser.getIdToken();
          const meRes = await fetch('/api/users/me', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (meRes.ok) {
            const meData = await meRes.json();
            const profile = meData.profile || null;
            const profileFamilies = profile?.families || {};
            setAllFamilies(profileFamilies);
            setAllFamilyNames(meData.familyNames || {});
            setIsSystemAdmin(profile?.systemAdmin === true);
            
            // Check localStorage for preferred family first
            const savedFamilyId = typeof window !== 'undefined' ? localStorage.getItem('preferredFamilyId') : null;
            let resolvedFamilyId = savedFamilyId && profileFamilies[savedFamilyId] ? savedFamilyId : meData.currentFamilyId;
            
            if (!resolvedFamilyId) {
              const familyIds = Object.keys(profileFamilies);
              resolvedFamilyId = familyIds[0] || null;
            }
            
            const resolvedRole = resolvedFamilyId ? profileFamilies?.[resolvedFamilyId] : null;
            setUserDoc(profile);
            setCurrentFamilyId(resolvedFamilyId);
            setUserRole(resolvedRole);
            setLoading(false);
            return;
          }
          console.warn('useAuth: /api/users/me failed with status', meRes.status);

          // Fallback path: legacy client-side reads.
          const userRef = doc(db, 'system_users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          let data: any = null;

          if (userSnap.exists()) {
            data = userSnap.data();
          } else {
            // Backward compatibility for legacy docs created with random IDs.
            const q = query(
              collection(db, 'system_users'),
              where('uid', '==', firebaseUser.uid),
              limit(10)
            );
            const byUidSnap = await getDocs(q);
            if (!byUidSnap.empty) {
              const ranked = byUidSnap.docs
                .map((d) => ({ id: d.id, data: d.data() as any }))
                .sort((a, b) => {
                  const aFamilies = Object.keys(a.data?.families || {}).length;
                  const bFamilies = Object.keys(b.data?.families || {}).length;
                  if (aFamilies !== bFamilies) return bFamilies - aFamilies;
                  if (a.id === firebaseUser.uid) return -1;
                  if (b.id === firebaseUser.uid) return 1;
                  return 0;
                });
              data = ranked[0]?.data || null;
            }
          }

          if (data) {
            setUserDoc(data);
            // Extract all families
            const families = data.families || {};
            setAllFamilies(families);
            setIsSystemAdmin(data.systemAdmin === true);
            
            // Check localStorage for preferred family first
            const savedFamilyId = typeof window !== 'undefined' ? localStorage.getItem('preferredFamilyId') : null;
            let resolvedFamilyId = savedFamilyId && families[savedFamilyId] ? savedFamilyId : null;
            
            if (!resolvedFamilyId) {
              const familyIds = Object.keys(families);
              if (familyIds.length > 0) {
                resolvedFamilyId = familyIds[0];
              }
            }
            
            if (resolvedFamilyId) {
              setCurrentFamilyId(resolvedFamilyId);
              setUserRole(families[resolvedFamilyId]);
            } else {
              // No family found in profile — send user to onboarding.
              setCurrentFamilyId(null);
              setUserRole(null);
            }
          } else {
            setUserDoc(null);
            setCurrentFamilyId(null);
            setUserRole(null);
          }
        } catch (err) {
          console.error('useAuth load failed:', err);
          setUserDoc(null);
          setCurrentFamilyId(null);
          setUserRole(null);
        }
      } else {
        setUserDoc(null);
        setCurrentFamilyId(null);
        setUserRole(null);
        setIsSystemAdmin(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const switchFamily = useCallback(async (familyId: string) => {
    if (!user) return;

    if (!allFamilies[familyId]) {
      console.error('User does not have access to this family');
      return false;
    }

    try {
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('preferredFamilyId', familyId);
      }

      // Update state immediately
      setCurrentFamilyId(familyId);
      setUserRole(allFamilies[familyId]);

      // Verify with backend
      const token = await user.getIdToken();
      const res = await fetch('/api/users/me/switch-family', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ familyId }),
      });

      if (!res.ok) {
        console.error('Failed to switch family on backend');
        return false;
      }

      return true;
    } catch (err) {
      console.error('switchFamily failed:', err);
      return false;
    }
  }, [user, allFamilies]);

  return { user, userDoc, currentFamilyId, userRole, loading, allFamilies, allFamilyNames, switchFamily, isSystemAdmin };
}

