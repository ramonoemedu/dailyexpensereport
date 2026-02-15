'use client';

import React from "react";
import {
  IconButton,
  Tooltip,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from '@mui/icons-material/Close';
import InventoryIcon from '@mui/icons-material/Inventory';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

import { dateFields } from "@/utils/KeySanitizer";
import { ExpenseDataTable } from "./ExpenseDataTable";
import { cn } from "@/lib/NextAdmin/utils";

type Props = {
  columns: string[];
  rows: Record<string, string | number>[];
  form: Record<string, string>;
  dialogOpen: boolean;
  editIndex: number | null;
  openEditDialog: (row: any, idx: number) => void;
  openAddDialog: () => void;
  handleDialogClose: () => void;
  handleDialogSave: () => void;
  handleChange: (col: string, value: string) => void;
  loading: boolean;
  saving: boolean;
  handleExportWithTemplate: () => void;
  dropdownOptions: Record<string, string[]>;
  openDetailDialog: (row: any) => void;
  uniqueDescriptions?: string[];
  handleDeactivate: (id: string) => void;
};

const FormField = ({
  label,
  children,
  className
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("space-y-1.5", className)}>
    <label className="text-xs font-bold uppercase tracking-wider text-dark-5 dark:text-dark-6">
      {label}
    </label>
    {children}
  </div>
);

const ExpenseDataFormPage: React.FC<Props> = ({
  columns,
  rows,
  form,
  dialogOpen,
  editIndex,
  openEditDialog,
  openAddDialog,
  handleDialogClose,
  handleDialogSave,
  handleChange,
  openDetailDialog,
  dropdownOptions,
  saving,
  uniqueDescriptions = [],
  handleDeactivate,
}) => {
  const descriptionRef = React.useRef<HTMLInputElement>(null);

  // Auto-focus description when dialog opens or after a save (indicated by form clearing)
  React.useEffect(() => {
    if (dialogOpen && editIndex === null && !saving && !form["Description"]) {
      // Small timeout to ensure the dialog animation doesn't steal focus
      const timer = setTimeout(() => {
        descriptionRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [dialogOpen, editIndex, saving, form["Description"]]);

  return (
    <div className="w-full">
      <ExpenseDataTable
        columns={columns}
        rows={rows}
        openEditDialog={openEditDialog}
        openDetailDialog={openDetailDialog}
        handleDeactivate={handleDeactivate}
      />

      <datalist id="description-suggestions">
        {uniqueDescriptions.map((desc) => (
          <option key={desc} value={desc} />
        ))}
      </datalist>

      <Tooltip title="Add Entry">
        <Fab
          color="primary"
          sx={{
            position: "fixed",
            bottom: 32,
            right: 32,
            zIndex: 1000,
            boxShadow: '0 10px 15px -3px rgba(0, 107, 255, 0.3)',
            bgcolor: '#006BFF',
            '&:hover': { bgcolor: '#0052CC' }
          }}
          onClick={openAddDialog}
        >
          <AddIcon />
        </Fab>
      </Tooltip>

      <Dialog
        open={dialogOpen}
        onClose={handleDialogClose}
        maxWidth="lg"
        fullWidth
        scroll="paper"
        PaperProps={{
          sx: {
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            backgroundImage: 'none',
          },
          className: "dark:bg-gray-dark dark:border dark:border-dark-3"
        }}
      >
        <DialogTitle className="flex items-center justify-between border-b border-stroke p-6 dark:border-dark-3 dark:bg-gray-dark">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg",
              editIndex !== null ? "bg-secondary shadow-secondary/20" : "bg-primary shadow-primary/20"
            )}>
              {editIndex !== null ? <InventoryIcon /> : <AddIcon />}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-dark dark:text-white">
                {editIndex !== null ? "Edit Expense" : "New Expense"}
              </h2>
              <p className="text-xs font-medium text-dark-5 dark:text-dark-6">
                {editIndex !== null ? "Update existing expense record" : "Create a new expense record"}
              </p>
            </div>
          </div>
          <IconButton
            onClick={handleDialogClose}
            size="small"
            className="rounded-xl bg-gray-2 text-dark-5 transition-all hover:bg-danger/10 hover:text-danger dark:bg-dark-2 dark:text-dark-6"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent className="bg-gray-2 p-6 dark:bg-[#020D1A]">
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <div className="grid grid-cols-1 gap-8 pt-2">
              <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
                <div className="mb-6 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <AttachMoneyIcon fontSize="small" />
                  </div>
                  <h3 className="text-lg font-bold text-dark dark:text-white text-heading-6">Expense Details</h3>
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                  {/* Explicitly add Type which was removed from columns list, removed Category */}
                  {["Type", ...columns].map((col) => {
                    if (col === "Credit" || col === "Date" || col === "Category") return null;

                    const isDebit = col === "Debit";
                    const label = isDebit ? "Amount" : col;
                    const valueKey = isDebit ? "Amount (Income/Expense)" : col;

                    let options = dropdownOptions[col];

                    return (
                      <FormField key={col} label={label}>
                        {options ? (
                          <select
                            value={form[valueKey] || "Expense"}
                            onChange={(e) => handleChange(valueKey, e.target.value)}
                            className="w-full rounded-xl border border-stroke bg-gray-2 px-4 py-2.5 text-sm text-dark outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                          >
                            <option value="">Select {col}</option>
                            {options.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            ref={col === "Description" ? descriptionRef : undefined}
                            type="text"
                            value={form[valueKey] || ""}
                            onChange={(e) => handleChange(valueKey, e.target.value)}
                            placeholder={`Enter ${label.toLowerCase()}`}
                            list={col === "Description" ? "description-suggestions" : undefined}
                            className="w-full rounded-xl border border-stroke bg-gray-2 px-4 py-2.5 text-sm text-dark outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                          />
                        )}
                      </FormField>
                    );
                  })}

                  {/* Date picker separately or as part of loop if included */}
                  <FormField label="Date" className="sm:col-span-2">
                    <DatePicker
                      value={form["Date"] ? dayjs(form["Date"]) : null}
                      onChange={(date) => handleChange("Date", date ? date.format("YYYY-MM-DD") : "")}
                      slotProps={{
                        textField: {
                          size: "small",
                          fullWidth: true,
                          sx: {
                            '& .MuiOutlinedInput-root': {
                              borderRadius: '12px',
                              backgroundColor: 'var(--color-gray-2)',
                              '& fieldset': { borderColor: 'var(--color-stroke)' },
                            }
                          }
                        },
                      }}
                    />
                  </FormField>
                </div>
              </div>
            </div>
          </LocalizationProvider>
        </DialogContent>

        <DialogActions className="border-t border-stroke p-6 dark:border-dark-3 dark:bg-gray-dark">
          <button
            onClick={handleDialogClose}
            className="rounded-xl px-6 py-3 text-sm font-bold text-dark-4 transition-all hover:bg-gray-2 hover:text-dark dark:text-dark-6 dark:hover:bg-dark-2 dark:hover:text-white"
          >
            Discard Changes
          </button>
          <button
            onClick={handleDialogSave}
            disabled={saving}
            className="inline-flex min-w-[160px] items-center justify-center rounded-xl bg-primary px-8 py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:bg-opacity-50"
          >
            {saving ? (
              <>
                <svg className="mr-2 h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              editIndex !== null ? "Update Expense" : "Create Expense"
            )}
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ExpenseDataFormPage;
