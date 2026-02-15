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
  Switch,
  FormControlLabel,
  Tooltip,
  MenuItem,
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  writeBatch
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
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

interface IncomeConfig {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  status: 'active' | 'inactive';
}

export default function IncomeTypesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<IncomeConfig[]>([]);
  const { showToast } = useToast();
  
  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<IncomeConfig | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    dayOfMonth: 1,
    status: true
  });

  // Monthly Process State
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [processType, setProcessType] = useState<'monthly' | 'yearly'>('monthly');
  const [processDate, setProcessDate] = useState<dayjs.Dayjs | null>(dayjs());

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'income_configs'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as IncomeConfig[];
      setConfigs(data);
    } catch (error) {
      console.error("Error fetching income configs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const openAddDialog = () => {
    setEditItem(null);
    setFormData({ name: '', amount: '', dayOfMonth: 1, status: true });
    setDialogOpen(true);
  };

  const openEditDialog = (item: IncomeConfig) => {
    setEditItem(item);
    setFormData({
      name: item.name,
      amount: item.amount.toString(),
      dayOfMonth: item.dayOfMonth,
      status: item.status === 'active'
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.amount) return;
    setSaving(true);
    try {
      const data = {
        name: formData.name,
        amount: parseFloat(formData.amount),
        dayOfMonth: formData.dayOfMonth,
        status: formData.status ? 'active' : 'inactive'
      };

      if (editItem) {
        await updateDoc(doc(db, 'income_configs', editItem.id), data);
      } else {
        await addDoc(collection(db, 'income_configs'), data);
      }
      await fetchConfigs();
      showToast(editItem ? "Income source updated!" : "Income source created!", "success");
      setDialogOpen(false);
    } catch (error) {
      showToast("Error saving: " + (error as any).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this income type?")) return;
    try {
      await deleteDoc(doc(db, 'income_configs', id));
      await fetchConfigs();
      showToast("Income type deleted.", "success");
    } catch (error) {
      showToast("Error deleting: " + (error as any).message, "error");
    }
  };

  const handleRunProcess = async () => {
    if (!processDate) return;
    setSaving(true);
    try {
      const activeConfigs = configs.filter(c => c.status === 'active');
      if (activeConfigs.length === 0) {
        showToast("No active income types to process.", "warning");
        return;
      }

      const expensesCol = collection(db, 'expenses');
      let createdCount = 0;
      let skippedCount = 0;

      // Determine months to process
      const monthsToProcess = processType === 'yearly' 
        ? Array.from({ length: 12 }, (_, i) => i) 
        : [processDate.month()];

      for (const monthIdx of monthsToProcess) {
        const currentTargetDate = processDate.month(monthIdx);
        
        for (const config of activeConfigs) {
          const dateStr = currentTargetDate.date(config.dayOfMonth).format('YYYY-MM-DD');
          
          // DUPLICATION CHECK: Search for existing income with same Name and Date
          const q = query(
            expensesCol, 
            where('Date', '==', dateStr),
            where('Category', '==', config.name),
            where('Type', '==', 'Income')
          );
          
          const existing = await getDocs(q);
          
          if (existing.empty) {
            await addDoc(expensesCol, {
              Date: dateStr,
              Type: 'Income',
              Category: config.name,
              Description: `Auto-Generated: ${config.name}`,
              Amount: config.amount,
              "Payment Method": 'Cash',
              createdAt: new Date().toISOString()
            });
            createdCount++;
          } else {
            skippedCount++;
          }
        }
      }

      showToast(`Success! Created: ${createdCount}, Skipped: ${skippedCount}`, "success");
      setProcessDialogOpen(false);
    } catch (error) {
      showToast("Error processing: " + (error as any).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box className="mx-auto w-full max-w-full space-y-6">
      <Box className="flex flex-wrap items-center justify-between gap-4">
        <Box>
          <h1 className="text-heading-5 font-bold text-dark dark:text-white">Income Automation</h1>
          <p className="text-body-sm font-medium text-dark-5">Manage recurring income and bulk process records</p>
        </Box>
        
        <Box className="flex gap-3">
          <Button
            variant="outlined"
            onClick={() => { setProcessType('monthly'); setProcessDialogOpen(true); }}
            startIcon={<PlayArrowIcon />}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 'bold' }}
          >
            Process Monthly
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => { setProcessType('yearly'); setProcessDialogOpen(true); }}
            startIcon={<PlayArrowIcon />}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 'bold' }}
          >
            Process Yearly
          </Button>
          <Button
            variant="contained"
            onClick={openAddDialog}
            startIcon={<AddIcon />}
            sx={{ borderRadius: '12px', textTransform: 'none', bgcolor: '#006BFF', fontWeight: 'bold' }}
          >
            Add Income Type
          </Button>
        </Box>
      </Box>

      <Paper sx={{ borderRadius: '24px', overflow: 'hidden' }} className="dark:bg-gray-dark dark:border dark:border-dark-3">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-none bg-[#F7F9FC] dark:bg-dark-2">
                <TableHead className="px-6 py-4 font-bold">Income Name</TableHead>
                <TableHead className="px-6 py-4 font-bold">Amount</TableHead>
                <TableHead className="px-6 py-4 font-bold text-center">Day of Month</TableHead>
                <TableHead className="px-6 py-4 font-bold">Status</TableHead>
                <TableHead className="px-6 py-4 font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10"><CircularProgress size={24} /></TableCell></TableRow>
              ) : configs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-dark-5">No income types configured.</TableCell></TableRow>
              ) : (
                configs.map((item) => (
                  <TableRow key={item.id} className="hover:bg-gray-2/50 dark:hover:bg-dark-2/50">
                    <TableCell className="px-6 py-4 font-bold text-dark dark:text-white">{item.name}</TableCell>
                    <TableCell className="px-6 py-4 font-bold text-success">${item.amount.toLocaleString()}</TableCell>
                    <TableCell className="px-6 py-4 text-center">{item.dayOfMonth}</TableCell>
                    <TableCell className="px-6 py-4">
                      <Chip 
                        label={item.status.toUpperCase()} 
                        size="small" 
                        className={cn("font-bold", item.status === 'active' ? "bg-green/10 text-green" : "bg-danger/10 text-danger")}
                      />
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <IconButton onClick={() => openEditDialog(item)} size="small" color="primary"><EditIcon fontSize="small" /></IconButton>
                      <IconButton onClick={() => handleDelete(item.id)} size="small" color="error"><DeleteIcon fontSize="small" /></IconButton>
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
                {editItem ? "Edit Income Source" : "New Income Source"}
              </h2>
              <p className="text-xs font-medium text-dark-5 mt-0.5">
                {editItem ? "Update recurring income details" : "Configure a new monthly income stream"}
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
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-dark-5 dark:text-dark-6 ml-1">
                Income Name
              </label>
              <TextField
                required
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Salary Husband"
                variant="outlined"
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    borderRadius: '16px',
                    backgroundColor: 'var(--color-background)',
                    '& fieldset': { borderColor: 'var(--color-stroke)' },
                    '&:hover fieldset': { borderColor: 'var(--color-primary)' },
                  }
                }}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-dark-5 dark:text-dark-6 ml-1">
                  Monthly Amount
                </label>
                <TextField
                  required
                  type="number"
                  fullWidth
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
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
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-dark-5 dark:text-dark-6 ml-1">
                  Payment Day
                </label>
                <TextField
                  select
                  fullWidth
                  value={formData.dayOfMonth}
                  onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value as string) })}
                  sx={{ 
                    '& .MuiOutlinedInput-root': { 
                      borderRadius: '16px',
                      backgroundColor: 'var(--color-background)',
                      '& fieldset': { borderColor: 'var(--color-stroke)' },
                    }
                  }}
                >
                  {[...Array(31)].map((_, i) => (
                    <MenuItem key={i + 1} value={i + 1}>Day {i + 1}</MenuItem>
                  ))}
                </TextField>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-stroke dark:bg-gray-dark dark:border-dark-3">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-dark dark:text-white">Active for Monthly Processing</span>
                <span className="text-[11px] text-dark-5">Disable this to stop automatic generation</span>
              </div>
              <FormControlLabel
                control={
                  <Switch 
                    checked={formData.status} 
                    onChange={(e) => setFormData({ ...formData, status: e.target.checked })}
                    color="primary"
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#006BFF' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#006BFF' },
                    }}
                  />
                }
                label={
                  <Typography className={cn(
                    "text-xs font-black uppercase tracking-tighter",
                    formData.status ? "text-primary" : "text-danger"
                  )}>
                    {formData.status ? 'Active' : 'Inactive'}
                  </Typography>
                }
                labelPlacement="start"
                className="m-0"
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
            {saving ? <CircularProgress size={20} color="inherit" /> : editItem ? 'Update Source' : 'Create Source'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Process Dialog */}
      <Dialog 
        open={processDialogOpen} 
        onClose={() => !saving && setProcessDialogOpen(false)} 
        maxWidth="xs" 
        fullWidth 
        PaperProps={{ 
          sx: { borderRadius: '24px' },
          className: "dark:bg-gray-dark dark:border dark:border-dark-3"
        }}
      >
        <DialogTitle className="font-bold border-b border-stroke p-6 dark:border-dark-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg",
              processType === 'yearly' ? "bg-secondary shadow-secondary/20" : "bg-success shadow-success/20"
            )}>
              <PlayArrowIcon />
            </div>
            <h2 className="text-xl font-extrabold text-dark dark:text-white">
              {processType === 'yearly' ? 'Run Yearly Process' : 'Run Monthly Process'}
            </h2>
          </div>
        </DialogTitle>
        <DialogContent className="p-6 pt-8">
          <Typography variant="body2" color="text.secondary" mb={4}>
            {processType === 'yearly' 
              ? `Select a year. The system will generate income records for all 12 months. It will automatically skip any records that already exist.`
              : `Select a month. The system will generate income records for that month and skip any duplicates.`}
          </Typography>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label={processType === 'yearly' ? "Select Year" : "Select Month & Year"}
              views={processType === 'yearly' ? ['year'] : ['year', 'month']}
              value={processDate}
              onChange={(newValue) => setProcessDate(newValue)}
              slotProps={{ 
                textField: { 
                  fullWidth: true,
                  sx: { '& .MuiOutlinedInput-root': { borderRadius: '16px' } }
                } 
              }}
            />
          </LocalizationProvider>
        </DialogContent>
        <DialogActions className="p-6 border-t border-stroke dark:border-dark-3">
          <button onClick={() => setProcessDialogOpen(false)} className="text-sm font-bold text-dark-4 mr-4">Cancel</button>
          <Button 
            variant="contained" 
            onClick={handleRunProcess} 
            disabled={saving} 
            sx={{ 
              bgcolor: processType === 'yearly' ? '#7C3AED' : '#10B981', 
              borderRadius: '12px', 
              fontWeight: 'bold',
              '&:hover': { bgcolor: processType === 'yearly' ? '#6D28D9' : '#059669' }
            }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : "Run Automation"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}