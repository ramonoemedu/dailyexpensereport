"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export function WeeksProfitChart({ data }: { data: any }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const options: ApexOptions = {
    // A premium Purple to Blue gradient palette
    colors: ["#8B5CF6", "#3B82F6"],
    theme: {
      mode: isDark ? "dark" : "light",
    },
    chart: {
      type: "bar",
      toolbar: { show: false },
      fontFamily: "inherit",
    },
    plotOptions: {
      bar: {
        horizontal: false,
        borderRadius: 8,
        columnWidth: "35%",
        borderRadiusApplication: "end",
        // This adds a subtle "pop" to the bars
        dataLabels: { position: 'top' }
      },
    },
    dataLabels: {
      enabled: false,
    },
    fill: {
      type: "gradient",
      gradient: {
        shade: 'light',
        type: "vertical",
        shadeIntensity: 0.25,
        gradientToColors: undefined,
        inverseColors: true,
        opacityFrom: 0.9,
        opacityTo: 0.8,
        stops: [50, 0, 100]
      }
    },
    grid: {
      borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
      strokeDashArray: 8,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: isDark ? "#64748b" : "#94a3b8",
          fontSize: "10px",
          fontWeight: 700,
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: isDark ? "#64748b" : "#94a3b8",
          fontSize: "10px",
          fontWeight: 700,
        },
      },
    },
    legend: { show: false },
    tooltip: {
      theme: isDark ? "dark" : "light",
      style: { fontSize: "12px" },
    },
  };

  return (
    <div className="-ml-4 -mr-2">
      <Chart
        options={options}
        series={[
          {
            name: "Expenses",
            data: data.sales || [],
          },
        ]}
        type="bar"
        height={350}
      />
    </div>
  );
}