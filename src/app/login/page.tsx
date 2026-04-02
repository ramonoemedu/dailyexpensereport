'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
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
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [registerFullName, setRegisterFullName] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerUserId, setRegisterUserId] = useState(`USR-${Math.floor(1000 + Math.random() * 9000)}`);
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
        const resolveRes = await fetch('/api/auth/resolve-identifier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: identifier.trim() }),
        });

        const resolveData = await resolveRes.json();
        if (!resolveRes.ok) {
          throw new Error(resolveData.error || 'Login system error. Please try again later.');
        }

        loginEmail = resolveData.loginEmail;
      }

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (!registerFullName || !registerUsername || !registerUserId || !registerEmail || !registerPassword) {
      setError('Please fill all required fields.');
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const registerRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: registerFullName.trim(),
          username: registerUsername.trim().toLowerCase(),
          userId: registerUserId.trim(),
          email: registerEmail.trim().toLowerCase(),
          password: registerPassword,
        }),
      });

      const registerData = await registerRes.json();
      if (!registerRes.ok) {
        throw new Error(registerData?.error || 'Registration failed.');
      }

      await signInWithEmailAndPassword(auth, registerEmail.trim().toLowerCase(), registerPassword);
      router.push('/');
    } catch (err: any) {
      let msg = err.message || 'Registration failed.';
      if (err.code === 'auth/email-already-in-use') msg = 'Email already exists.';
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
            {mode === 'login' ? 'Sign in to manage your daily expenses' : 'Create your account and start onboarding'}
          </Typography>
        </Box>

        {mode === 'login' && (
          <>
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
          </>
        )}

        {error && (
          <Box sx={{ width: '100%', mb: 3 }}>
            <Alert severity="error" sx={{ borderRadius: '16px', fontWeight: 600 }}>{error}</Alert>
          </Box>
        )}

        {mode === 'login' ? (
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
        ) : (
          <Box component="form" onSubmit={handleRegister} sx={{ width: '100%' }}>
            <TextField
              margin="normal"
              fullWidth
              label="Full Name"
              disabled={isFormDisabled}
              value={registerFullName}
              onChange={(e) => setRegisterFullName(e.target.value)}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '16px', bgcolor: '#F8FAFC' } }}
              required
            />
            <TextField
              margin="normal"
              fullWidth
              label="Username"
              disabled={isFormDisabled}
              value={registerUsername}
              onChange={(e) => setRegisterUsername(e.target.value.toLowerCase())}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '16px', bgcolor: '#F8FAFC' } }}
              required
            />
            <TextField
              margin="normal"
              fullWidth
              label="User ID"
              disabled={isFormDisabled}
              value={registerUserId}
              onChange={(e) => setRegisterUserId(e.target.value)}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '16px', bgcolor: '#F8FAFC' } }}
              required
            />
            <TextField
              margin="normal"
              fullWidth
              label="Email"
              type="email"
              disabled={isFormDisabled}
              value={registerEmail}
              onChange={(e) => setRegisterEmail(e.target.value)}
              autoComplete="email"
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '16px', bgcolor: '#F8FAFC' } }}
              required
            />
            <TextField
              margin="normal"
              fullWidth
              label="Password"
              disabled={isFormDisabled}
              type={showPassword ? 'text' : 'password'}
              value={registerPassword}
              onChange={(e) => setRegisterPassword(e.target.value)}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '16px', bgcolor: '#F8FAFC' } }}
              required
            />
            <TextField
              margin="normal"
              fullWidth
              label="Confirm Password"
              disabled={isFormDisabled}
              type={showPassword ? 'text' : 'password'}
              value={registerConfirmPassword}
              onChange={(e) => setRegisterConfirmPassword(e.target.value)}
              sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '16px', bgcolor: '#F8FAFC' } }}
              required
            />

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
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </Box>
        )}

        <Box mt={3}>
          <Button
            variant="text"
            fullWidth
            disabled={isFormDisabled}
            onClick={() => {
              setError('');
              setMode((m) => (m === 'login' ? 'register' : 'login'));
            }}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
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