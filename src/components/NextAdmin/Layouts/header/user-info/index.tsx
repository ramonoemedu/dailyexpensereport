"use client";

import { ChevronUpIcon } from "@/assets/icons";
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/NextAdmin/ui/dropdown";
import { cn } from "@/lib/NextAdmin/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOutIcon, UserIcon } from "./icons";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export function UserInfo() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser({
          name: currentUser.displayName || currentUser.email?.split('@')[0] || "User",
          email: currentUser.email || "",
        });
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  if (!user) return null;

  return (
    <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
      <DropdownTrigger className="rounded-xl align-middle outline-none transition-all hover:bg-gray-100 dark:hover:bg-dark-2 p-1.5 ring-primary ring-offset-2 focus-visible:ring-1 dark:ring-offset-gray-dark">
        <span className="sr-only">My Account</span>

        <figure className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
            <UserIcon className="size-5" />
          </div>
          <figcaption className="flex items-center gap-1 font-bold text-sm text-dark dark:text-white max-[1024px]:sr-only">
            <span>{user.name}</span>

            <ChevronUpIcon
              aria-hidden
              className={cn(
                "size-4 rotate-180 transition-transform duration-300",
                isOpen && "rotate-0 text-primary",
              )}
            />
          </figcaption>
        </figure>
      </DropdownTrigger>

      <DropdownContent
        className="rounded-2xl border border-stroke bg-white/95 backdrop-blur-xl shadow-2xl dark:border-dark-3 dark:bg-gray-dark/95 min-[230px]:min-w-[17.5rem] mt-2 overflow-hidden"
        align="end"
      >
        <h2 className="sr-only">User information</h2>

        <div className="flex flex-col px-6 py-5 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="text-base font-black text-dark dark:text-white leading-tight">
            {user.name}
          </div>
          <div className="text-xs font-bold text-dark-5 mt-1">
            {user.email}
          </div>
        </div>

        <div className="p-2">
          <button
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-danger hover:bg-danger/5 transition-all font-bold text-sm"
            onClick={handleLogout}
          >
            <LogOutIcon className="size-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </DropdownContent>
    </Dropdown>
  );
}