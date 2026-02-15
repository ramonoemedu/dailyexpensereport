'use client';

import React from 'react';
import { Sidebar } from "@/components/NextAdmin/Layouts/sidebar";
import { Header } from "@/components/NextAdmin/Layouts/header";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0 bg-gray-2">
        <Header />

        <main className="isolate mx-auto w-full max-w-screen-2xl overflow-x-hidden p-4 md:p-6 2xl:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}