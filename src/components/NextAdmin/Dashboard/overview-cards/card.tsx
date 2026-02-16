import { cn } from "@/lib/NextAdmin/utils";
import type { SVGProps } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "@/assets/icons";

type PropsType = {
  label: string;
  data: {
    value: number | string;
    growthRate?: number;
  };
  Icon: React.ComponentType<SVGProps<SVGSVGElement>>;
  gradient?: "blue" | "green" | "red" | "purple" | "orange" | "dark";
};

const gradients = {
  blue: "bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white border-blue-400/20 hover:shadow-blue-500/40",
  green: "bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 text-white border-emerald-400/20 hover:shadow-emerald-500/40",
  red: "bg-gradient-to-br from-rose-700 via-rose-600 to-orange-500 text-white border-rose-400/20 hover:shadow-rose-500/40",
  purple: "bg-gradient-to-br from-violet-700 via-violet-600 to-purple-500 text-white border-purple-400/20 hover:shadow-violet-500/40",
  orange: "bg-gradient-to-br from-amber-700 via-amber-600 to-yellow-500 text-white border-amber-400/20 hover:shadow-amber-500/40",
  dark: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white border-slate-700/30 hover:shadow-slate-950/40",
};

export function OverviewCard({ label, data, Icon, gradient }: PropsType) {
  const isDecreasing = (data.growthRate || 0) < 0;
  const gradientClass = gradient ? gradients[gradient] : "bg-white/80 dark:bg-dark-2/80 border-white/20";

  return (
    <div className={cn(
      "relative overflow-hidden rounded-[24px] p-7 border transition-all duration-300 ease-out hover:scale-[1.03] hover:z-10",
      gradientClass,
      "shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] group"
    )}>
      {/* Glossy overlay effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none"></div>

      {/* Top-right minimalist icon */}
      <div className="absolute top-5 right-5 opacity-20 transform group-hover:scale-110 transition-transform duration-300">
        <Icon className={cn("size-8", gradient ? "text-white" : "text-primary")} />
      </div>

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div>
          <p className={cn(
            "text-[10px] font-black uppercase tracking-[0.15em] mb-1",
            gradient ? "text-white/70" : "text-dark-6"
          )}>
            {label}
          </p>
          
          <h3 className={cn(
            "text-3xl font-black tracking-tight mb-4",
            gradient ? "text-white" : "text-dark dark:text-white"
          )}>
            {data.value}
          </h3>
        </div>

        {data.growthRate !== undefined && data.growthRate !== 0 && (
          <div
            className={cn(
              "inline-flex items-center self-start text-[11px] font-black px-2.5 py-1 rounded-full backdrop-blur-sm",
              gradient ? "bg-white/20 text-white" : (isDecreasing ? "bg-red/10 text-red" : "bg-green/10 text-green"),
            )}
          >
            {data.growthRate}%
            <span className="ml-1 flex items-center">
              {isDecreasing ? (
                <ArrowDownIcon className="size-2.5" />
              ) : (
                <ArrowUpIcon className="size-2.5" />
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
