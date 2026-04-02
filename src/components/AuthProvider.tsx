'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { CircularProgress } from '@mui/material';

const AuthContext = createContext<ReturnType<typeof useAuth> | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { user, loading, currentFamilyId } = auth;
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isLoginPage = pathname === '/login';
  const isOnboardingPage = pathname === '/onboarding';

  useEffect(() => {
    if (!isMounted || loading) return;

    if (!user && !isLoginPage) {
      router.push('/login');
      return;
    }

    if (user && !currentFamilyId && !isLoginPage && !isOnboardingPage) {
      router.push('/onboarding');
      return;
    }

    if (user && currentFamilyId && isOnboardingPage) {
      router.push('/');
    }
  }, [user, loading, currentFamilyId, isLoginPage, isOnboardingPage, router, isMounted]);

  // If we are on the login page, render only the children.
  // This removes all wrapping divs and overlays entirely.
  if (isLoginPage || isOnboardingPage) {
    return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
  }

  // Handle loading state for protected routes ONLY
  if (!isMounted || loading) {
    return (
      <div
        key="global-loader"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          width: '100vw',
          backgroundColor: '#F8FAFC'
        }}
      >
        <CircularProgress />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};