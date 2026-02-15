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

const initialForm = columns.reduce((acc, col) => {
  if (dateFields.includes(col)) {
    acc[col] = dayjs().format("YYYY-MM-DD");
  } else if (col === "Type") {
    acc[col] = "Expense";
  } else if (col === "Payment Method") {
    acc[col] = "Chip Mong Bank";
  } else {
    acc[col] = "";
  }
  return acc;
}, {} as Record<string, string>);

export default function DailyExpenseRoute() {
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
    stats,
    uniqueDescriptions,
  } = useExpenseData();
  const { showToast } = useToast();

  const [form, setForm] = useState<Record<string, string>>(initialForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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
  }, [searchText, date, typeFilter, month, year]);

  useEffect(() => {
    fetchRows(page, { searchText, date, typeFilter, month, year });
  }, [page, fetchRows, searchText, date, typeFilter, month, year]);

  const openAddDialog = () => {
    setForm(initialForm);
    setEditIndex(null);
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
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setForm(initialForm);
    setEditIndex(null);
  };

  const handleDialogSave = async () => {
    const sanitizedForm: Record<string, any> = {};
    for (const [key, value] of Object.entries(form)) {
      if (value !== undefined) {
        const val = dateFields.includes(key) && value ? dayjs(value).format("YYYY-MM-DD") : value;
        // Map UI key to Firestore key
        const firestoreKey = key === "Amount (Income/Expense)" ? "Amount" : sanitizeKey(key);
        sanitizedForm[firestoreKey] = val;
      }
    }

    const id = editIndex !== null ? (rows[editIndex].id as string) : null;
    const success = await saveEntry(id, sanitizedForm);

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
    if (!confirm("Are you sure you want to deactivate this record? It will be hidden from reports.")) return;
    
    const success = await deactivateEntry(id);
    if (success) {
      showToast("Record deactivated successfully.", "success");
    } else {
      showToast("Failed to deactivate record.", "error");
    }
  };

  const handleChange = (col: string, value: string) => {
    // If user enters a negative sign for expense, we can keep it or normalize it
    // But the UI will handle display based on Type
    setForm({ ...form, [col]: value });
  };

  return (
    <div className="mx-auto w-full max-w-full space-y-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-heading-5 font-bold text-dark dark:text-white">
              Daily Expense Report
            </h1>
            <p className="text-body-sm font-medium text-dark-5">
              Manage and track daily expenses
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
            label="Weekly Expense"
            data={{ value: `$${stats.weeklyExpense.toLocaleString()}`, growthRate: 0 }}
            Icon={ExpenseIcon}
          />
          <OverviewCard
            label="Weekly Balance"
            data={{ value: `$${(stats.weeklyIncome - stats.weeklyExpense).toLocaleString()}`, growthRate: 0 }}
            Icon={BalanceIcon}
          />
          <OverviewCard
            label={`${months[month]} Income`}
            data={{ value: `$${stats.monthlyIncome.toLocaleString()}`, growthRate: 0 }}
            Icon={IncomeIcon}
          />
          <OverviewCard
            label={`${months[month]} Expense`}
            data={{ value: `$${stats.monthlyExpense.toLocaleString()}`, growthRate: 0 }}
            Icon={ExpenseIcon}
          />
          <OverviewCard
            label={`${months[month]} Balance`}
            data={{ value: `$${(stats.monthlyIncome - stats.monthlyExpense).toLocaleString()}`, growthRate: 0 }}
            Icon={BalanceIcon}
          />
        </div>

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
                handleExportWithTemplate={() => {}}
                dropdownOptions={dropdownOptions}
                uniqueDescriptions={uniqueDescriptions}
                handleDeactivate={onDeactivate}
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
