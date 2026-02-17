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
          {
            title: "Daily Expense Report Bank",
            url: "/daily-expense/bank",
            icon: Icons.Table,
          },
          {
            title: "Daily Expense Report Cash",
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
            title: "Monthly Report Bank",
            url: "/reports/monthly",
            icon: Icons.Table,
          },
          {
            title: "Monthly Report Cash",
            url: "/reports/cash",
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
            title: "Starting Balance Bank",
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