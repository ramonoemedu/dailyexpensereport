'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { OverviewCard } from "@/components/NextAdmin/Dashboard/overview-cards/card";
import {
  Users as UsersIcon,
  Views as ViewsIcon,
  Profit as ProfitIcon,
  Product as ProductIcon
} from "@/components/NextAdmin/Dashboard/overview-cards/icons";
import { PaymentsOverview } from "@/components/NextAdmin/Charts/payments-overview";
import { WeeksProfit } from "@/components/NextAdmin/Charts/weeks-profit";
import { getClearPortStats } from "@/services/charts.services";
import { Skeleton } from "@mui/material";
import { cn } from "@/lib/NextAdmin/utils";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      setLoading(true);
      try {
        const data = await getClearPortStats(month, year);
        if (isMounted) setStats(data);
      } catch (error) {
        console.error("Dashboard load error:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadStats();
    return () => { isMounted = false; };
  }, [month, year]);

  const months = useMemo(() => [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ], []);

  const years = [2024, 2025, 2026];

  if (loading || !stats) {
    return (
      <div className="mx-auto w-full max-w-full space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-6">
          <Skeleton variant="rectangular" height={80} className="rounded-2xl" sx={{ bgcolor: 'rgba(0,0,0,0.05)' }} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={140} className="rounded-[32px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const bankBalance = (stats.startingBalance || 0) + (stats.monthlyIncome || 0) - (stats.monthlyAmount || 0);

  return (
    <div className="mx-auto w-full max-w-full space-y-8 p-4 md:p-6 animate-fade-in">

      {/* --- Header Section --- */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-dark dark:text-white">
            Financial Analytics
          </h1>
          <p className="text-base font-medium text-gray-500">
            Insights for {months[month]} {year}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-dark-2 p-2 rounded-2xl shadow-sm border border-stroke dark:border-dark-3">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="bg-transparent px-3 py-1 text-sm font-bold outline-none cursor-pointer"
          >
            {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <div className="h-4 w-px bg-stroke dark:bg-dark-3" />
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="bg-transparent px-3 py-1 text-sm font-bold outline-none cursor-pointer"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* --- Top Gradient Cards --- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <OverviewCard
          label="Initial Carryover"
          data={{
            value: `$${(stats.startingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            growthRate: 0,
          }}
          Icon={ViewsIcon}
          gradient="blue"
        />

        <OverviewCard
          label="Monthly Expenses"
          data={{
            value: `$${(stats.monthlyAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            growthRate: stats.growth?.amount || 0,
          }}
          Icon={ProductIcon}
          gradient="red"
        />

        <OverviewCard
          label="Bank Balance"
          data={{
            value: `$${bankBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            growthRate: 0,
          }}
          Icon={ProfitIcon}
          gradient="dark"
        />

        <OverviewCard
          label="Income (Rec. / Total)"
          data={{
            value: `$${(stats.monthlyIncome || 0).toLocaleString()} / $${(stats.monthlyIncomeWithFuture || 0).toLocaleString()}`,
            growthRate: 0,
          }}
          Icon={ProfitIcon}
          gradient="green"
        />

        <OverviewCard
          label="Top Category"
          data={{
            value: stats.topCategory || "N/A",
            growthRate: 0,
          }}
          Icon={UsersIcon}
          gradient="purple"
        />
      </div>

      {/* --- Yearly Summary Compact Bento --- */}
      <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Yearly Revenue - Slim Version */}
        <div className="group relative overflow-hidden rounded-[24px] bg-gradient-to-br from-emerald-600 to-teal-700 p-6 shadow-md transition-all hover:shadow-xl">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
                Yearly Revenue ({year})
              </h3>
              <p className="mt-1 text-3xl font-black text-white">
                ${stats.yearlyIncome?.toLocaleString()}
              </p>
            </div>

            {/* Icon is smaller and contained to the right */}
            <div className="text-white/20 transition-transform group-hover:scale-110">
              <ProfitIcon className="w-12 h-12" />
            </div>
          </div>
          {/* Subtle background glow */}
          <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-white/10 blur-xl" />
        </div>

        {/* Yearly Outflow - Slim Version */}
        <div className="group relative overflow-hidden rounded-[24px] bg-gradient-to-br from-rose-600 to-orange-600 p-6 shadow-md transition-all hover:shadow-xl">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
                Yearly Outflow ({year})
              </h3>
              <p className="mt-1 text-3xl font-black text-white">
                ${stats.yearlyExpense?.toLocaleString()}
              </p>
            </div>

            <div className="text-white/20 transition-transform group-hover:scale-110">
              <ProductIcon className="w-12 h-12" />
            </div>
          </div>
          {/* Subtle background glow */}
          <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-white/10 blur-xl" />
        </div>

      </div>

      {/* --- Main Dashboard Content --- */}
      <div className="grid grid-cols-12 gap-6">

        {/* Payments Chart */}
        <div className="col-span-12 xl:col-span-8">
          <PaymentsOverview year={year} />
        </div>

        {/* Weekly Profit Chart */}
        <div className="col-span-12 xl:col-span-4">
          <WeeksProfit month={month} year={year} />
        </div>

        {/* --- Modern Income Breakdown Bento --- */}
        <div className="col-span-12">
          <div className="rounded-[32px] border border-stroke bg-white/50 p-8 shadow-sm backdrop-blur-xl transition-all dark:border-white/5 dark:bg-dark-2/50">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black tracking-tight text-dark dark:text-white">Income Streams</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Monthly Revenue Detail</p>
              </div>

              <div className="flex gap-8">
                <div className="group text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 group-hover:text-emerald-500 transition-colors">Collected</p>
                  <p className="text-2xl font-black text-emerald-500">
                    ${stats.monthlyIncome?.toLocaleString()}
                  </p>
                </div>
                <div className="text-right border-l border-stroke pl-8 dark:border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Projected</p>
                  <p className="text-2xl font-black text-blue-500">
                    ${stats.monthlyIncomeWithFuture?.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-stroke bg-white/30 dark:border-white/5 dark:bg-transparent">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-white/5">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Date</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Transaction</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Amount</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke dark:divide-white/5">
                  {stats.monthlyIncomeItems?.map((item: any, index: number) => (
                    <tr
                      key={index}
                      className={cn(
                        "group transition-colors hover:bg-gray-50/50 dark:hover:bg-white/5",
                        item.isFuture && "bg-blue-50/10 dark:bg-blue-500/5"
                      )}
                    >
                      <td className="px-6 py-4 text-xs font-medium text-gray-500">{item.date}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-dark dark:text-white group-hover:text-primary transition-colors">
                          {item.description}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-black text-dark dark:text-white">
                          ${item.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={cn(
                          "inline-flex items-center rounded-lg px-3 py-1 text-[9px] font-black uppercase tracking-wider",
                          item.isFuture
                            ? "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
                            : "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                        )}>
                          <span className={cn("mr-1.5 h-1 w-1 rounded-full", item.isFuture ? "bg-blue-500" : "bg-emerald-500")} />
                          {item.isFuture ? "Expected" : "Received"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!stats.monthlyIncomeItems || stats.monthlyIncomeItems.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-xs font-bold text-gray-400 italic">
                        No income data available for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}