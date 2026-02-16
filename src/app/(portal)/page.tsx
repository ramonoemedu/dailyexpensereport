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

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Use current date as default state
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

  // Memoize constants to prevent re-renders
  const months = useMemo(() => [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ], []);

  const years = [2024, 2025, 2026];

  if (loading || !stats) {
    return (
      <div className="mx-auto w-full max-w-full space-y-6 p-4">
        <div className="flex flex-col gap-6">
          <Skeleton variant="rectangular" height={100} className="rounded-2xl" sx={{ bgcolor: 'rgba(0,0,0,0.05)' }} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={160} className="rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Calculate Bank Balance safely
  const bankBalance = (stats.startingBalance || 0) + (stats.monthlyIncome || 0) - (stats.monthlyAmount || 0);

  return (
    <div className="mx-auto w-full max-w-full space-y-8 p-4 md:p-6 animate-fade-in">
      {/* --- Header Section --- */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-dark dark:text-white">
            Financial Analytics
          </h1>
          <p className="text-base font-medium text-gray-500 dark:text-gray-400">
            Insights for {months[month]} {year}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-dark-2 p-2 rounded-xl shadow-sm border border-stroke dark:border-dark-3">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="bg-transparent px-2 py-1 text-sm font-semibold outline-none cursor-pointer"
          >
            {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <div className="h-4 w-px bg-stroke dark:bg-dark-3" />
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="bg-transparent px-2 py-1 text-sm font-semibold outline-none cursor-pointer"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* --- Modern Gradient Cards --- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:gap-6">
        <OverviewCard
          label="Initial Carryover"
          data={{
            value: `$${(stats.startingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            growthRate: 0,
          }}
          Icon={ViewsIcon}
          gradient="blue" // Ensure your OverviewCard component handles "blue" with a modern linear gradient
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

      {/* --- Income Breakdown Table --- */}
      <div className="rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-2 border border-stroke dark:border-dark-3 transition-all">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-xl font-bold text-dark dark:text-white">Monthly Income Breakdown</h3>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-xs uppercase text-gray-500 font-bold">Received</p>
              <p className="text-lg font-bold text-success">${stats.monthlyIncome?.toLocaleString()}</p>
            </div>
            <div className="text-right border-l pl-4 border-stroke dark:border-dark-3">
              <p className="text-xs uppercase text-gray-500 font-bold">Projected</p>
              <p className="text-lg font-bold text-primary">${stats.monthlyIncomeWithFuture?.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-stroke dark:border-dark-3">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-meta-4">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-dark dark:text-white">Date</th>
                <th className="px-6 py-4 text-sm font-semibold text-dark dark:text-white">Description</th>
                <th className="px-6 py-4 text-sm font-semibold text-dark dark:text-white">Amount</th>
                <th className="px-6 py-4 text-sm font-semibold text-dark dark:text-white text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke dark:divide-dark-3">
              {stats.monthlyIncomeItems?.map((item: any, index: number) => (
                <tr key={index} className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${item.isFuture ? "bg-blue-50/30 dark:bg-blue-900/10" : ""}`}>
                  <td className="px-6 py-4 text-sm text-dark dark:text-white">{item.date}</td>
                  <td className="px-6 py-4 text-sm text-dark dark:text-white font-medium">{item.description}</td>
                  <td className="px-6 py-4 text-sm text-dark dark:text-white">${item.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${item.isFuture ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {item.isFuture ? "Expected" : "Cleared"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Yearly Summary Bento --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-8 shadow-lg transition-transform hover:scale-[1.01]">
          <div className="relative z-10 text-white">
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-80">Yearly Revenue ({year})</h3>
            <p className="mt-2 text-5xl font-black">${stats.yearlyIncome?.toLocaleString()}</p>
          </div>
          <div className="absolute -right-4 -top-4 text-white/10 group-hover:scale-110 transition-transform">
            <ProfitIcon fontSizeAdjust={140} />
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-red-700 p-8 shadow-lg transition-transform hover:scale-[1.01]">
          <div className="relative z-10 text-white">
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-80">Yearly Outflow ({year})</h3>
            <p className="mt-2 text-5xl font-black">${stats.yearlyExpense?.toLocaleString()}</p>
          </div>
          <div className="absolute -right-4 -top-4 text-white/10 group-hover:scale-110 transition-transform">
            <ProductIcon
              fontSizeAdjust={140}
            />
          </div>
        </div>
      </div>

      {/* --- Charts Section --- */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-7 rounded-2xl bg-white dark:bg-dark-2 p-1 border border-stroke dark:border-dark-3 shadow-sm">
          <PaymentsOverview year={year} />
        </div>
        <div className="col-span-12 xl:col-span-5 rounded-2xl bg-white dark:bg-dark-2 p-1 border border-stroke dark:border-dark-3 shadow-sm">
          <WeeksProfit month={month} year={year} />
        </div>
      </div>
    </div>
  );
}