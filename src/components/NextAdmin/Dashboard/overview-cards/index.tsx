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
  blue: "bg-gradient-to-br from-blue-600 to-blue-400 text-white border-blue-400/20 shadow-blue-500/20",
  green: "bg-gradient-to-br from-emerald-600 to-teal-500 text-white border-emerald-400/20 shadow-emerald-500/20",
  red: "bg-gradient-to-br from-rose-600 to-pink-500 text-white border-rose-400/20 shadow-rose-500/20",
  purple: "bg-gradient-to-br from-violet-600 to-purple-500 text-white border-purple-400/20 shadow-purple-500/20",
  orange: "bg-gradient-to-br from-orange-500 to-amber-400 text-white border-orange-400/20 shadow-orange-500/20",
  dark: "bg-gradient-to-br from-slate-900 to-slate-700 text-white border-slate-700/50 shadow-slate-900/20",
};

export function OverviewCard({ label, data, Icon, gradient }: PropsType) {
  return (
    <div className={cn(
      "relative group overflow-hidden rounded-[24px] p-6 border transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl",
      gradient ? gradients[gradient] : "bg-white dark:bg-dark-2 text-dark dark:text-white border-stroke dark:border-dark-3"
    )}>
      <div className="relative z-10 flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p>
          <h3 className="text-2xl font-black leading-none">{data.value}</h3>
        </div>

        <div className={cn(
          "flex items-center justify-center rounded-2xl p-3 shadow-inner",
          gradient ? "bg-white/20" : "bg-primary/10 text-primary"
        )}>
          <Icon className="w-9 h-9 transition-transform group-hover:rotate-6" />
        </div>
      </div>

      {/* Visual flare */}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
    </div>
  );
}