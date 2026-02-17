import * as Icons from "../icons";
import { SVGProps, ComponentType } from "react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

export interface NavItem {
  title: string;
  url?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  items: NavSubItem[];
  restricted?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
  restricted?: boolean;
}

export const NAV_DATA: NavSection[] = [
  {
    label: "Main Menu",
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: Icons.HomeIcon,
        items: [],
      },
      {
        title: "Daily Expense",
        icon: Icons.Alphabet,
        items: [
          // {
          //   title: "Daily Expense (All Banks)",
          //   url: "/daily-expense/all-banks",
          //   icon: Icons.Table,
          // },
          {
            title: "Daily Expense (Chip Mong)",
            url: "/daily-expense/bank/chip-mong",
            icon: Icons.Table,
          },
          // {
          //   title: "Daily Expense (CIMB Bank)",
          //   url: "/daily-expense/bank/cimb",
          //   icon: Icons.Table,
          // },
          // {
          //   title: "Daily Expense (ABA Bank)",
          //   url: "/daily-expense/bank/aba",
          //   icon: Icons.Table,
          // },
          // {
          //   title: "Daily Expense (ACLEDA)",
          //   url: "/daily-expense/bank/acleda",
          //   icon: Icons.Table,
          // },
          {
            title: "Daily Expense (Cash)",
            url: "/daily-expense/cash",
            icon: Icons.Table,
          },
        ],
      },
      {
        title: "Reports",
        icon: Icons.PieChart,
        items: [
          {
            title: "Report (Chip Mong)",
            url: "/reports/monthly/bank/chip-mong",
            icon: Icons.Table,
          },
          // {
          //   title: "Report (CIMB Bank)",
          //   url: "/reports/monthly/bank/cimb",
          //   icon: Icons.Table,
          // },
          // {
          //   title: "Report (ABA Bank)",
          //   url: "/reports/monthly/bank/aba",
          //   icon: Icons.Table,
          // },
          // {
          //   title: "Report (ACLEDA)",
          //   url: "/reports/monthly/bank/acleda",
          //   icon: Icons.Table,
          // },
          {
            title: "Report (Cash)",
            url: "/reports/monthly/cash",
            icon: Icons.Table,
          },
        ],
      },
      {
        title: "Settings",
        icon: Icons.FourCircle,
        items: [
          {
            title: "User Management",
            url: "/settings/users",
            icon: Icons.User,
          },
          {
            title: "Income Types",
            url: "/settings/income-types",
            icon: Icons.Alphabet,
          },
          {
            title: "Expense Types",
            url: "/settings/expense-types",
            icon: Icons.Calendar,
          },
          {
            title: "Starting Balance Banks",
            url: "/settings/balance",
            icon: Icons.HomeIcon,
          },
          {
            title: "Starting Balance Cash",
            url: "/settings/cash-balance",
            icon: Icons.HomeIcon,
          },
        ],
      },
    ],
  },
];