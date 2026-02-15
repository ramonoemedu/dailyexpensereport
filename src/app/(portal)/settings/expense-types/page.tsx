'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  CircularProgress,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { db } from '@/lib/firebase';
import { useToast } from '@/components/NextAdmin/ui/toast';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function ExpenseTypesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<string[]>([]);
  const [newType, setNewType] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'expenseTypes'));
        if (docSnap.exists()) {
          setTypes(docSnap.data().types || []);
        }
      } catch (error) {
        console.error("Error loading expense types:", error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (updatedList: string[]) => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'expenseTypes'), {
        types: updatedList
      });
      showToast("Expense types updated.", "success");
    } catch (error) {
      console.error("Error saving expense types:", error);
      showToast("Failed to save changes.", "error");
    } finally {
      setSaving(false);
    }
  };

  const addType = () => {
    if (!newType.trim()) return;
    if (types.includes(newType.trim())) {
      showToast("This category already exists.", "warning");
      return;
    }

    const updatedList = [...types, newType.trim()];
    setTypes(updatedList);
    handleSave(updatedList);
    setNewType('');
  };

  const removeType = (index: number) => {
    if (!confirm("Remove this category?")) return;
    const updatedList = types.filter((_, i) => i !== index);
    setTypes(updatedList);
    handleSave(updatedList);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="mx-auto w-full max-w-4xl space-y-6">
      <Box>
        <h1 className="text-heading-5 font-bold text-dark dark:text-white">Expense Types</h1>
        <p className="text-body-sm font-medium text-dark-5">Manage your expense categories (e.g. Food, Travel, Rent)</p>
      </Box>

      <Paper sx={{ borderRadius: '24px', overflow: 'hidden' }} className="dark:bg-gray-dark dark:border dark:border-dark-3">
        <Box p={4}>
          <Box display="flex" gap={2} mb={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Add Expense Type (e.g. Food)"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addType()}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
            <Button
              variant="contained"
              onClick={addType}
              startIcon={<AddIcon />}
              sx={{ 
                borderRadius: '12px', 
                textTransform: 'none', 
                bgcolor: '#006BFF',
                px: 4,
                fontWeight: 'bold'
              }}
            >
              Add
            </Button>
          </Box>

          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Current Expense Types
          </Typography>

          <List sx={{ bgcolor: 'rgba(0,0,0,0.02)', borderRadius: '16px' }} className="dark:bg-dark-2">
            {types.length === 0 ? (
              <ListItem>
                <ListItemText primary="No types defined yet." secondary="Add one above." />
              </ListItem>
            ) : (
              types.map((type, index) => (
                <React.Fragment key={type}>
                  <ListItem>
                    <ListItemText primary={type} />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => removeType(index)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < types.length - 1 && <Divider />}
                </React.Fragment>
              ))
            )}
          </List>
        </Box>
      </Paper>

      {saving && (
        <Box display="flex" alignItems="center" gap={1} justifyContent="center" color="text.secondary">
          <CircularProgress size={16} color="inherit" />
          <Typography variant="caption">Saving changes...</Typography>
        </Box>
      )}
    </Box>
  );
}
