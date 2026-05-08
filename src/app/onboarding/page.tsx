'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuthContext } from '@/components/AuthProvider';
import { useToast } from '@/components/NextAdmin/ui/toast';

type MemberDraft = {
  fullName: string;
  username: string;
  userId: string;
  email: string;
  password: string;
};

type CreatedMember = {
  uid: string;
  username: string;
  loginEmail: string;
  userId: string;
};

type MemberError = {
  username: string;
  error: string;
};

const steps = ['Create Family', 'Add Members (Optional)'];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading, currentFamilyId } = useAuthContext();
  const { showToast } = useToast();

  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [members, setMembers] = useState<MemberDraft[]>([]);
  const [error, setError] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryFamilyName, setSummaryFamilyName] = useState('');
  const [createdMembers, setCreatedMembers] = useState<CreatedMember[]>([]);
  const [memberErrors, setMemberErrors] = useState<MemberError[]>([]);

  const canGoNext = useMemo(() => {
    if (activeStep === 0) return familyName.trim().length > 1;
    return true;
  }, [activeStep, familyName]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (currentFamilyId) {
      router.replace('/');
    }
  }, [loading, user, currentFamilyId, router]);

  if (loading) {
    return (
      <Box className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <CircularProgress />
      </Box>
    );
  }

  if (!user || currentFamilyId) {
    return null;
  }

  const addMember = () => {
    const nextIndex = members.length + 1;
    setMembers((prev) => [
      ...prev,
      {
        fullName: '',
        username: '',
        userId: `USR-${Math.floor(1000 + Math.random() * 9000)}-${nextIndex}`,
        email: '',
        password: '',
      },
    ]);
  };

  const removeMember = (idx: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateMember = (idx: number, key: keyof MemberDraft, value: string) => {
    setMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, [key]: value } : m)));
  };

  const handleFinish = async () => {
    setError('');
    setSaving(true);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          familyName,
          members,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to finish onboarding.');
      }

      const created = Array.isArray(payload?.createdMembers)
        ? (payload.createdMembers as CreatedMember[])
        : [];
      const failed = Array.isArray(payload?.memberErrors)
        ? (payload.memberErrors as MemberError[])
        : [];
      const createdCount = created.length;
      const errorCount = failed.length;

      showToast(
        createdCount > 0
          ? `Family created. ${createdCount} member(s) created${errorCount > 0 ? `, ${errorCount} failed` : ''}.`
          : 'Family created successfully.',
        'success'
      );
      setSummaryFamilyName(String(payload?.familyName || familyName));
      setCreatedMembers(created);
      setMemberErrors(failed);
      setSummaryOpen(true);
    } catch (err: any) {
      setError(err?.message || 'Onboarding failed.');
      showToast(err?.message || 'Onboarding failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleGoDashboard = async () => {
    setSummaryOpen(false);
    // Force full reload so AuthProvider/useAuth re-resolves currentFamilyId from backend.
    window.location.assign('/');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 920,
          p: { xs: 3, md: 5 },
          borderRadius: '24px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 40px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Box className="mb-6">
          <Typography variant="h4" fontWeight={900} color="#0F172A">
            Welcome to Daily Expense
          </Typography>
          <Typography mt={1} color="#64748B" fontWeight={600}>
            Let&apos;s set up your family workspace before you start.
          </Typography>
        </Box>

        <Stepper activeStep={activeStep} sx={{ mb: 5 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>
            {error}
          </Alert>
        )}

        {activeStep === 0 && (
          <Box className="space-y-4">
            <Typography fontWeight={800} color="#1E293B" padding={2}>
              What is your family name?
            </Typography>

            <TextField
              fullWidth
              label="Family Name"
              placeholder="e.g. Ramon Family"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            />
            <Typography variant="body2" color="#64748B">
              This name will be used as your primary workspace and shared with your members.
            </Typography>
          </Box>
        )}

        {activeStep === 1 && (
          <Box className="space-y-4">
            <Box className="flex items-center justify-between">
              <Box>
                <Typography fontWeight={800} color="#1E293B">
                  Add users to this family (optional)
                </Typography>
                <Typography variant="body2" color="#64748B">
                  You can skip now and add users later in Settings &gt; Users.
                </Typography>
              </Box>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={addMember} sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}>
                Add Member
              </Button>
            </Box>

            {members.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 3, borderRadius: '14px', borderStyle: 'dashed' }}>
                <Typography color="#64748B">No members added yet.</Typography>
              </Paper>
            ) : (
              <Box className="space-y-4">
                {members.map((member, idx) => (
                  <Paper key={idx} variant="outlined" sx={{ p: 3, borderRadius: '14px' }}>
                    <Box className="mb-3 flex items-center justify-between">
                      <Typography fontWeight={700}>Member #{idx + 1}</Typography>
                      <IconButton color="error" onClick={() => removeMember(idx)}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    <Box className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <TextField
                        label="Full Name"
                        value={member.fullName}
                        onChange={(e) => updateMember(idx, 'fullName', e.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                      />
                      <TextField
                        label="Username"
                        value={member.username}
                        onChange={(e) => updateMember(idx, 'username', e.target.value.toLowerCase())}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                      />
                      <TextField
                        label="User ID"
                        value={member.userId}
                        onChange={(e) => updateMember(idx, 'userId', e.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                      />
                      <TextField
                        label="Email (optional)"
                        value={member.email}
                        onChange={(e) => updateMember(idx, 'email', e.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                      />
                      <TextField
                        type="password"
                        label="Password"
                        value={member.password}
                        onChange={(e) => updateMember(idx, 'password', e.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                      />
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}
          </Box>
        )}

        <Box className="mt-8 flex items-center justify-between">
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            disabled={activeStep === 0 || saving}
            onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Back
          </Button>

          <Box className="flex gap-2">
            {activeStep < steps.length - 1 ? (
              <Button
                variant="contained"
                disabled={!canGoNext || saving}
                onClick={() => setActiveStep((s) => s + 1)}
                sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 800, px: 3 }}
              >
                Next
              </Button>
            ) : (
              <>
                <Button
                  variant="outlined"
                  disabled={saving}
                  onClick={handleFinish}
                  sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
                >
                  Skip Members and Finish
                </Button>
                <Button
                  variant="contained"
                  disabled={saving}
                  onClick={handleFinish}
                  sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 800, px: 3 }}
                >
                  {saving ? <CircularProgress size={20} color="inherit" /> : 'Complete Setup'}
                </Button>
              </>
            )}
          </Box>
        </Box>
      </Paper>

      <Dialog
        open={summaryOpen}
        onClose={handleGoDashboard}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '18px' } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Setup Completed</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="#475569" mb={2}>
            Family <strong>{summaryFamilyName || familyName}</strong> is ready.
          </Typography>

          {createdMembers.length > 0 ? (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                Created Member Login Details
              </Typography>
              <Box className="space-y-2">
                {createdMembers.map((member) => (
                  <Paper key={member.uid} variant="outlined" sx={{ p: 1.5, borderRadius: '10px' }}>
                    <Typography variant="body2"><strong>Username:</strong> {member.username}</Typography>
                    <Typography variant="body2"><strong>User ID:</strong> {member.userId}</Typography>
                    <Typography variant="body2"><strong>Login Email:</strong> {member.loginEmail}</Typography>
                  </Paper>
                ))}
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="#64748B" mb={2}>
              No extra members were created. You can add them later in Settings &gt; Users.
            </Typography>
          )}

          {memberErrors.length > 0 && (
            <Alert severity="warning" sx={{ borderRadius: '10px' }}>
              {memberErrors.length} member(s) could not be created. You can create them later from Settings &gt; Users.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleGoDashboard} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px' }}>
            Go to Dashboard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
