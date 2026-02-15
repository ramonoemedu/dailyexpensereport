'use client';

import { createTheme, ThemeOptions } from '@mui/material/styles';
import { PaletteMode, ThemeProvider, CssBaseline } from '@mui/material';
import React, { createContext, useMemo, ReactNode, useContext, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

// Context to provide dark mode toggle
export const ColorModeContext = createContext({ toggleColorMode: () => { } });

export const useColorMode = () => useContext(ColorModeContext);

export const getDesignTokens = (mode: PaletteMode): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      main: mode === 'light' ? '#006BFF' : '#3B82F6',
      light: '#EBF4FF',
      dark: '#0052CC',
      contrastText: '#ffffff',
    },
    secondary: {
      main: mode === 'light' ? '#7C3AED' : '#A78BFA',
      light: '#F5F3FF',
      dark: '#5B21B6',
      contrastText: '#ffffff',
    },
    background: {
      default: mode === 'light' ? '#F8FAFC' : '#0F172A',
      paper: mode === 'light' ? '#FFFFFF' : '#1E293B',
    },
    text: {
      primary: mode === 'light' ? '#0F172A' : '#F8FAFC',
      secondary: mode === 'light' ? '#64748B' : '#94A3B8',
    },
  },
  typography: {
    fontFamily: '"Satoshi", "Plus Jakarta Sans", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          minHeight: '100vh',
          backgroundColor: mode === 'light' ? '#F8FAFC' : '#0F172A',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid',
          borderColor: mode === 'light' ? '#E2E8F0' : '#334155',
          boxShadow: mode === 'light'
            ? '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)'
            : '0 1px 3px 0 rgba(0, 0, 0, 0.2), 0 1px 2px -1px rgba(0, 0, 0, 0.2)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '8px 20px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
  },
  shape: {
    borderRadius: 12,
  },
});

export function ThemeProviderWrapper({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use 'light' as a stable default for hydration
  const mode = useMemo(() => {
    if (!mounted) return 'light';
    return (resolvedTheme === 'dark' ? 'dark' : 'light') as PaletteMode;
  }, [mounted, resolvedTheme]);

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
      },
    }),
    [resolvedTheme, setTheme],
  );

  const theme = useMemo(() => createTheme(getDesignTokens(mode)), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        {/* We use a div here to anchor the styles and children, 
            helping React handle the sibling relationship between 
            CssBaseline's style tags and AuthProvider's content. */}
        <div suppressHydrationWarning style={{ display: 'contents' }}>
          <CssBaseline />
          {children}
        </div>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
