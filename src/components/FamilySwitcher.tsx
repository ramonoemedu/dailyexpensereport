'use client';

import { useAuthContext } from '@/components/AuthProvider';
import React, { useState } from 'react';

export function FamilySwitcher() {
  const { currentFamilyId, allFamilies, allFamilyNames, switchFamily, loading, userDoc, isSystemAdmin } = useAuthContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleSwitchFamily = async (familyId: string) => {
    if (familyId === currentFamilyId) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);
    const success = await switchFamily(familyId);
    setIsSwitching(false);

    if (success) {
      setIsOpen(false);
    }
  };

  // Get families from userDoc if allFamilies is empty
  const familiesMap = allFamilies && Object.keys(allFamilies).length > 0
    ? allFamilies
    : (userDoc?.families || {});

  const families = Object.entries(familiesMap || {}) as Array<[string, string]>;

  const getFamilyName = (familyId: string) => allFamilyNames[familyId] || familyId;

  if (!mounted) return null;

  // Debug log
  if (typeof window !== 'undefined') {
    console.log('[FamilySwitcher]', {
      loading,
      allFamiliesCount: Object.keys(allFamilies || {}).length,
      userDocFamiliesCount: Object.keys(userDoc?.families || {}).length,
      familiesCount: families.length,
      currentFamilyId,
    });
  }

  // Don't show if loading or no families. System admins always see the switcher.
  if (loading || families.length === 0) return null;
  if (!isSystemAdmin && families.length <= 1) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading || isSwitching}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-dark-2 hover:bg-gray-200 dark:hover:bg-dark-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-dark-4 dark:text-dark-6"
      >
        {isSystemAdmin ? (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-bold">A</span>
        ) : (
          <span className="inline-block w-2 h-2 rounded-full bg-primary"></span>
        )}
        <span className="truncate max-w-[150px]">{currentFamilyId ? getFamilyName(currentFamilyId) : 'Select Family'}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white dark:bg-gray-dark border border-stroke dark:border-dark-3 z-50 overflow-hidden">
          <div className="p-2 space-y-1">
            {isSystemAdmin && (
              <div className="px-3 py-1.5 mb-1 rounded-md bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                <p className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">Admin View — All Families</p>
              </div>
            )}
            {families.map(([familyId, role]) => (
              <button
                key={familyId}
                onClick={() => handleSwitchFamily(familyId)}
                disabled={isSwitching}
                className={`w-full text-left px-3 py-2.5 rounded-md transition-all text-sm font-medium ${currentFamilyId === familyId
                  ? 'bg-primary text-white'
                  : 'text-dark-4 dark:text-dark-6 hover:bg-gray-100 dark:hover:bg-dark-2'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{getFamilyName(familyId)}</span>
                  <span className="text-xs opacity-75 ml-2">({role})</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
