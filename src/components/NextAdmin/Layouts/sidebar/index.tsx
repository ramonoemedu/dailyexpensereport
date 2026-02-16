"use client";

import { cn } from "@/lib/NextAdmin/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_DATA } from "./data";
import { ArrowLeftIcon, ChevronUp } from "./icons";
import { MenuItem } from "./menu-item";
import { useSidebarContext } from "./sidebar-context";
import { Logo } from "@/components/NextAdmin/logo";

export function Sidebar() {
  const pathname = usePathname();
  const { setIsOpen, isOpen, isMobile, toggleSidebar } = useSidebarContext();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) => (prev.includes(title) ? [] : [title]));
  };

  useEffect(() => {
    NAV_DATA.some((section) => {
      return section.items.some((item) => {
        return item.items.some((subItem) => {
          if (subItem.url === pathname) {
            if (!expandedItems.includes(item.title)) {
              toggleExpanded(item.title);
            }
            return true;
          }
        });
      });
    });
  }, [pathname]);

  return (
    <>
      {/* Mobile Overlay - Premium Blur */}
      {isMobile && (
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/30 backdrop-blur-md transition-all duration-500",
            isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
          )}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "z-50 flex flex-col border-r border-stroke bg-white/95 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] dark:border-dark-3 dark:bg-gray-dark/98 backdrop-blur-2xl shadow-2xl",
          // Layout Behavior
          !isMobile ? "sticky top-0 h-screen transition-[width,transform]" : "fixed bottom-0 top-0",
          isOpen ? "w-[290px] translate-x-0" : "w-0 -translate-x-full lg:translate-x-0 lg:w-0 overflow-hidden border-none"
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-full flex-col py-8 px-6 overflow-hidden min-w-[290px]">
          {/* Logo Section - Professional Spacing */}
          <div className="flex items-center justify-between mb-12 px-2">
            <Link
              href={"/"}
              onClick={() => isMobile && toggleSidebar()}
              className="transition-all duration-300 hover:scale-105 active:scale-95 block w-full relative h-10"
            >
              <Logo />
            </Link>

            {isMobile && (
              <button
                onClick={toggleSidebar}
                className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-dark-4 hover:bg-primary hover:text-white transition-all duration-300 dark:bg-dark-2"
              >
                <ArrowLeftIcon className="size-5 transition-transform group-hover:-translate-x-0.5" />
              </button>
            )}
          </div>

          {/* Navigation - Bento Design */}
          <div className="custom-scrollbar flex-1 overflow-y-auto pr-2 -mr-2">
            {NAV_DATA.map((section) => (
              <div key={section.label} className="mb-10 last:mb-0">
                <h2 className="mb-5 px-4 text-[11px] font-black uppercase tracking-[0.25em] text-dark-5 dark:text-dark-6 opacity-50 flex items-center gap-2">
                  <span className="h-[1px] w-4 bg-primary opacity-40"></span>
                  {section.label}
                </h2>

                <nav role="navigation" aria-label={section.label}>
                  <ul className="space-y-2.5">
                    {section.items.map((item) => (
                      <li key={item.title}>
                        {item.items.length ? (
                          <div className="space-y-1.5">
                            <MenuItem
                              isActive={item.items.some(({ url }) => url === pathname)}
                              onClick={() => toggleExpanded(item.title)}
                              className="group py-3.5"
                            >
                              <div className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110",
                                item.items.some(({ url }) => url === pathname) 
                                  ? "bg-primary text-white shadow-lg shadow-primary/30" 
                                  : "bg-gray-100 dark:bg-dark-2 text-dark-4 group-hover:bg-primary/10 group-hover:text-primary"
                              )}>
                                <item.icon className="size-5" aria-hidden="true" />
                              </div>

                              <span className="flex-1 font-bold text-[15px] tracking-tight">{item.title}</span>

                              <ChevronUp
                                className={cn(
                                  "ml-auto size-4 transition-all duration-500",
                                  expandedItems.includes(item.title) ? "rotate-0 text-primary" : "rotate-180 opacity-40",
                                )}
                                aria-hidden="true"
                              />
                            </MenuItem>

                            {expandedItems.includes(item.title) && (
                              <ul className="ml-6 pl-5 border-l-2 border-primary/10 dark:border-dark-3 space-y-1.5 py-1" role="menu">
                                {item.items.map((subItem) => (
                                  <li key={subItem.title} role="none">
                                    <MenuItem
                                      as="link"
                                      href={subItem.url}
                                      isActive={pathname === subItem.url}
                                      className={cn(
                                        "py-2.5 text-[13px] font-bold transition-all duration-300",
                                        pathname === subItem.url ? "text-primary translate-x-1" : "text-dark-5 hover:text-dark dark:hover:text-white hover:translate-x-1"
                                      )}
                                    >
                                      {subItem.icon && (
                                        <subItem.icon className={cn(
                                          "size-4 opacity-60 mr-1",
                                          pathname === subItem.url && "text-primary opacity-100"
                                        )} />
                                      )}
                                      <span>{subItem.title}</span>
                                    </MenuItem>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ) : (
                          <MenuItem
                            as="link"
                            href={item.url || "/"}
                            isActive={pathname === item.url}
                            className="group py-3.5"
                          >
                            <div className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110",
                              pathname === item.url 
                                ? "bg-primary text-white shadow-lg shadow-primary/30" 
                                : "bg-gray-100 dark:bg-dark-2 text-dark-4 group-hover:bg-primary/10 group-hover:text-primary"
                            )}>
                              <item.icon className="size-5" aria-hidden="true" />
                            </div>
                            <span className="font-bold text-[15px] tracking-tight">{item.title}</span>
                          </MenuItem>
                        )}
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            ))}
          </div>

          {/* Footer - Minimalist Brand */}
          <div className="mt-auto pt-8 border-t border-stroke dark:border-dark-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-dark-5 opacity-40">
              Daily Expense System
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
