import * as Icons from "../icons";
import { SVGProps, ComponentType } from "react";

export interface NavSubItem {
  title: string;
  url: string;
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
        url: "/daily-expense",
        icon: Icons.Alphabet,
        items: [],
      },
      {
        title: "Reports",
        icon: Icons.PieChart,
        items: [
          {
            title: "Monthly Report",
            url: "/reports/monthly",
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
          },
          {
            title: "Income Types",
            url: "/settings/income-types",
          },
          {
            title: "Expense Types",
            url: "/settings/expense-types",
          },
          {
            title: "Starting Balance",
            url: "/settings/balance",
          },
        ],
      },
    ],
  },
];
