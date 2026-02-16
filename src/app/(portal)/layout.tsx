'use client';

import React from 'react';
import { Header } from "@/components/NextAdmin/Layouts/header";
import { SidebarProvider } from '@/components/NextAdmin/Layouts/sidebar/sidebar-context';

// CHANGE THIS LINE: Add curly braces around Sidebar
import { Sidebar } from '@/components/NextAdmin/Layouts/sidebar';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[#F8F9FA] dark:bg-[#09090b]">
        {/* This will now work perfectly */}
        <Sidebar />

        <div className="flex flex-1 flex-col min-w-0">
          <Header />
          <main className="isolate mx-auto w-full max-w-screen-2xl overflow-x-hidden p-4 md:p-6 2xl:p-10">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}