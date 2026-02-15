"use client";

import { SidebarProvider } from "@/components/NextAdmin/Layouts/sidebar/sidebar-context";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "./ui/toast";

export function NextAdminProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light" attribute="class">
      <ToastProvider>
        <SidebarProvider>{children}</SidebarProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
