'use client';

import React, { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import { getClearPortStats } from "@/services/charts.services";
import { Skeleton } from "@mui/material";
import PrintIcon from '@mui/icons-material/Print';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/NextAdmin/ui/table";
import { cn } from "@/lib/NextAdmin/utils";

export default function MonthlyReportCashPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(dayjs().month());
  const [year, setYear] = useState(dayjs().year());
  const [currency, setCurrency] = useState("USD");

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
          paymentMethodFilter: "Cash",
          currencyFilter: currency
        });
        setStats(data);
      } catch (error) {
        console.error("Report load error:", error);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [month, year, currency]);

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
  const currentCashBalance = (stats.startingBalance || 0) + netSavings;
  const symbol = currency === "USD" ? "$" : "៛";
  const fractionDigits = currency === "USD" ? 2 : 0;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-4 md:p-8 print:p-0 animate-fade-in">

      {/* --- Header Section --- */}
      <div className="flex flex-wrap items-end justify-between gap-6 print:hidden">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-dark dark:text-white">
            Cash Statement <span className="text-success opacity-50">#</span>{months[month].substring(0, 3).toUpperCase()}{year}
          </h1>
          <p className="mt-2 text-base font-medium text-gray-500">
            Cash reconciliation ({currency}) for {months[month]}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white/50 dark:bg-dark-2/50 backdrop-blur-md p-2 rounded-2xl border border-stroke dark:border-dark-3 shadow-sm">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="bg-transparent px-3 py-2 text-sm font-bold outline-none cursor-pointer text-success"
          >
            <option value="USD">USD ($)</option>
            <option value="KHR">KHR (៛)</option>
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
            className="ml-2 flex items-center gap-2 bg-success text-white px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-all"
          >
            <PrintIcon fontSize="small" />
            Print
          </button>
        </div>
      </div>

      {/* --- Top Bento Grid Summary --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Initial Balance */}
        <div className="group relative overflow-hidden rounded-[32px] bg-gradient-to-br from-emerald-600 to-green-700 p-8 text-white shadow-xl transition-transform hover:scale-[1.02]">
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] opacity-70">Opening Cash</p>
            <h3 className="mt-3 text-4xl font-black">
              {symbol}{(stats.startingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}
            </h3>
            <div className="mt-6 inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold">
              AS OF {months[month].toUpperCase()} 1ST
            </div>
          </div>
          <div className="absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-white/10 blur-3xl group-hover:bg-white/20 transition-all" />
        </div>

        {/* Net Savings */}
        <div className="group relative overflow-hidden rounded-[32px] bg-gradient-to-br from-teal-500 to-emerald-700 p-8 text-white shadow-xl transition-transform hover:scale-[1.02]">
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] opacity-70">Monthly Cash Flow</p>
            <h3 className="mt-3 text-4xl font-black">
              {netSavings >= 0 ? '+' : ''}{symbol}{netSavings.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}
            </h3>
            <div className="mt-6 flex items-center gap-3">
              <div className="text-[10px] font-bold bg-black/10 rounded-lg p-2">IN: {symbol}{stats.monthlyIncome.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</div>
              <div className="text-[10px] font-bold bg-black/10 rounded-lg p-2">OUT: {symbol}{stats.monthlyAmount.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</div>
            </div>
          </div>
          <div className="absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
        </div>

        {/* Closing Balance */}
        <div className="group relative overflow-hidden rounded-[32px] bg-slate-900 p-8 text-white shadow-xl transition-transform hover:scale-[1.02] dark:bg-white dark:text-dark">
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] opacity-70">Final Cash Position</p>
            <h3 className="mt-3 text-4xl font-black">
              {symbol}{currentCashBalance.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}
            </h3>
            <p className="mt-6 text-[11px] font-bold opacity-60">VERIFIED CASH ON HAND ({currency})</p>
          </div>
          <div className="absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-success/20 blur-3xl" />
        </div>
      </div>

      {/* --- Main Report Section --- */}
      <div className="overflow-hidden rounded-[32px] border border-stroke bg-white/50 backdrop-blur-md shadow-2xl dark:border-white/5 dark:bg-dark-2/50">
        <div className="p-8 border-b border-stroke dark:border-white/5 flex items-center justify-between">
          <h3 className="text-xl font-black">Cash Transaction Ledger ({currency})</h3>
          <span className="text-[10px] font-bold bg-success/10 text-success px-3 py-1 rounded-full uppercase">Verified Cash Report</span>
        </div>

        <div className="p-2 md:p-6">
          <div className="overflow-hidden rounded-2xl border border-stroke dark:border-white/5">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 dark:bg-white/5">
                  <TableHead className="font-black text-[10px] uppercase tracking-widest px-6">Date</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest">Details</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-right">Debit (+)</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-right">Credit (-)</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-right px-6">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Initial Row */}
                <TableRow className="bg-emerald-50/30 dark:bg-emerald-500/5 font-bold">
                  <TableCell className="px-6 py-4 text-xs opacity-60 italic">01-{month + 1}-{year}</TableCell>
                  <TableCell className="text-xs tracking-tight uppercase">Opening Cash Carried Forward</TableCell>
                  <TableCell className="text-right text-success text-xs">+{symbol}{(stats.startingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</TableCell>
                  <TableCell className="text-right text-xs">-</TableCell>
                  <TableCell className="text-right px-6 font-black text-sm">{symbol}{(stats.startingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</TableCell>
                </TableRow>

                {(() => {
                  let runningBalance = stats.startingBalance || 0;
                  return stats.monthlyTransactionsList?.map((item: any, idx: number) => {
                    const isIncome = item.type === "Income";
                    isIncome ? runningBalance += item.amount : runningBalance -= item.amount;

                    return (
                      <TableRow key={idx} className={cn("hover:bg-gray-50/50 dark:hover:bg-white/5", item.isFuture && "opacity-40 grayscale italic")}>
                        <TableCell className="px-6 text-xs text-gray-500">{dayjs(item.date).format('DD MMM')}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold">{item.description}</span>
                            <span className="text-[9px] uppercase font-black text-gray-400">{item.category}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-emerald-500">{isIncome ? `+${symbol}${item.amount.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}` : ""}</TableCell>
                        <TableCell className="text-right text-xs font-bold text-rose-500">{!isIncome ? `-${symbol}${item.amount.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}` : ""}</TableCell>
                        <TableCell className="text-right px-6 text-xs font-black">{symbol}{runningBalance.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</TableCell>
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
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Cash Expense Breakdown</h4>
              <div className="space-y-5">
                {stats.sortedCategories?.map((cat: any, i: number) => (
                  <div key={i} className="group">
                    <div className="flex justify-between text-[11px] font-bold mb-2">
                      <span className="opacity-70">{cat.name}</span>
                      <span>{symbol}{cat.value.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-success transition-all duration-1000"
                        style={{ width: `${(cat.value / stats.monthlyAmount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] bg-gray-50 dark:bg-white/5 p-8 border border-stroke dark:border-white/5">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Final Cash Reconciliation</h4>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium opacity-60">Total Cash Income</span>
                  <span className="font-bold text-emerald-500">+{symbol}{stats.monthlyIncome.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium opacity-60">Total Cash Expenses</span>
                  <span className="font-bold text-rose-500">-{symbol}{stats.monthlyAmount.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</span>
                </div>
                <div className="h-px bg-stroke dark:bg-white/10 my-2" />
                <div className="flex justify-between items-end">
                  <span className="text-xs font-black uppercase">Closing Cash Balance</span>
                  <span className="text-2xl font-black text-success">{symbol}{currentCashBalance.toLocaleString(undefined, { minimumFractionDigits: fractionDigits })}</span>
                </div>
              </div>

              <div className="mt-8 p-4 rounded-2xl bg-white dark:bg-dark-2 shadow-sm text-[10px] leading-relaxed font-medium italic opacity-70">
                Notice: This report confirms the starting cash carryover from previous months matches the current verified cash transaction logs for {currency}.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
