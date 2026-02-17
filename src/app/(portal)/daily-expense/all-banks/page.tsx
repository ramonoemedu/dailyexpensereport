'use client';

import React, { useState, useEffect } from "react";
import ExpenseDataFormPage from "@/components/ExpenseDataForm/ExpenseDataFormPage";
import ExpenseDetail from "@/components/ExpenseDataForm/ExpenseDetail";
import dayjs from "dayjs";
import Pagination from "@mui/material/Pagination";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { columns, dateFields, PAGE_SIZE, sanitizeKey } from "@/utils/KeySanitizer";
import { Skeleton } from "@mui/material";
import { SearchIcon } from "@/assets/icons";
import { useExpenseData } from "@/hooks/useExpenseData";
import { OverviewCard } from "@/components/NextAdmin/Dashboard/overview-cards/card";
import {
  Views as IncomeIcon,
  Profit as ExpenseIcon,
  Product as BalanceIcon
} from "@/components/NextAdmin/Dashboard/overview-cards/icons";
import { useToast } from "@/components/NextAdmin/ui/toast";
import { ConfirmationDialog } from "@/components/NextAdmin/ui/ConfirmationDialog";
import { useConfirm } from "@/hooks/NextAdmin/useConfirm";
import { BANKS } from "@/utils/bankConstants";

const initialForm = columns.reduce((acc, col) => {
  if (dateFields.includes(col)) {
    acc[col] = dayjs().format("YYYY-MM-DD");
  } else if (col === "Type") {
    acc[col] = "Expense";
  } else if (col === "Currency") {
    acc[col] = "USD";
  } else {
    acc[col] = "";
  }
  return acc;
}, {} as Record<string, string>);

