'use client';

import { cn } from "@/lib/NextAdmin/utils";
import type { SVGProps, ComponentType } from "react";

type PropsType = {
  label: string;
  data: {
    value: number | string;
    growthRate?: number;
  };
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  gradient?: "blue" | "green" | "red" | "purple" | "orange" | "dark";
};

const gradients = {
  blue: "bg-gradient-to-br from-blue-600 to-blue-400 text-white shadow-blue-500/10",
  green: "bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-emerald-500/10",
  red: "bg-gradient-to-br from-rose-600 to-pink-500 text-white shadow-rose-500/10",
  purple: "bg-gradient-to-br from-violet-600 to-purple-500 text-white shadow-purple-500/10",
  orange: "bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-orange-500/10",
  dark: "bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-slate-900/10",
};

export function OverviewCard({ label, data, Icon, gradient }: PropsType) {
  return (
    <div className={cn(
      "relative group overflow-hidden rounded-[28px] p-6 transition-all duration-300",
      "hover:scale-[1.02] hover:shadow-xl border border-transparent",
      gradient ? gradients[gradient] : "bg-white dark:bg-dark-2 text-dark dark:text-white border-stroke dark:border-white/5"
    )}>
      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />

      {/* --- BACKGROUND ICON: This prevents the icon from blocking the text --- */}
      <div className={cn(
        "absolute -top-2 -right-2 transition-transform duration-500 group-hover:-translate-x-2 group-hover:translate-y-2 group-hover:rotate-12",
        gradient ? "text-white/10" : "text-primary/5"
      )}>
        <Icon className="w-24 h-24" />
      </div>

      <div className="relative z-10 flex flex-col justify-between h-full">
        <div className="flex flex-col">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1 truncate pr-10">
            {label}
          </p>

          <h3 className="text-2xl font-black tracking-tight leading-none break-words">
            {data.value}
          </h3>
        </div>

        {/* Floating Mini Icon (Top Right) - Smaller and doesn't overlap */}
        <div className="absolute top-0 right-0">
          <div className={cn(
            "rounded-xl p-2 backdrop-blur-md border border-white/10",
            gradient ? "bg-white/10" : "bg-gray-100 dark:bg-white/5 text-primary"
          )}>
            <Icon className="w-5 h-5" />
          </div>
        </div>

        {/* Growth Badge */}
        {data.growthRate !== undefined && data.growthRate !== 0 && (
          <div className="mt-4">
            <span className={cn(
              "inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-black",
              gradient ? "bg-white/20" : "bg-gray-100 dark:bg-white/5"
            )}>
              {data.growthRate > 0 ? "↑" : "↓"} {Math.abs(data.growthRate)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}