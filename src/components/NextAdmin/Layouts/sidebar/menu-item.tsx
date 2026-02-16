import { cn } from "@/lib/NextAdmin/utils";
import Link from "next/link";
import { useSidebarContext } from "./sidebar-context";

export function MenuItem(
  props: {
    className?: string;
    children: React.ReactNode;
    isActive: boolean;
  } & ({ as?: "button"; onClick: () => void } | { as: "link"; href: string }),
) {
  const { toggleSidebar, isMobile } = useSidebarContext();

  const baseStyles = cn(
    "flex w-full items-center gap-3.5 px-4 py-3 rounded-[14px] transition-all duration-300 ease-in-out",
    props.isActive 
      ? "bg-primary/5 text-primary shadow-sm" 
      : "text-dark-4 hover:bg-gray-100 dark:text-dark-6 dark:hover:bg-dark-2 hover:text-dark dark:hover:text-white",
    props.className
  );

  if (props.as === "link") {
    return (
      <Link
        href={props.href}
        onClick={() => isMobile && toggleSidebar()}
        className={baseStyles}
      >
        {props.children}
      </Link>
    );
  }

  return (
    <button
      onClick={props.onClick}
      aria-expanded={props.isActive}
      className={baseStyles}
    >
      {props.children}
    </button>
  );
}