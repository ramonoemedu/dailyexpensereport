'use client';

import React, { useState, useEffect, useCallback } from "react";
import {
  IconButton,
  Tooltip,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
  CircularProgress,
  TextField,
  Button,
  Typography,
  Box,
  Avatar,
  Chip,
  Switch,
  FormControlLabel,
  InputAdornment,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import PowerIcon from "@mui/icons-material/PowerSettingsNew";
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useConfirm } from "@/hooks/NextAdmin/useConfirm";
import { ConfirmationDialog } from "@/components/NextAdmin/ui/ConfirmationDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/NextAdmin/ui/table";
import { cn } from "@/lib/NextAdmin/utils";
import { useAuthContext } from "@/components/AuthProvider";
import { useToast } from "@/components/NextAdmin/ui/toast";
import { cachedFetch, cacheInvalidate } from "@/utils/clientCache";

const USERS_CACHE_TTL = 2 * 60_000; // 2 minutes

interface SystemUser {
  id: string;
  fullName: string;
  username: string;
  loginEmail: string;
  userId: string;
  status: 'active' | 'inactive';
  email?: string;
  uid: string;
}

export default function UserManagementPage() {
  const { userRole, currentFamilyId } = useAuthContext();
  const { showToast } = useToast();
  const { confirm, isOpen: isConfirmOpen, options: confirmOptions, handleConfirm, handleCancel } = useConfirm();

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingUserId, setActionLoadingUserId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'toggle' | 'delete' | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<SystemUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    userId: '',
    email: '',
    password: '',
    status: true as boolean
  });

  const getAuthHeaders = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (!token) throw new Error("Authentication token is missing.");

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (userRole !== 'admin') {
        setUsers([]);
        if (!silent) setLoading(false);
        return;
      }

      const cacheKey = `admin-users:${currentFamilyId}`;
      if (!silent) {
        const users = await cachedFetch<SystemUser[]>(cacheKey, USERS_CACHE_TTL, async () => {
          const res = await fetch("/api/admin/users", {
            method: "GET",
            headers: { ...(await getAuthHeaders()), "x-family-id": currentFamilyId || "" },
          });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload?.error || "Failed to fetch users.");
          return (payload?.users || []) as SystemUser[];
        });
        setUsers(users);
      } else {
        // silent refresh: always bypass cache to get fresh data
        cacheInvalidate(cacheKey);
        const res = await fetch("/api/admin/users", {
          method: "GET",
          headers: { ...(await getAuthHeaders()), "x-family-id": currentFamilyId || "" },
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || "Failed to fetch users.");
        setUsers((payload?.users || []) as SystemUser[]);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userRole, currentFamilyId, getAuthHeaders]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openAddDialog = () => {
    setEditUser(null);
    setFormData({
      fullName: '',
      username: '',
      userId: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
      email: '',
      password: '',
      status: true
    });
    setDialogOpen(true);
  };

  const openEditDialog = (user: SystemUser) => {
    const fallbackUsername =
      user.username ||
      (user.loginEmail?.includes('@') ? user.loginEmail.split('@')[0] : '') ||
      (user.email?.includes('@') ? user.email.split('@')[0] : '') ||
      (user.uid || user.id).slice(0, 8);

    const fallbackEmail = user.email || user.loginEmail || '';

    setEditUser(user);
    setFormData({
      fullName: user.fullName || fallbackUsername,
      username: fallbackUsername,
      userId: user.userId || `USR-${(user.uid || user.id).slice(0, 4).toUpperCase()}`,
      email: fallbackEmail,
      password: '',
      status: user.status === 'active'
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.fullName || !formData.username || (!editUser && !formData.password)) {
      alert("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    try {
      const loginEmail = formData.email || `${formData.username}@clearport.local`;
      const status = formData.status ? 'active' : 'inactive';
      const headers = await getAuthHeaders();

      if (editUser) {
        const res = await fetch(`/api/admin/users/${editUser.uid || editUser.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            fullName: formData.fullName,
            username: formData.username,
            email: formData.email,
            status,
            userId: formData.userId,
            password: formData.password,
          }),
        });

        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to update user.");
        }
      } else {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: {
            ...headers,
            "x-family-id": currentFamilyId || "",
          },
          body: JSON.stringify({
            fullName: formData.fullName,
            username: formData.username,
            userId: formData.userId,
            email: formData.email,
            password: formData.password,
            status,
            loginEmail,
          }),
        });

        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to create user.");
        }
      }

      await fetchUsers(true);
      showToast(editUser ? "User updated successfully!" : "User created successfully!", "success");
      setDialogOpen(false);
    } catch (err: any) {
      console.error("Error saving user:", err);
      showToast(err.message || "Failed to save user.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (u: SystemUser) => {
    const targetId = u.uid || u.id;
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    const confirmed = await confirm({
      title: newStatus === 'inactive' ? 'Deactivate User?' : 'Activate User?',
      message: newStatus === 'inactive'
        ? `Deactivate ${u.fullName || u.username}? They will lose access immediately.`
        : `Activate ${u.fullName || u.username}? They will regain access.`,
      confirmText: newStatus === 'inactive' ? 'Deactivate' : 'Activate',
      type: newStatus === 'inactive' ? 'danger' : 'info',
    });
    if (!confirmed) return;
    try {
      setActionLoadingUserId(targetId);
      setActionType('toggle');
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/users/${u.uid || u.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fullName: u.fullName, username: u.username, email: u.email, status: newStatus, userId: u.userId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to update status.');
      setUsers((prev) => prev.map((row) => ((row.uid || row.id) === targetId ? { ...row, status: newStatus } : row)));
      await fetchUsers(true);
      showToast(`User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update status.', 'error');
    } finally {
      setActionLoadingUserId(null);
      setActionType(null);
    }
  };

  const handleDelete = async (u: SystemUser) => {
    const targetId = u.uid || u.id;
    const confirmed = await confirm({
      title: 'Delete User?',
      message: `Permanently delete ${u.fullName || u.username}? This cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      setActionLoadingUserId(targetId);
      setActionType('delete');
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/users/${u.uid || u.id}`, {
        method: 'DELETE',
        headers,
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to delete user.');
      setUsers((prev) => prev.filter((row) => (row.uid || row.id) !== targetId));
      await fetchUsers(true);
      showToast('User deleted successfully.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete user.', 'error');
    } finally {
      setActionLoadingUserId(null);
      setActionType(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-full space-y-6">
      <ConfirmationDialog
        open={isConfirmOpen}
        title={confirmOptions?.title || ''}
        message={confirmOptions?.message || ''}
        confirmText={confirmOptions?.confirmText}
        type={confirmOptions?.type}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-heading-5 font-bold text-dark dark:text-white">
              User Management
            </h1>
            <p className="text-body-sm font-medium text-dark-5">
              Manage system users and access permissions
            </p>
          </div>

          <button
            onClick={userRole === 'admin' ? openAddDialog : undefined}
            className={
              "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all shadow-md " +
              (userRole === 'admin' ? "bg-primary text-white hover:bg-opacity-90" : "bg-gray-300 text-gray-400 cursor-not-allowed")
            }
            disabled={userRole !== 'admin'}
          >
            Add New User
          </button>
        </div>

        <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark overflow-hidden">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-none bg-[#F7F9FC] dark:bg-dark-2 [&>th]:py-4 [&>th]:text-sm [&>th]:font-semibold [&>th]:text-dark [&>th]:dark:text-white">
                  <TableHead className="px-4 text-left">User</TableHead>
                  <TableHead className="px-4 text-left">User ID</TableHead>
                  <TableHead className="px-4 text-left">Username</TableHead>
                  <TableHead className="px-4 text-left">Status</TableHead>
                  <TableHead className="sticky right-0 z-10 bg-[#F7F9FC] dark:bg-dark-2 text-center px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton height={60} /></TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">No users found.</TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => {
                    const rowId = u.uid || u.id;
                    const rowBusy = actionLoadingUserId === rowId;
                    const deleting = rowBusy && actionType === 'delete';
                    const toggling = rowBusy && actionType === 'toggle';

                    return (
                      <TableRow key={u.id} className="group hover:bg-gray-2/50 dark:hover:bg-dark-2/50 transition-colors border-b border-stroke dark:border-dark-3 last:border-0">
                        <TableCell className="px-4 py-3.5">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', fontWeight: 'bold' }}>
                              {u.fullName ? u.fullName.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography className="font-bold text-dark dark:text-white text-sm">
                                {u.fullName || u.username}
                              </Typography>
                              <Typography variant="caption" className="text-dark-5">
                                {u.email || u.loginEmail || 'No email set'}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell className="px-4 py-3.5 font-medium text-dark dark:text-white">{u.userId}</TableCell>
                        <TableCell className="px-4 py-3.5 text-dark dark:text-white">{u.username}</TableCell>
                        <TableCell className="px-4 py-3.5">
                          <Chip
                            label={u.status.toUpperCase()}
                            size="small"
                            className={cn(
                              "font-bold",
                              u.status === 'active' ? "bg-green/10 text-green" : "bg-danger/10 text-danger"
                            )}
                          />
                        </TableCell>
                        <TableCell className="sticky right-0 z-10 bg-white group-hover:bg-gray-2/5 dark:bg-gray-dark dark:group-hover:bg-dark-2/5 text-center px-4">
                          <Tooltip title={userRole === 'admin' ? "Edit User" : "Only admins can edit"}>
                            <span>
                              <IconButton
                                onClick={userRole === 'admin' ? () => openEditDialog(u) : undefined}
                                size="small"
                                className={userRole === 'admin' ? "text-dark-4 hover:text-primary transition-colors" : "text-gray-300 cursor-not-allowed"}
                                disabled={userRole !== 'admin' || rowBusy}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={userRole === 'admin' ? (u.status === 'active' ? 'Deactivate User' : 'Activate User') : 'Only admins can change status'}>
                            <span>
                              <IconButton
                                onClick={userRole === 'admin' ? () => handleToggleStatus(u) : undefined}
                                size="small"
                                className={userRole === 'admin' ? (u.status === 'active' ? 'text-warning hover:text-orange-600 transition-colors' : 'text-green hover:text-green-700 transition-colors') : 'text-gray-300 cursor-not-allowed'}
                                disabled={userRole !== 'admin' || rowBusy}
                              >
                                {toggling ? <CircularProgress size={16} color="inherit" /> : <PowerIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={userRole === 'admin' ? "Delete User" : "Only admins can delete"}>
                            <span>
                              <IconButton
                                onClick={userRole === 'admin' ? () => handleDelete(u) : undefined}
                                size="small"
                                className={userRole === 'admin' ? "text-dark-4 hover:text-danger transition-colors" : "text-gray-300 cursor-not-allowed"}
                                disabled={userRole !== 'admin' || rowBusy}
                              >
                                {deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {userRole === 'admin' && (
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 32,
            right: 32,
            bgcolor: '#006BFF',
            boxShadow: '0 10px 15px -3px rgba(0, 107, 255, 0.3)',
            '&:hover': { bgcolor: '#0052CC' }
          }}
          onClick={openAddDialog}
        >
          <AddIcon />
        </Fab>
      )}

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
        disableEscapeKeyDown={userRole !== 'admin'}
      >
        <DialogTitle className="flex items-center justify-between border-b border-stroke p-6 dark:border-dark-3">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg",
              editUser ? "bg-secondary shadow-secondary/20" : "bg-primary shadow-primary/20"
            )}>
              {editUser ? <EditIcon /> : <PersonAddIcon />}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-dark dark:text-white leading-tight">
                {editUser ? "Edit System User" : "Create New User"}
              </h2>
              <p className="text-xs font-medium text-dark-5 mt-0.5">
                {editUser ? "Update account credentials and status" : "Register a new user to the system"}
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
                Full Name
              </label>
              <TextField
                required
                fullWidth
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="e.g. John Doe"
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
                  Username
                </label>
                <TextField
                  required
                  fullWidth
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  placeholder="johndoe"
                  helperText={editUser ? "You can change username." : undefined}
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
                  User ID
                </label>
                <TextField
                  fullWidth
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value.toUpperCase().trim() })}
                  placeholder="e.g. USR-1234"
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

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-dark-5 dark:text-dark-6 ml-1">
                Email (Optional)
              </label>
              <TextField
                fullWidth
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
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
                {editUser ? 'Reset Password (Optional)' : 'Login Password'}
              </label>
              <TextField
                required={!editUser}
                fullWidth
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editUser ? 'Enter new password to reset' : 'Enter login password'}
                helperText={editUser ? 'Leave blank to keep current password.' : undefined}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" className="mr-1">
                        {showPassword ? <VisibilityOff sx={{ fontSize: 20 }} /> : <Visibility sx={{ fontSize: 20 }} />}
                      </IconButton>
                    </InputAdornment>
                  )
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

            <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-stroke dark:bg-gray-dark dark:border-dark-3">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-dark dark:text-white">Account Status</span>
                <span className="text-[11px] text-dark-5">Toggle to enable or disable access</span>
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
            onClick={userRole === 'admin' ? handleSave : undefined}
            disabled={saving || userRole !== 'admin'}
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
            {saving ? <CircularProgress size={20} color="inherit" /> : editUser ? 'Update User' : 'Create Account'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}