export default function DailyExpenseAllBanksPage() {
  const bankName = "All Banks"; // Title for this page

  // Moved statusFilter declaration here
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const {
    rows,
    loading,
    saving,
    totalRows,
    fetchRows,
    dropdownOptions,
    saveEntry,
    deactivateEntry,
    activateEntry,
    stats,
    filteredStats,
    uniqueDescriptions,
  } = useExpenseData({
    paymentMethodFilter: BANKS.map(bank => bank.name), // Filter for all bank names
    balanceType: 'bank',
    statusFilter: statusFilter // Pass the statusFilter here
  });
  const { showToast } = useToast();
  const { confirm, isOpen: isConfirmOpen, options: confirmOptions, handleConfirm, handleCancel } = useConfirm();

  // Re-introduced state declarations
  const [form, setForm] = useState<Record<string, string>>(initialForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [sendToTelegram, setSendToTelegram] = useState(true);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("All");
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [page, setPage] = useState(1);
  // ... existing state

  // --- ADD THESE LINES ---

  const openDetailDialog = (row: any) => {
    if (!row || !row.id) return;
    setDetailId(row.id);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
    setDetailId(null);
  };

  const handleDetailSaved = async () => {
    await fetchRows(page);
    handleDetailClose();
  };

  useEffect(() => {
    setPage(1);
  }, [searchText, date, typeFilter, month, year, statusFilter]); // Added statusFilter to dependencies

  useEffect(() => {
    fetchRows(page, { searchText, date, typeFilter, month, year, statusFilter }); // Pass statusFilter
  }, [page, fetchRows, searchText, date, typeFilter, month, year, statusFilter]); // Added statusFilter to dependencies

  const openAddDialog = () => {
    setForm(initialForm);
    setEditIndex(null);
    setSendToTelegram(true);
    setDialogOpen(true);
  };

  const openEditDialog = (row: any, idx: number) => {
    const { id, ...rowWithoutId } = row;
    const formWithDefaults = { ...initialForm, ...rowWithoutId };

    // Ensure 'Amount (Income/Expense)' is populated from whatever key contains the value
    if (row["Amount (Income/Expense)"] !== undefined) {
      formWithDefaults["Amount (Income/Expense)"] = row["Amount (Income/Expense)"].toString();
    } else if (row["Amount"] !== undefined) {
      formWithDefaults["Amount (Income/Expense)"] = row["Amount"].toString();
    }

    setForm(formWithDefaults);
    setEditIndex(idx);
    setSendToTelegram(true);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setForm(initialForm);
    setEditIndex(null);
  };

  const handleDialogSave = async () => {
    // Validation
    const description = form["Description"]?.trim();
    const amountStr = form["Amount (Income/Expense)"]?.toString().trim();

    if (!description) {
      showToast("Description is required.", "error");
      return;
    }

    if (!amountStr) {
      showToast("Amount is required.", "error");
      return;
    }

    // Replace comma with dot and parse
    const normalizedAmount = amountStr.replace(/,/g, ".");
    const amount = parseFloat(normalizedAmount);

    if (isNaN(amount)) {
      showToast("Amount must be a valid number.", "error");
      return;
    }

    if (amount === 0) {
      showToast("Amount cannot be zero.", "error");
      return;
    }

    const sanitizedForm: Record<string, any> = {};
    for (const [key, value] of Object.entries(form)) {
      if (value !== undefined) {
        const val = dateFields.includes(key) && value ? dayjs(value).format("YYYY-MM-DD") : value;
        // Map UI key to Firestore key
        const firestoreKey = key === "Amount (Income/Expense)" ? "Amount" : sanitizeKey(key);

        // Use normalized amount for the Amount field
        if (firestoreKey === "Amount") {
          sanitizedForm[firestoreKey] = amount;
        } else {
          sanitizedForm[firestoreKey] = val;
        }
      }
    }

    const id = editIndex !== null ? (rows[editIndex].id as string) : null;
    const success = await saveEntry(id, sanitizedForm, sendToTelegram);

    if (success) {
      showToast(editIndex !== null ? "Entry updated successfully!" : "Entry created successfully!", "success");
      await fetchRows(page);
      // Don't close dialog, just clear form for next entry
      setForm(initialForm);
      setEditIndex(null);
    } else {
      showToast("Failed to save entry. Please try again.", "error");
    }
  };

  const onDeactivate = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Deactivate Record?',
      message: 'Are you sure you want to deactivate this record? It will be hidden from reports.',
      confirmText: 'Deactivate',
      type: 'danger'
    });

    if (!isConfirmed) return;

    const success = await deactivateEntry(id, sendToTelegram);
    if (success) {
      showToast("Record deactivated successfully.", "success");
    } else {
      showToast("Failed to deactivate record.", "error");
    }
  };

  const onActivate = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Activate Record?',
      message: 'Are you sure you want to activate this record again?',
      confirmText: 'Activate',
      type: 'info'
    });

    if (!isConfirmed) return;

    const success = await activateEntry(id, sendToTelegram);
    if (success) {
      showToast("Record activated successfully.", "success");
    } else {
      showToast("Failed to activate record.", "error");
    }
  };

  const handleChange = (col: string, value: string) => {
    // If user enters a negative sign for expense, we can keep it or normalize it
    // But the UI will handle display based on Type
    setForm({ ...form, [col]: value });
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
              Daily Expense Report ({bankName})
            </h1>
            <p className="text-body-sm font-medium text-dark-5">
              Manage and track daily {bankName} expenses
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openAddDialog}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-all hover:bg-opacity-90 shadow-md"
            >
              Add New Entry
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <OverviewCard
            label="Initial Carryover"
            data={{ value: `$${stats.startingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, growthRate: 0 }}
            Icon={BalanceIcon}
            gradient="blue"
          />
          <OverviewCard
            label={`${months[month]} Income`}
            data={{ value: `$${stats.monthlyIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, growthRate: 0 }}
            Icon={IncomeIcon}
            gradient="green"
          />
          <OverviewCard
            label={`${months[month]} Expense`}
            data={{ value: `$${stats.monthlyExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, growthRate: 0 }}
            Icon={ExpenseIcon}
            gradient="red"
          />
          <OverviewCard
            label="Monthly Profit/Loss"
            data={{ value: `${(stats.monthlyIncome - stats.monthlyExpense) >= 0 ? '+' : ''}$${(stats.monthlyIncome - stats.monthlyExpense).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, growthRate: 0 }}
            Icon={BalanceIcon}
            gradient="purple"
          />
          <OverviewCard
            label="Total Balance"
            data={{ value: `$${stats.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, growthRate: 0 }}
            Icon={BalanceIcon}
            gradient="dark"
          />
        </div>

        {date && (
          <div className="grid gap-4 sm:grid-cols-2 animate-fade-in">
            <OverviewCard
              label={`Total Debit (${dayjs(date).format('DD MMM')})`}
              data={{ value: `$${filteredStats.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, growthRate: 0 }}
              Icon={IncomeIcon}
              gradient="green"
            />
            <OverviewCard
              label={`Total Credit (${dayjs(date).format('DD MMM')})`}
              data={{ value: `$${filteredStats.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, growthRate: 0 }}
              Icon={ExpenseIcon}
              gradient="red"
            />
          </div>
        )}

        <div className="rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark md:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="relative">
              <span className="absolute left-4.5 top-1/2 -translate-y-1/2">
                <SearchIcon />
              </span>
              <input
                type="text"
                placeholder="Search..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full rounded-lg border border-stroke bg-gray-2 py-2.5 pl-12 pr-4.5 text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
              />
            </div>

            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="w-full rounded-lg border border-stroke bg-gray-2 py-2 px-4 text-sm font-medium text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            >
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full rounded-lg border border-stroke bg-gray-2 py-2 px-4 text-sm font-medium text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            >
              {[2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-stroke bg-gray-2 py-2 px-4 text-sm font-medium text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            >
              <option value="All">All Types</option>
              <option value="Income">Income (Debit)</option>
              <option value="Expense">Expense (Credit)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="w-full rounded-lg border border-stroke bg-gray-2 py-2 px-4 text-sm font-medium text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Date"
                value={date ? dayjs(date) : null}
                onChange={(d) => {
                  if (d) {
                    setDate(d.format("YYYY-MM-DD"));
                    setMonth(d.month());
                    setYear(d.year());
                  } else {
                    setDate(null);
                  }
                }}
                slotProps={{
                  textField: { size: "small", fullWidth: true },
                }}
              />
            </LocalizationProvider>

            <button
              onClick={() => {
                setSearchText("");
                setDate(null);
                setTypeFilter("All");
                setMonth(new Date().getMonth());
                setYear(new Date().getFullYear());
              }}
              className="w-full rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2 transition-all"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="relative min-h-[400px]">
          {loading && rows.length === 0 ? (
            <div className="space-y-4">
              {[...Array(PAGE_SIZE)].map((_, i) => (
                <Skeleton key={i} variant="rectangular" height={60} className="rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              <ExpenseDataFormPage
                columns={columns}
                rows={rows}
                form={form}
                dialogOpen={dialogOpen}
                editIndex={editIndex}
                openEditDialog={openEditDialog}
                openDetailDialog={openDetailDialog}
                openAddDialog={openAddDialog}
                handleDialogClose={handleDialogClose}
                handleDialogSave={handleDialogSave}
                handleChange={handleChange}
                loading={loading}
                saving={saving}
                handleExportWithTemplate={() => { }}
                dropdownOptions={dropdownOptions}
                uniqueDescriptions={uniqueDescriptions}
                handleDeactivate={onDeactivate}
                handleActivate={onActivate}
                sendToTelegram={sendToTelegram}
                setSendToTelegram={setSendToTelegram}
                bankName={bankName}
              />

              <ExpenseDetail
                id={detailId}
                open={detailOpen}
                onClose={handleDetailClose}
                onSaved={handleDetailSaved}
                dropdownOptions={dropdownOptions}
              />

              <div className="mt-6 flex flex-col items-center justify-between gap-4 md:flex-row border-t border-stroke pt-6 dark:border-dark-3">
                <p className="text-sm font-medium text-dark-5">
                  Showing <span className="text-dark dark:text-white">{rows.length}</span> of{" "}
                  <span className="text-dark dark:text-white">{totalRows}</span> entries
                </p>

                {totalRows > PAGE_SIZE && (
                  <Pagination
                    count={Math.ceil(totalRows / PAGE_SIZE)}
                    page={page}
                    onChange={(_, value) => {
                      setPage(value);
                      fetchRows(value);
                    }}
                    color="primary"
                    shape="rounded"
                    size="medium"
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
