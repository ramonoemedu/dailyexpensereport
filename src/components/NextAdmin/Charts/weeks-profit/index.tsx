"use client";

import { cn } from "@/lib/NextAdmin/utils";
import { getWeeksProfitData } from "@/services/charts.services";
import { WeeksProfitChart } from "./chart";
import { useEffect, useState } from "react";
import { Skeleton } from "@mui/material";

type PropsType = {
  month?: number;
  year?: number;
  className?: string;
};

export function WeeksProfit({ className, month: propMonth, year: propYear }: PropsType) {
  const [internalMonth, setInternalMonth] = useState(new Date().getMonth());
  const [internalYear, setInternalYear] = useState(new Date().getFullYear());
  
  const month = propMonth !== undefined ? propMonth : internalMonth;
  const year = propYear !== undefined ? propYear : internalYear;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const result = await getWeeksProfitData(month, year);
      setData(result);
      setLoading(false);
    }
    loadData();
  }, [month, year]);

  if (loading || !data) {
    return (
      <div className={cn("rounded-[10px] bg-white p-7.5 shadow-1 dark:bg-dark-2", className)}>
        <Skeleton variant="text" width="40%" height={32} className="mb-4" />
        <Skeleton variant="rectangular" height={370} className="rounded-xl" />
      </div>
    );
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const years = [2024, 2025, 2026];

  return (
    <div
      className={cn(
        "rounded-[10px] bg-white px-7.5 pt-7.5 shadow-1 dark:bg-dark-2 dark:shadow-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-body-2xlg font-bold text-dark dark:text-white">
          Top Expense Categories
        </h2>

        <div className="flex items-center gap-2">
          <select 
            value={month} 
            onChange={(e) => setInternalMonth(parseInt(e.target.value))}
            className="rounded-lg border border-stroke bg-transparent px-3 py-1.5 text-xs font-medium outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2"
          >
            {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select 
            value={year} 
            onChange={(e) => setInternalYear(parseInt(e.target.value))}
            className="rounded-lg border border-stroke bg-transparent px-3 py-1.5 text-xs font-medium outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <WeeksProfitChart data={data} />
    </div>
  );
}