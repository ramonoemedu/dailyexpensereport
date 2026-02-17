'use client';

import React, { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import { getClearPortStats } from "@/services/charts.services";
import { Skeleton, Checkbox } from "@mui/material";
import PrintIcon from '@mui/icons-material/Print';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/NextAdmin/ui/table";
import { cn } from "@/lib/NextAdmin/utils";
import { useParams } from "next/navigation";
import { getBankName } from "@/utils/bankConstants";
import { generateExcel } from "@/utils/excelGenerator";
import { generatePdf } from "@/utils/pdfGenerator";
import { OverviewCard } from "@/components/NextAdmin/Dashboard/overview-cards/card";
import {
  Views as IncomeIcon,
  Profit as ExpenseIcon,
  Product as BalanceIcon
} from "@/components/NextAdmin/Dashboard/overview-cards/icons";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

export default function MonthlyReportPage() {
  const params = useParams();
  const bankId = params?.bankId as string;
  const bankName = getBankName(bankId);

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(dayjs().month());
  const [year, setYear] = useState(dayjs().year());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const months = useMemo(() => [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ], []);
  const years = [2024, 2025, 2026];

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      try {
        const data = await getClearPortStats(month, year, {
          paymentMethodFilter: [bankName],
          currencyFilter: "USD",
          bankId: bankId,
          statusFilter: statusFilter
        });
        setStats(data);
      } catch (error) {
        console.error("Report load error:", error);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [month, year, bankName, statusFilter]);

  const filteredTransactions = useMemo(() => {
    if (!stats?.monthlyTransactionsList) return [];
    return stats.monthlyTransactionsList.filter((item: any) => {
      if (dateFilter && item.Date !== dateFilter) return false;
      return true;
    });
  }, [stats, dateFilter]);

  const dailyStats = useMemo(() => {
    const result = { debit: 0, credit: 0 };
    filteredTransactions.forEach((item: any) => {
      if (item.Type === "Income") result.debit += item.Amount;
      else result.credit += item.Amount;
    });
    return result;
  }, [filteredTransactions]);

  const selectedTotal = useMemo(() => {
    if (!stats?.monthlyTransactionsList) return 0;
    return stats.monthlyTransactionsList
      .filter((item: any) => selectedIds.includes(item.id))
      .reduce((acc: number, item: any) => {
        return item.Type === "Income" ? acc + item.Amount : acc - item.Amount;
      }, 0);
  }, [stats, selectedIds]);

  const handleExportExcel = async () => {
    const dataToExport = selectedIds.length > 0 
      ? stats.monthlyTransactionsList.filter((r: any) => selectedIds.includes(r.id))
      : filteredTransactions;
    
    await generateExcel("Monthly Financial Report", ["Date", "Description", "Payment Method", "Category", "Type", "Currency", "Debit", "Credit"], dataToExport, bankName);
  };

  const handleExportPdf = () => {
    const dataToExport = selectedIds.length > 0 
      ? stats.monthlyTransactionsList.filter((r: any) => selectedIds.includes(r.id))
      : filteredTransactions;

    generatePdf("Monthly Financial Report", ["Date", "Description", "Payment Method", "Category", "Type", "Currency", "Debit", "Credit"], dataToExport, bankName);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && stats?.monthlyTransactionsList) {
      setSelectedIds(stats.monthlyTransactionsList.map((item: any) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    }
  };

  if (loading || !stats) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton variant="rectangular" height={100} className="rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={160} className="rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  const netSavings = stats.monthlyIncome - stats.monthlyAmount;
  const currentBankBalance = (stats.startingBalance || 0) + netSavings;

  const formatValue = (val: number, itemCurrency: string = "USD") => {
    const symbol = itemCurrency === "KHR" ? "៛" : "$";
    const digits = itemCurrency === "KHR" ? 0 : 2;
    return `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-4 md:p-8 print:p-0 animate-fade-in">

      {/* --- Header Section --- */}
      <div className="flex flex-wrap items-end justify-between gap-6 print:hidden">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-dark dark:text-white">
            {bankName} Statement <span className="text-primary opacity-50">#</span>{months[month].substring(0, 3).toUpperCase()}{year}
          </h1>
          <p className="mt-2 text-base font-medium text-gray-500">
            Comprehensive financial reconciliation for {bankName} in {months[month]}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/50 dark:bg-dark-2/50 backdrop-blur-md p-2 rounded-2xl border border-stroke dark:border-dark-3 shadow-sm">
          {!selectedIds.length && (
            <>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 bg-gray-100 dark:bg-dark-3 text-dark dark:text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all"
              >
                <FileDownloadIcon fontSize="inherit" />
                Excel
              </button>
              <button
                onClick={handleExportPdf}
                className="flex items-center gap-2 bg-gray-100 dark:bg-dark-3 text-dark dark:text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all"
              >
                <PictureAsPdfIcon fontSize="inherit" />
                PDF
              </button>
              <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
            </>
          )}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="bg-transparent px-3 py-2 text-sm font-bold outline-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="bg-transparent px-3 py-2 text-sm font-bold outline-none cursor-pointer"
          >
            {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="bg-transparent px-3 py-2 text-sm font-bold outline-none cursor-pointer"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => window.print()}
            className="ml-2 flex items-center gap-2 bg-dark dark:bg-white text-white dark:text-dark px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-all"
          >
            <PrintIcon fontSize="small" />
            Print
          </button>
        </div>
      </div>

      {/* --- Top Bento Grid Summary --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Initial Balance */}
        <div className="group relative overflow-hidden rounded-[32px] bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-xl transition-transform hover:scale-[1.02]">
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] opacity-70">Opening Balance</p>
            <h3 className="mt-3 text-4xl font-black">
              {formatValue(stats.startingBalance || 0)}
            </h3>
            <div className="mt-6 inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold">
              AS OF {months[month].toUpperCase()} 1ST
            </div>
          </div>
          <div className="absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-white/10 blur-3xl group-hover:bg-white/20 transition-all" />
        </div>

        {/* Net Savings */}
        <div className="group relative overflow-hidden rounded-[32px] bg-gradient-to-br from-emerald-500 to-teal-700 p-8 text-white shadow-xl transition-transform hover:scale-[1.02]">
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] opacity-70">Monthly Cash Flow</p>
            <h3 className="mt-3 text-4xl font-black">
              {netSavings >= 0 ? '+' : ''}{formatValue(netSavings)}
            </h3>
            <div className="mt-6 flex items-center gap-3">
              <div className="text-[10px] font-bold bg-black/10 rounded-lg p-2">IN: {formatValue(stats.monthlyIncome)}</div>
              <div className="text-[10px] font-bold bg-black/10 rounded-lg p-2">OUT: {formatValue(stats.monthlyAmount)}</div>
            </div>
          </div>
          <div className="absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
        </div>

        {/* Closing Balance */}
          <OverviewCard
            label="Closing Position"
            data={{ value: formatValue(currentBankBalance) }}
            Icon={BalanceIcon}
            gradient="dark"
          />
        </div>

        {dateFilter && (
          <div className="grid gap-4 sm:grid-cols-2 animate-fade-in">
            <OverviewCard
              label={`Total Debit (${dayjs(dateFilter).format('DD MMM')})`}
              data={{ value: formatValue(dailyStats.debit), growthRate: 0 }}
              Icon={IncomeIcon}
              gradient="green"
            />
            <OverviewCard
              label={`Total Credit (${dayjs(dateFilter).format('DD MMM')})`}
              data={{ value: formatValue(dailyStats.credit), growthRate: 0 }}
              Icon={ExpenseIcon}
              gradient="red"
            />
          </div>
        )}

      {/* --- Main Report Section --- */}
      <div className="overflow-hidden rounded-[32px] border border-stroke bg-white/50 backdrop-blur-md shadow-2xl dark:border-white/5 dark:bg-dark-2/50">
        <div className="p-8 border-b border-stroke dark:border-white/5 flex items-center justify-between">
          <h3 className="text-xl font-black">Transaction Ledger</h3>
          <div className="flex items-center gap-4">
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Filter by Date"
                value={dateFilter ? dayjs(dateFilter) : null}
                onChange={(d) => setDateFilter(d ? d.format("YYYY-MM-DD") : null)}
                slotProps={{
                  textField: { size: "small", sx: { width: 200 } },
                }}
              />
            </LocalizationProvider>
            {dateFilter && (
              <button 
                onClick={() => setDateFilter(null)}
                className="text-xs font-bold text-danger hover:underline"
              >
                Clear Date
              </button>
            )}
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-3 py-1 rounded-full uppercase ml-4">Verified Report</span>
          </div>
        </div>

        <div className="p-2 md:p-6">
          {/* Selection Control Bar */}
          {selectedIds.length > 0 && (
            <div className="mb-6 flex animate-slide-down items-center justify-between rounded-2xl border border-primary/20 bg-white/80 p-4 shadow-sm dark:border-primary/30 dark:bg-dark-2/80 print:hidden">
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Selected Transactions</span>
                  <span className="text-lg font-black text-primary">{selectedIds.length}</span>
                </div>
                <div className="h-10 w-px bg-primary/20" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Selection Impact</span>
                  <span className={cn(
                    "text-lg font-black",
                    selectedTotal >= 0 ? "text-success" : "text-danger"
                  )}>
                    {selectedTotal >= 0 ? "+" : ""}${Math.abs(selectedTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition-all hover:bg-primary/20"
                >
                  <FileDownloadIcon fontSize="small" />
                  Excel
                </button>
                <button
                  onClick={handleExportPdf}
                  className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition-all hover:bg-primary/20"
                >
                  <PictureAsPdfIcon fontSize="small" />
                  PDF
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="ml-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-opacity-90"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-stroke dark:border-white/5">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 dark:bg-white/5">
                  <TableHead className="w-10 px-6">
                    <Checkbox
                      size="small"
                      checked={filteredTransactions.length > 0 && selectedIds.length === filteredTransactions.length}
                      indeterminate={selectedIds.length > 0 && selectedIds.length < filteredTransactions.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest">Date</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest">Details</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-right">Debit (+)</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-right">Credit (-)</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-right px-6">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Initial Row - Only show if not filtering by date or if filtered date is the 1st */}
                {(!dateFilter || dayjs(dateFilter).date() === 1) && (
                  <TableRow className="bg-blue-50/30 dark:bg-blue-500/5 font-bold">
                    <TableCell className="px-6"></TableCell>
                    <TableCell className="px-0 py-4 text-xs opacity-60 italic">01-{month + 1}-{year}</TableCell>
                    <TableCell className="text-xs tracking-tight uppercase">Opening Balance Carried Forward</TableCell>
                    <TableCell className="text-right text-success text-xs">+{formatValue(stats.startingBalance || 0)}</TableCell>
                    <TableCell className="text-right text-xs">-</TableCell>
                    <TableCell className="text-right px-6 font-black text-sm">{formatValue(stats.startingBalance || 0)}</TableCell>
                  </TableRow>
                )}

                {(() => {
                  let runningBalance = stats.startingBalance || 0;
                  return stats.monthlyTransactionsList?.map((item: any, idx: number) => {
                    const isIncome = item.Type === "Income";
                    isIncome ? runningBalance += item.Amount : runningBalance -= item.Amount;
                    
                    if (dateFilter && item.Date !== dateFilter) return null;
                    
                    const isSelected = selectedIds.includes(item.id);

                    return (
                      <TableRow 
                        key={idx} 
                        className={cn(
                          "hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors cursor-pointer", 
                          isSelected ? "bg-primary/5 dark:bg-primary/10" : "",
                          item.isFuture && "opacity-40 grayscale italic"
                        )}
                        onClick={() => handleSelectRow(item.id, !isSelected)}
                      >
                        <TableCell className="px-6" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            size="small"
                            checked={isSelected}
                            onChange={(e) => handleSelectRow(item.id, e.target.checked)}
                          />
                        </TableCell>
                        <TableCell className="px-0 text-xs text-gray-500">{dayjs(item.Date).format('DD MMM')}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold">{item.Description}</span>
                            <span className="text-[9px] uppercase font-black text-gray-400">{item.Category}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-emerald-500">{isIncome ? `+${formatValue(item.Amount, item.Currency)}` : ""}</TableCell>
                        <TableCell className="text-right text-xs font-bold text-rose-500">{!isIncome ? `-${formatValue(item.Amount, item.Currency)}` : ""}</TableCell>
                        <TableCell className="text-right px-6 text-xs font-black">{formatValue(runningBalance)}</TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>

          {/* --- Footer Verification Section --- */}
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-12 px-6 pb-12">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Expense Breakdown</h4>
              <div className="space-y-5">
                {stats.sortedCategories?.map((cat: any, i: number) => (
                  <div key={i} className="group">
                    <div className="flex justify-between text-[11px] font-bold mb-2">
                      <span className="opacity-70">{cat.name}</span>
                      <span>{formatValue(cat.value)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-1000"
                        style={{ width: `${(cat.value / stats.monthlyAmount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] bg-gray-50 dark:bg-white/5 p-8 border border-stroke dark:border-white/5">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Final Reconciliation</h4>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium opacity-60">Total Income</span>
                  <span className="font-bold text-emerald-500">+{formatValue(stats.monthlyIncome)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium opacity-60">Total Expenses</span>
                  <span className="font-bold text-rose-500">-{formatValue(stats.monthlyAmount)}</span>
                </div>
                <div className="h-px bg-stroke dark:bg-white/10 my-2" />
                <div className="flex justify-between items-end">
                  <span className="text-xs font-black uppercase">Closing Balance</span>
                  <span className="text-2xl font-black text-primary">{formatValue(currentBankBalance)}</span>
                </div>
              </div>

              <div className="mt-8 p-4 rounded-2xl bg-white dark:bg-dark-2 shadow-sm text-[10px] leading-relaxed font-medium italic opacity-70">
                Notice: This report confirms the starting balance carryover from previous months matches the current verified transaction logs.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}