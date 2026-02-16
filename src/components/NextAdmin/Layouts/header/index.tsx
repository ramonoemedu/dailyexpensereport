"use client";

import { SearchIcon } from "@/assets/icons";
import Image from "next/image";
import Link from "next/link";
import { useSidebarContext } from "../sidebar/sidebar-context";
import { MenuIcon } from "./icons";
import { ThemeToggleSwitch } from "./theme-toggle";
import { UserInfo } from "./user-info";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/NextAdmin/utils";

export function Header() {
  const { toggleSidebar, isMobile } = useSidebarContext();
  const pathname = usePathname();

  const getTitle = () => {
    if (pathname === "/") return "Dashboard";
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "Dashboard";
    // Taking the last part and cleaning it up
    return parts[parts.length - 1]
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200/50 bg-white/70 px-4 py-3 backdrop-blur-xl dark:border-white/5 dark:bg-[#09090b]/70 md:px-8 2xl:px-10">

      {/* Left Section: Menu & Branding */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-dark-4 transition-all hover:scale-105 hover:bg-primary/10 hover:text-primary dark:bg-white/5 dark:text-gray-400"
        >
          <MenuIcon className="size-5" />
          <span className="sr-only">Toggle Sidebar</span>
        </button>

        {isMobile && (
          <Link href={"/"} className="transition-transform hover:scale-110">
            <Image
              src={"/images/logo/logo-icon.svg"}
              width={32}
              height={32}
              alt="Logo"
            />
          </Link>
        )}

        {/* Title Section: Hidden on small mobile */}
        <div className="hidden sm:block ml-2">
          <h1 className="text-xl font-black tracking-tight text-dark dark:text-white leading-tight">
            {getTitle()}
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
            Analytics Portal
          </p>
        </div>
      </div>

      {/* Right Section: Search & User Controls */}
      <div className="flex flex-1 items-center justify-end gap-3 md:gap-6">

        {/* Modern Search Bar */}
        <div className="relative hidden lg:block w-full max-w-[280px] group">
          <input
            type="search"
            placeholder="Quick search..."
            className="w-full rounded-2xl border border-transparent bg-gray-100/50 py-2.5 pl-11 pr-4 text-sm font-medium outline-none transition-all focus:border-primary/20 focus:bg-white focus:ring-4 focus:ring-primary/5 dark:bg-white/5 dark:text-white dark:focus:bg-dark-2"
          />
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-gray-400 transition-colors group-focus-within:text-primary" />

          {/* Keyboard Shortcut Hint */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden xl:block">
            <kbd className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-white/10">
              ⌘K
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 border-l border-gray-200/50 dark:border-white/5 pl-2 md:pl-6">
          <ThemeToggleSwitch />

          <div className="h-8 w-px bg-gray-200/50 dark:bg-white/5" />

          <div className="shrink-0 transition-transform hover:scale-105">
            <UserInfo />
          </div>
        </div>
      </div>
    </header>
  );
}