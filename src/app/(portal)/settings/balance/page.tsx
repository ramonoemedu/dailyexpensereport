'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  MenuItem,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { db } from '@/lib/firebase';
import { useToast } from '@/components/NextAdmin/ui/toast';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import dayjs from 'dayjs';

export default function StartingBalancePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState<string>('0');
  const [month, setMonth] = useState(dayjs().month());
  const [year, setYear] = useState(dayjs().year());
  const { showToast } = useToast();

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const years = [2024, 2025, 2026];

  useEffect(() => {
    async function loadBalance() {
      setLoading(true);
      try {
        const docRef = doc(db, 'settings', `balance_${year}_${month}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAmount(docSnap.data().amount?.toString() || '0');
        } else {
          setAmount('0');
        }
      } catch (error) {
        console.error("Error loading balance:", error);
      } finally {
        setLoading(false);
      }
    }
    loadBalance();
  }, [month, year]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const val = parseFloat(amount.replace(/,/g, ''));
      if (isNaN(val)) {
        showToast("Invalid amount.", "error");
        return;
      }

      await setDoc(doc(db, 'settings', `balance_${year}_${month}`), {
        amount: val,
        updatedAt: new Date().toISOString()
      });
      showToast(`Starting balance for ${months[month]} ${year} updated.`, "success");
    } catch (error) {
      console.error("Error saving balance:", error);
      showToast("Failed to save changes.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box className="mx-auto w-full max-w-4xl space-y-6">
      <Box>
        <h1 className="text-heading-5 font-bold text-dark dark:text-white">Starting Balance</h1>
        <p className="text-body-sm font-medium text-dark-5">Set your initial bank balance for each month to reconcile with your actual bank account.</p>
      </Box>

      <Paper sx={{ borderRadius: '24px', overflow: 'hidden' }} className="dark:bg-gray-dark dark:border dark:border-dark-3">
        <Box p={4} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField
              select
              fullWidth
              label="Year"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
              {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </TextField>

            <TextField
              select
              fullWidth
              label="Month"
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            >
              {months.map((m, i) => <MenuItem key={m} value={i}>{m}</MenuItem>)}
            </TextField>
          </div>

          <Box className="p-6 rounded-2xl bg-gray-2 dark:bg-dark-2 border border-stroke dark:border-dark-3">
            <Typography variant="subtitle2" className="mb-2 font-bold uppercase tracking-wider text-dark-5">
              Starting Balance for {months[month]} {year}
            </Typography>
            
            {loading ? (
              <Box display="flex" justifyContent="center" py={2}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <TextField
                fullWidth
                variant="outlined"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                InputProps={{
                  startAdornment: <Typography className="mr-2 text-dark-5 font-bold">$</Typography>,
                  sx: { fontSize: '2rem', fontWeight: 900, borderRadius: '16px' }
                }}
              />
            )}
          </Box>

          <Button
            fullWidth
            variant="contained"
            onClick={handleSave}
            disabled={saving || loading}
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            sx={{ 
              borderRadius: '16px', 
              py: 2,
              textTransform: 'none', 
              bgcolor: '#006BFF',
              fontWeight: 'bold',
              fontSize: '1rem',
              boxShadow: '0 10px 15px -3px rgba(0, 107, 255, 0.3)',
              '&:hover': { bgcolor: '#0052CC' }
            }}
          >
            {saving ? "Saving..." : "Save Starting Balance"}
          </Button>
        </Box>
      </Paper>
      
      <Box className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
        <h4 className="font-bold text-primary mb-1">Why is this important?</h4>
        <p className="text-sm text-dark-5 leading-relaxed">
          The Starting Balance is added to your income and minus your expenses to calculate your <strong>Current Bank Balance</strong>. 
          Each month can have its own starting balance, or you can set it once at the beginning of your tracking.
        </p>
      </Box>
    </Box>
  );
}
