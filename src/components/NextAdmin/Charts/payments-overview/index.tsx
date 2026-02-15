"use client";

import { PeriodPicker } from "@/components/NextAdmin/period-picker";
import { standardFormat } from "@/lib/NextAdmin/format-number";
import { cn } from "@/lib/NextAdmin/utils";
import { getPaymentsOverviewData } from "@/services/charts.services";
import { PaymentsOverviewChart } from "./chart";
import { useEffect, useState } from "react";
import { Skeleton } from "@mui/material";

type PropsType = {
  year?: number;
  className?: string;
};

export function PaymentsOverview({
  year: propYear,
  className,
}: PropsType) {
  const [internalYear, setInternalYear] = useState(new Date().getFullYear());
  const year = propYear !== undefined ? propYear : internalYear;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const result = await getPaymentsOverviewData(year);
      setData(result);
      setLoading(false);
    }
    loadData();
  }, [year]);

  if (loading || !data) {
    return (
      <div className={cn("rounded-[10px] bg-white p-7.5 shadow-1 dark:bg-dark-2", className)}>
        <Skeleton variant="text" width="40%" height={32} className="mb-4" />
        <Skeleton variant="rectangular" height={300} className="rounded-xl" />
      </div>
    );
  }

  const years = [2024, 2025, 2026];

  return (
    <div
      className={cn(
        "grid gap-2 rounded-[10px] bg-white px-7.5 pb-6 pt-7.5 shadow-1 dark:bg-dark-2 dark:shadow-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-body-2xlg font-bold text-dark dark:text-white">
          Monthly Income vs Expenses
        </h2>

        <div className="flex items-center gap-3">
          <select 
            value={year} 
            onChange={(e) => setInternalYear(parseInt(e.target.value))}
            className="rounded-lg border border-stroke bg-transparent px-4 py-2 text-sm font-medium outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <PaymentsOverviewChart data={data} />

      <dl className="grid divide-stroke text-center dark:divide-dark-3 sm:grid-cols-2 sm:divide-x [&>div]:flex [&>div]:flex-col-reverse [&>div]:gap-1">
        <div className="dark:border-dark-3 max-sm:mb-3 max-sm:border-b max-sm:pb-3">
          <dt className="text-xl font-bold text-success">
            ${standardFormat(data.income.reduce((acc: any, { y }: any) => acc + y, 0))}
          </dt>
          <dd className="font-medium dark:text-dark-6">Total Income</dd>
        </div>

        <div>
          <dt className="text-xl font-bold text-danger">
            ${standardFormat(data.expense.reduce((acc: any, { y }: any) => acc + y, 0))}
          </dt>
          <dd className="font-medium dark:text-dark-6">Total Expenses</dd>
        </div>
      </dl>
    </div>
  );
}