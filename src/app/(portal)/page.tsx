'use client';

import React, { useEffect, useState } from 'react';
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
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getClearPortStats(month, year);
        setStats(data);
      } catch (error) {
        console.error("Dashboard load error:", error);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [month, year]);

  if (loading || !stats) {
    return (
      <div className="mx-auto w-full max-w-full space-y-6">
        <div className="flex flex-col gap-6">
          <Skeleton variant="rectangular" height={80} className="rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={150} className="rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const years = [2024, 2025, 2026];

  return (
    <div className="mx-auto w-full max-w-full space-y-6">
      <div className="flex flex-col gap-6">
        {/* Header Section */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-heading-5 font-bold text-dark dark:text-white">
              Expense Analytics
            </h1>
            <p className="text-body-sm font-medium text-dark-5">
              Overview for {months[month]} {year}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select 
              value={month} 
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2"
            >
              {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select 
              value={year} 
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:gap-7.5">
          <OverviewCard
            label="Starting Balance"
            data={{
              value: `$${(stats.startingBalance || 0).toLocaleString()}`,
              growthRate: 0,
            }}
            Icon={ViewsIcon}
          />

          <OverviewCard
            label="Monthly Expenses"
            data={{
              value: `$${stats.monthlyAmount.toLocaleString()}`,
              growthRate: stats.growth.amount,
            }}
            Icon={ProductIcon}
          />

          <OverviewCard
            label="Bank Balance"
            data={{
              value: `$${((stats.startingBalance || 0) + stats.monthlyIncome - stats.monthlyAmount).toLocaleString()}`,
              growthRate: 0,
            }}
            Icon={ProfitIcon}
          />

          <OverviewCard
            label="Income (Current / Total)"
            data={{
              value: `$${stats.monthlyIncome.toLocaleString()} / $${stats.monthlyIncomeWithFuture?.toLocaleString() ?? 0}`,
              growthRate: 0,
            }}
            Icon={ProfitIcon}
          />

          <OverviewCard
            label="Top Expense Category"
            data={{
              value: stats.topCategory || "None",
              growthRate: 0,
            }}
            Icon={UsersIcon}
          />
        </div>

        {/* Income Breakdown Table */}
        <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-dark-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-dark dark:text-white">Monthly Income Breakdown</h3>
            <div className="text-right">
              <p className="text-sm font-medium text-dark-6">Current: <span className="text-dark dark:text-white">${stats.monthlyIncome.toLocaleString()}</span></p>
              <p className="text-sm font-medium text-dark-6">Full Month: <span className="text-dark dark:text-white">${stats.monthlyIncomeWithFuture.toLocaleString()}</span></p>
            </div>
          </div>
          <div className="max-w-full overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-2 text-left dark:bg-meta-4">
                  <th className="px-4 py-4 font-medium text-black dark:text-white">Date</th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">Description</th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">Amount</th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.monthlyIncomeItems?.map((item: any, index: number) => (
                  <tr key={index} className={item.isFuture ? "opacity-60 bg-gray-50 dark:bg-dark-3" : ""}>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                      <p className="text-black dark:text-white">{item.date}</p>
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                      <p className="text-black dark:text-white">{item.description}</p>
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                      <p className="text-black dark:text-white">${item.amount.toLocaleString()}</p>
                    </td>
                    <td className="border-b border-[#eee] px-4 py-5 dark:border-strokedark">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${item.isFuture ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                        {item.isFuture ? "Future" : "Received"}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!stats.monthlyIncomeItems || stats.monthlyIncomeItems.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-dark-6">No income recorded for this month.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Yearly Summary Card */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="rounded-[10px] bg-gradient-to-r from-success to-emerald-600 p-6 shadow-1 text-white">
            <h3 className="text-lg font-bold opacity-80 uppercase tracking-wider">Yearly Total Income ({year})</h3>
            <p className="text-4xl font-black mt-2">${stats.yearlyIncome.toLocaleString()}</p>
          </div>
          <div className="rounded-[10px] bg-gradient-to-r from-danger to-rose-600 p-6 shadow-1 text-white">
            <h3 className="text-lg font-bold opacity-80 uppercase tracking-wider">Yearly Total Expense ({year})</h3>
            <p className="text-4xl font-black mt-2">${stats.yearlyExpense.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-12 gap-4 md:mt-6 md:gap-6 2xl:mt-9 2xl:gap-7.5">
        <div className="col-span-12 xl:col-span-7">
          <PaymentsOverview year={year} />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <WeeksProfit month={month} year={year} />
        </div>
      </div>
    </div>
  );
}// test comment
