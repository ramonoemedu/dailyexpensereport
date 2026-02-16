'use client';

import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { getClearPortStats } from "@/services/charts.services";
import { Skeleton, Box, Typography, Paper, Divider, Button } from "@mui/material";
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

export default function MonthlyReportPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(dayjs().month());
  const [year, setYear] = useState(dayjs().year());

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const years = [2024, 2025, 2026];

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      try {
        const data = await getClearPortStats(month, year);
        setStats(data);
      } catch (error) {
        console.error("Report load error:", error);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [month, year]);

  const handlePrint = () => {
    window.print();
  };

  if (loading || !stats) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton variant="rectangular" height={100} className="rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton variant="rectangular" height={150} className="rounded-2xl" />
          <Skeleton variant="rectangular" height={150} className="rounded-2xl" />
          <Skeleton variant="rectangular" height={150} className="rounded-2xl" />
        </div>
      </div>
    );
  }

  const netSavings = stats.monthlyIncome - stats.monthlyAmount;
  const currentBankBalance = (stats.startingBalance || 0) + netSavings;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-2 md:p-6 print:p-0">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-6 print:hidden">
        <div>
          <h1 className="text-heading-4 font-black text-dark dark:text-white">Monthly Financial Report</h1>
          <p className="text-body-sm font-medium text-dark-5">Detailed summary of your income and expenses</p>
        </div>

        <div className="flex items-center gap-3">
          <select 
            value={month} 
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-primary/10 dark:border-dark-3 dark:bg-dark-2"
          >
            {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select 
            value={year} 
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-primary/10 dark:border-dark-3 dark:bg-dark-2"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button 
            variant="contained" 
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ borderRadius: '12px', bgcolor: 'primary.main', textTransform: 'none', fontWeight: 'bold' }}
          >
            Print Report
          </Button>
        </div>
      </div>

      {/* Modern Gradient Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-primary to-blue-700 p-8 text-white shadow-lg shadow-primary/20">
          <div className="relative z-10">
            <p className="text-sm font-bold uppercase tracking-widest opacity-80">Initial Balance</p>
            <h3 className="mt-2 text-4xl font-black">${(stats.startingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            <p className="mt-4 text-xs font-medium opacity-70">Beginning of {months[month]} {year}</p>
          </div>
          <div className="absolute -right-4 -top-4 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
        </div>

        <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-success to-emerald-600 p-8 text-white shadow-lg shadow-success/20">
          <div className="relative z-10">
            <p className="text-sm font-bold uppercase tracking-widest opacity-80">Net Monthly Savings</p>
            <h3 className="mt-2 text-4xl font-black">{netSavings >= 0 ? '+' : ''}${netSavings.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            <div className="mt-4 flex items-center gap-4 text-xs font-bold">
              <span className="rounded-lg bg-white/20 px-2 py-1">In: ${stats.monthlyIncome.toLocaleString()}</span>
              <span className="rounded-lg bg-white/20 px-2 py-1">Out: ${stats.monthlyAmount.toLocaleString()}</span>
            </div>
          </div>
          <div className="absolute -right-4 -top-4 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
        </div>

        <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-dark to-slate-800 p-8 text-white shadow-lg shadow-dark/20 dark:from-dark-2 dark:to-dark-3">
          <div className="relative z-10">
            <p className="text-sm font-bold uppercase tracking-widest opacity-80">Closing Bank Balance</p>
            <h3 className="mt-2 text-4xl font-black">${currentBankBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            <p className="mt-4 text-xs font-medium opacity-70">Estimated current cash on hand</p>
          </div>
          <div className="absolute -right-4 -top-4 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
        </div>
      </div>

      {/* Detailed Financial Verification Section */}
      <Paper className="overflow-hidden rounded-[24px] border border-stroke bg-white shadow-sm dark:border-dark-3 dark:bg-gray-dark">
        <div className="border-b border-stroke p-6 dark:border-dark-3">
          <h3 className="text-xl font-extrabold text-dark dark:text-white">Financial Statement - {months[month]} {year}</h3>
          <p className="text-sm font-medium text-dark-5">Reconciliation of all transactions for this period</p>
        </div>

        <div className="p-6">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-2 dark:bg-dark-2">
                  <TableHead className="w-[120px] font-black uppercase text-xs">Date</TableHead>
                  <TableHead className="font-black uppercase text-xs">Description</TableHead>
                  <TableHead className="font-black uppercase text-xs">Category</TableHead>
                  <TableHead className="w-[150px] text-right font-black uppercase text-xs">Debit (In)</TableHead>
                  <TableHead className="w-[150px] text-right font-black uppercase text-xs">Credit (Out)</TableHead>
                  <TableHead className="w-[150px] text-right font-black uppercase text-xs">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Initial Balance Row */}
                <TableRow className="bg-primary/5 font-bold italic text-primary">
                  <TableCell className="py-4">01-{month+1 < 10 ? '0'+(month+1) : month+1}-{year}</TableCell>
                  <TableCell colSpan={2}>OPENING BALANCE CARRIED FORWARD</TableCell>
                  <TableCell className="text-right">${(stats.startingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">${(stats.startingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                </TableRow>

                {(() => {
                  let runningBalance = stats.startingBalance || 0;
                  return stats.monthlyTransactionsList.map((item: any, idx: number) => {
                    const isIncome = item.type === "Income";
                    if (isIncome) runningBalance += item.amount;
                    else runningBalance -= item.amount;

                    return (
                      <TableRow key={item.id || idx} className={cn(item.isFuture && "opacity-50 grayscale")}>
                        <TableCell className="text-xs font-medium">{dayjs(item.date).format('DD-MM-YYYY')}</TableCell>
                        <TableCell className="text-xs font-bold">
                          {item.description ? item.description.charAt(0).toUpperCase() + item.description.slice(1) : "No Description"}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex rounded-lg bg-gray-100 px-2 py-0.5 text-[10px] font-bold dark:bg-dark-3">
                            {item.category}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs font-black text-success">
                          {isIncome ? `+$${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-black text-danger">
                          {!isIncome ? `-$${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-black text-dark dark:text-white">
                          ${runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>
          
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h4 className="text-sm font-black uppercase tracking-widest text-dark-5">Top Expense Categories</h4>
              <div className="space-y-3">
                {stats.sortedCategories?.map((cat: any, i: number) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-dark dark:text-white">{cat.name}</span>
                      <span className="text-dark-4">${cat.value.toLocaleString()}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-dark-3">
                      <div 
                        className="h-full rounded-full bg-primary" 
                        style={{ width: `${Math.min(100, (cat.value / stats.monthlyAmount) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
                {(!stats.sortedCategories || stats.sortedCategories.length === 0) && (
                  <p className="text-sm text-dark-5 italic">No expenses recorded.</p>
                )}
              </div>

              <h4 className="text-sm font-black uppercase tracking-widest text-dark-5 mt-8">Income Summary</h4>
              <div className="space-y-2">
                {stats.monthlyIncomeItems.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-success/5 border border-success/10">
                    <div>
                      <p className="text-sm font-bold text-dark dark:text-white">
                        {item.description ? item.description.charAt(0).toUpperCase() + item.description.slice(1) : "No Description"}
                      </p>
                      <p className="text-[10px] text-dark-5">{dayjs(item.date).format('DD MMM YYYY')}</p>
                    </div>
                    <span className="text-sm font-black text-success">+${item.amount.toLocaleString()}</span>
                  </div>
                ))}
                {stats.monthlyIncomeItems.length === 0 && <p className="text-sm text-dark-5 italic">No income recorded.</p>}
              </div>
            </div>

            <div className="space-y-6">
               <h4 className="text-sm font-black uppercase tracking-widest text-dark-5">Verification Summary</h4>
               <div className="rounded-2xl bg-gray-2 p-6 dark:bg-dark-2 space-y-4">
                  <div className="flex justify-between border-b border-stroke pb-3 dark:border-dark-3">
                    <span className="text-sm font-medium">Opening Balance</span>
                    <span className="text-sm font-bold">${(stats.startingBalance || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-stroke pb-3 dark:border-dark-3">
                    <span className="text-sm font-medium">Total Received (Debit)</span>
                    <span className="text-sm font-bold text-success">+${stats.monthlyIncome.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-stroke pb-3 dark:border-dark-3">
                    <span className="text-sm font-medium">Total Paid (Credit)</span>
                    <span className="text-sm font-bold text-danger">-${stats.monthlyAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-lg font-black">Closing Balance</span>
                    <span className="text-lg font-black text-primary">${currentBankBalance.toLocaleString()}</span>
                  </div>
               </div>
               
               <div className="p-4 rounded-xl bg-warning/5 border border-warning/20">
                  <p className="text-xs font-bold text-warning uppercase mb-1">Audit Note</p>
                  <p className="text-[11px] text-dark-5 leading-relaxed">
                    This report verifies that your starting balance of <strong>${(stats.startingBalance || 0).toLocaleString()}</strong> 
                    plus your monthly income of <strong>${stats.monthlyIncome.toLocaleString()}</strong> 
                    minus your expenses of <strong>${stats.monthlyAmount.toLocaleString()}</strong> 
                    equals your calculated bank balance of <strong>${currentBankBalance.toLocaleString()}</strong>.
                  </p>
               </div>
            </div>
          </div>
        </div>
      </Paper>
    </div>
  );
}
