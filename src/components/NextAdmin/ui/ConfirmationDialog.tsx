'use client';

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { cn } from "@/lib/NextAdmin/utils";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  type?: 'danger' | 'info' | 'warning';
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  type = 'danger'
}) => {
  const colors = {
    danger: {
      bg: 'bg-red-50 dark:bg-red-900/10',
      icon: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
      button: 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-900/10',
      icon: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
      button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200 dark:shadow-none',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/10',
      icon: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:shadow-none',
    }
  }[type];

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      PaperProps={{
        sx: {
          borderRadius: '24px',
          maxWidth: '400px',
          width: '100%',
          overflow: 'hidden'
        },
        className: "dark:bg-gray-dark border dark:border-dark-3"
      }}
    >
      <div className={cn("p-6 text-center", colors.bg)}>
        <div className={cn("mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl", colors.icon)}>
          <WarningAmberIcon sx={{ fontSize: 32 }} />
        </div>
        <h3 className="text-xl font-bold text-dark dark:text-white mb-2">{title}</h3>
        <p className="text-sm font-medium text-dark-5 dark:text-dark-6">
          {message}
        </p>
      </div>

      <div className="p-6 bg-white dark:bg-gray-dark flex flex-col gap-3">
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            "w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50",
            colors.button
          )}
        >
          {loading ? "Processing..." : confirmText}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="w-full py-3.5 rounded-xl text-sm font-bold text-dark-5 hover:bg-gray-2 dark:hover:bg-dark-2 transition-all"
        >
          {cancelText}
        </button>
      </div>
    </Dialog>
  );
};
