"use client";

import React, { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/NextAdmin/use-mobile";
import { getPaymentsOverviewData } from "@/services/charts.services";
import { Skeleton } from "@mui/material";
import { cn } from "@/lib/NextAdmin/utils";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type PropsType = {
  year?: number;
  className?: string;
};

export function PaymentsOverview({ year: propYear, className }: PropsType) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  const isDark = resolvedTheme === "dark";

  // Use the year passed via props, or default to current year
  const year = propYear || new Date().getFullYear();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const result = await getPaymentsOverviewData(year);
        setData(result);
      } catch (error) {
        console.error("Failed to load payments data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [year]);

  const options: ApexOptions = {
    colors: ["#10B981", "#EF4444"], // Emerald (Income) & Rose (Expense)
    chart: {
      type: "area",
      toolbar: { show: false },
      fontFamily: "inherit",
      dropShadow: {
        enabled: true,
        top: 10,
        blur: 4,
        color: "#000",
        opacity: 0.1,
      },
    },
    stroke: {
      curve: "smooth",
      width: isMobile ? 2 : 4,
      lineCap: "round",
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0,
        stops: [0, 90, 100],
      },
    },
    grid: {
      borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
      strokeDashArray: 10,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    markers: {
      size: 0,
      hover: { size: 6 },
    },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: isDark ? "#64748b" : "#94a3b8",
          fontSize: "12px",
          fontWeight: 600,
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: isDark ? "#64748b" : "#94a3b8",
          fontSize: "12px",
          fontWeight: 600,
        },
        formatter: (val) => `$${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`,
      },
    },
    tooltip: {
      theme: isDark ? "dark" : "light",
      x: { show: false },
      style: { fontSize: "12px" },
    },
  };

  if (loading || !data) {
    return (
      <div className={cn("rounded-[32px] bg-white p-8 dark:bg-dark-2", className)}>
        <Skeleton variant="text" width="40%" height={32} className="mb-6" />
        <Skeleton variant="rectangular" height={300} className="rounded-2xl" />
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-[32px] border border-stroke bg-white p-8 shadow-sm dark:border-white/5 dark:bg-dark-2/50 backdrop-blur-md",
      className
    )}>
      <div className="mb-6">
        <h2 className="text-xl font-black tracking-tight text-dark dark:text-white">
          Cash Flow Analytics
        </h2>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Monthly overview for {year}</p>
      </div>

      <div className="-ml-4 h-[320px] w-[105%]">
        <Chart
          options={options}
          series={[
            { name: "Income", data: data.income || [] },
            { name: "Expense", data: data.expense || [] },
          ]}
          type="area"
          height={320}
        />
      </div>
    </div>
  );
}