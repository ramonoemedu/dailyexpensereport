'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/NextAdmin/ui/table";
import { cn } from "@/lib/NextAdmin/utils";
import dayjs from 'dayjs';
import { useToast } from '@/components/NextAdmin/ui/toast';

interface BalanceRecord {
  id: string;
  year: number;
  month: number;
  amount: number;
}

export default function StartingBalancePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [balances, setBalances] = useState<BalanceRecord[]>([]);
  const { showToast } = useToast();
  
  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<BalanceRecord | null>(null);
  const [formData, setFormData] = useState({
    year: dayjs().year(),
    month: dayjs().month(),
    amount: ''
  });

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const years = [2024, 2025, 2026];

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'settings'));
      const data = snapshot.docs
        .filter(d => d.id.startsWith('balance_'))
        .map(d => {
          const parts = d.id.split('_');
          return {
            id: d.id,
            year: parseInt(parts[1]),
            month: parseInt(parts[2]),
            amount: d.data().amount || 0
          };
        })
        .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
      setBalances(data);
    } catch (error) {
      console.error("Error fetching balances:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const openAddDialog = () => {
    setEditItem(null);
    setFormData({ 
        year: dayjs().year(), 
        month: dayjs().month(), 
        amount: '' 
    });
    setDialogOpen(true);
  };

  const openEditDialog = (item: BalanceRecord) => {
    setEditItem(item);
    setFormData({
      year: item.year,
      month: item.month,
      amount: item.amount.toString()
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.amount) return;
    setSaving(true);
    try {
      const docId = `balance_${formData.year}_${formData.month}`;
      const amount = parseFloat(formData.amount);

      await setDoc(doc(db, 'settings', docId), {
        amount: amount,
        updatedAt: new Date().toISOString()
      });
      
      await fetchBalances();
      showToast(editItem ? "Balance updated!" : "Balance created!", "success");
      setDialogOpen(false);
    } catch (error) {
      showToast("Error saving: " + (error as any).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this starting balance?")) return;
    try {
      await deleteDoc(doc(db, 'settings', id));
      await fetchBalances();
      showToast("Balance record deleted.", "success");
    } catch (error) {
      showToast("Error deleting: " + (error as any).message, "error");
    }
  };

  return (
    <Box className="mx-auto w-full max-w-full space-y-6">
      <Box className="flex flex-wrap items-center justify-between gap-4">
        <Box>
          <h1 className="text-heading-5 font-bold text-dark dark:text-white">Starting Balance Management</h1>
          <p className="text-body-sm font-medium text-dark-5">Manage your initial bank balance for each month</p>
        </Box>
        
        <Button
          variant="contained"
          onClick={openAddDialog}
          startIcon={<AddIcon />}
          sx={{ borderRadius: '12px', textTransform: 'none', bgcolor: '#006BFF', fontWeight: 'bold' }}
        >
          Set Starting Balance
        </Button>
      </Box>

      <Paper sx={{ borderRadius: '24px', overflow: 'hidden' }} className="dark:bg-gray-dark dark:border dark:border-dark-3">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-none bg-[#F7F9FC] dark:bg-dark-2">
                <TableHead className="px-6 py-4 font-bold">Month / Year</TableHead>
                <TableHead className="px-6 py-4 font-bold text-right">Starting Balance</TableHead>
                <TableHead className="px-6 py-4 font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-10"><CircularProgress size={24} /></TableCell></TableRow>
              ) : balances.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-10 text-dark-5">No balance records configured.</TableCell></TableRow>
              ) : (
                balances.map((item) => (
                  <TableRow key={item.id} className="hover:bg-gray-2/50 dark:hover:bg-dark-2/50 transition-colors">
                    <TableCell className="px-6 py-4 font-bold text-dark dark:text-white">
                        {months[item.month]} {item.year}
                    </TableCell>
                    <TableCell className="px-6 py-4 font-black text-primary text-right text-lg">
                        ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <IconButton onClick={() => openEditDialog(item)} size="small" color="primary" className="mr-1">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton onClick={() => handleDelete(item.id)} size="small" color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => !saving && setDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ 
          sx: { 
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            backgroundImage: 'none',
          },
          className: "dark:bg-gray-dark dark:border dark:border-dark-3"
        }}
      >
        <DialogTitle className="flex items-center justify-between border-b border-stroke p-6 dark:border-dark-3">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg",
              editItem ? "bg-secondary shadow-secondary/20" : "bg-primary shadow-primary/20"
            )}>
              {editItem ? <EditIcon /> : <AddIcon />}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-dark dark:text-white leading-tight">
                {editItem ? "Edit Balance" : "Set Starting Balance"}
              </h2>
              <p className="text-xs font-medium text-dark-5 mt-0.5">
                {editItem ? "Update existing record" : "Configure initial balance for a month"}
              </p>
            </div>
          </div>
          <IconButton 
            onClick={() => setDialogOpen(false)} 
            size="small"
            className="rounded-xl bg-gray-2 text-dark-5 hover:bg-danger/10 hover:text-danger transition-all dark:bg-dark-2"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        
        <DialogContent className="p-8 space-y-6 bg-gray-2/30 dark:bg-[#020D1A]/50">
          <div className="grid grid-cols-1 gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-dark-5 dark:text-dark-6 ml-1">
                  Year
                </label>
                <TextField
                  select
                  fullWidth
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value as string) })}
                  sx={{ 
                    '& .MuiOutlinedInput-root': { 
                      borderRadius: '16px',
                      backgroundColor: 'var(--color-background)',
                      '& fieldset': { borderColor: 'var(--color-stroke)' },
                    }
                  }}
                >
                  {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </TextField>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-dark-5 dark:text-dark-6 ml-1">
                  Month
                </label>
                <TextField
                  select
                  fullWidth
                  value={formData.month}
                  onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value as string) })}
                  sx={{ 
                    '& .MuiOutlinedInput-root': { 
                      borderRadius: '16px',
                      backgroundColor: 'var(--color-background)',
                      '& fieldset': { borderColor: 'var(--color-stroke)' },
                    }
                  }}
                >
                  {months.map((m, i) => <MenuItem key={m} value={i}>{m}</MenuItem>)}
                </TextField>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-dark-5 dark:text-dark-6 ml-1">
                Starting Balance Amount
              </label>
              <TextField
                required
                fullWidth
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value.replace(/[^0-9.]/g, '') })}
                placeholder="0.00"
                InputProps={{
                  startAdornment: <Typography className="mr-2 text-dark-5 font-bold">$</Typography>
                }}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    borderRadius: '16px',
                    backgroundColor: 'var(--color-background)',
                    '& fieldset': { borderColor: 'var(--color-stroke)' },
                  }
                }}
              />
            </div>
          </div>
        </DialogContent>
        
        <DialogActions className="p-6 border-t border-stroke dark:border-dark-3 bg-white dark:bg-gray-dark">
          <button 
            onClick={() => setDialogOpen(false)} 
            disabled={saving} 
            className="px-6 py-3 text-sm font-bold text-dark-4 hover:text-dark transition-colors mr-2 dark:text-dark-6 dark:hover:text-white"
          >
            Cancel
          </button>
          <Button 
            variant="contained" 
            onClick={handleSave} 
            disabled={saving}
            sx={{
              bgcolor: '#006BFF',
              fontWeight: 800,
              px: 6,
              py: 1.5,
              borderRadius: '16px',
              textTransform: 'none',
              fontSize: '0.875rem',
              boxShadow: '0 10px 15px -3px rgba(0, 107, 255, 0.2)',
              '&:hover': { 
                bgcolor: '#0052CC',
                boxShadow: '0 20px 25px -5px rgba(0, 107, 255, 0.3)'
              },
              '&:disabled': { bgcolor: 'rgba(0, 107, 255, 0.5)', color: 'white' }
            }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : editItem ? 'Update Balance' : 'Set Balance'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}