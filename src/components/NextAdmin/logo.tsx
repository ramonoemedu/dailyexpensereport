import darkLogo from "@/assets/logos/dark.svg";
import logo from "@/assets/logos/main.svg";
import Image from "next/image";

export function Logo() {
  return (
    <div className="relative h-10 max-w-[15rem]">
      <Image
        src={logo}
        fill
        className="dark:hidden object-contain object-left"
        alt="Daily Expense logo"
        role="presentation"
        quality={100}
      />

      <Image
        src={darkLogo}
        fill
        className="hidden dark:block object-contain object-left"
        alt="Daily Expense logo"
        role="presentation"
        quality={100}
      />
    </div>
  );
}
