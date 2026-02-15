'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { collection, query, where, getDocs, limit, or } from 'firebase/firestore';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  Checkbox,
  FormControlLabel,
  Divider,
  InputAdornment,
  IconButton,
  CircularProgress
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import VpnKeyOutlineIcon from '@mui/icons-material/VpnKeyOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { keyframes } from '@emotion/react';

const gradientAnimation = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (err: any) {
      setError(err.code === 'auth/popup-blocked' ? "Popup blocked! Please allow popups." : err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      let loginEmail = identifier.trim();

      if (!identifier.includes('@')) {
        const q = query(
          collection(db, 'system_users'), 
          or(
            where('username', '==', identifier.toLowerCase().trim()),
            where('userId', '==', identifier.trim())
          ),
          limit(1)
        );
        
        let snapshot;
        try {
          snapshot = await getDocs(q);
        } catch (dbErr: any) {
          throw new Error("Login system error. Please try again later.");
        }
        
        if (snapshot.empty) {
          throw new Error("Username or User ID not found.");
        }
        
        const userData = snapshot.docs[0].data();
        if (userData.status === 'inactive') {
          throw new Error("This account is currently inactive.");
        }
        
        loginEmail = userData.loginEmail || `${userData.username}@clearport.local`;
      }

      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, loginEmail, password);
      router.push('/');
    } catch (err: any) {
      console.error(err);
      let msg = err.message;
      if (err.code === 'auth/invalid-credential') msg = "Incorrect identifier or password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const isFormDisabled = loading || googleLoading;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(-45deg, #006BFF, #7C3AED, #06B6D4, #3B82F6)',
        backgroundSize: '400% 400%',
        animation: `${gradientAnimation} 15s ease infinite`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 4, md: 6 },
          borderRadius: '32px',
          minWidth: { xs: '100%', sm: 420 },
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          position: 'relative',
          zIndex: 10
        }}
      >
        <Box textAlign="center" mb={4}>
          <Typography variant="h4" fontWeight={900} sx={{ fontFamily: 'Satoshi, sans-serif', color: '#0F172A', letterSpacing: '-0.03em', mb: 1 }}>
            Daily Expense
          </Typography>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            Sign in to manage your daily expenses
          </Typography>
        </Box>

        <Button
          fullWidth
          variant="outlined"
          size="large"
          disabled={isFormDisabled}
          onClick={handleGoogleLogin}
          startIcon={googleLoading ? <CircularProgress size={20} /> : <GoogleIcon />}
          sx={{
            py: 1.5,
            borderRadius: '16px',
            textTransform: 'none',
            fontWeight: 700,
            borderColor: '#E2E8F0',
            color: '#475569',
            mb: 3,
            '&:hover': { borderColor: '#CBD5E1', bgcolor: 'rgba(248, 250, 252, 0.8)' }
          }}
        >
          {googleLoading ? 'Redirecting...' : 'Continue with Google'}
        </Button>

        <Divider sx={{ width: '100%', mb: 3 }}>
          <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>
            Or use account
          </Typography>
        </Divider>

        {error && (
          <Box sx={{ width: '100%', mb: 3 }}>
            <Alert severity="error" sx={{ borderRadius: '16px', fontWeight: 600 }}>{error}</Alert>
          </Box>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
          <TextField
            margin="normal"
            fullWidth
            label="Username, User ID or Email"
            disabled={isFormDisabled}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="e.g. ramonoem"
            autoComplete="username"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutlineIcon sx={{ color: '#94A3B8' }} />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '16px', bgcolor: '#F8FAFC' } }}
            required
          />
          <TextField
            margin="normal"
            fullWidth
            label="Password"
            disabled={isFormDisabled}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <VpnKeyOutlineIcon sx={{ color: '#94A3B8' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" disabled={isFormDisabled}>
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '16px', bgcolor: '#F8FAFC' } }}
            required
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <FormControlLabel
              control={
                <Checkbox 
                  size="small"
                  checked={rememberMe} 
                  onChange={(e) => setRememberMe(e.target.checked)} 
                  disabled={isFormDisabled}
                  sx={{ '&.Mui-checked': { color: '#006BFF' } }}
                />
              }
              label={<Typography variant="body2" color="#475569" fontWeight={600}>Remember me</Typography>}
            />
          </Box>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={isFormDisabled}
            sx={{
              py: 2,
              fontWeight: 800,
              fontSize: '1rem',
              borderRadius: '16px',
              textTransform: 'none',
              bgcolor: '#006BFF',
              boxShadow: '0 10px 15px -3px rgba(0, 107, 255, 0.3)',
              '&:hover': { bgcolor: '#0052CC', boxShadow: '0 20px 25px -5px rgba(0, 107, 255, 0.4)' }
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </Button>
        </Box>
        
        <Box mt={6} textAlign="center">
          <Typography variant="caption" color="#94A3B8" fontWeight={600}>
            © {new Date().getFullYear()} Daily Expense System. All rights reserved.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}