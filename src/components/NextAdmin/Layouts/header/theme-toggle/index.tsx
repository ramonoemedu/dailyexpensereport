"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "./icons";
import { cn } from "@/lib/NextAdmin/utils";

export function ThemeToggleSwitch() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => {
        if (!mounted) return;
        setTheme(isDark ? "light" : "dark");
      }}
      className="relative flex size-12 items-center justify-center rounded-full border border-stroke bg-white text-dark shadow-sm transition-all duration-300 hover:border-primary hover:text-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
      aria-label="Toggle dark mode"
    >
      <div className="relative flex size-6 items-center justify-center">
        {mounted ? (
          isDark ? (
            <Moon className="size-6 text-yellow" />
          ) : (
            <Sun className="size-6 text-warning" />
          )
        ) : (
          <div className="size-6" /> // Placeholder to keep size consistent
        )}
      </div>
    </button>
  );
}
