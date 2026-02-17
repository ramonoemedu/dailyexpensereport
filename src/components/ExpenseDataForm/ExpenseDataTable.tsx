'use client';

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/NextAdmin/ui/table";
import { IconButton, Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteIcon from "@mui/icons-material/Delete";
import { dateFields, formatDisplayDate } from "@/utils/KeySanitizer";
import { cn } from "@/lib/NextAdmin/utils";
import dayjs from "dayjs";

type Props = {
  columns: string[];
  rows: Record<string, string | number>[];
  openEditDialog: (row: any, idx: number) => void;
  openDetailDialog: (row: any) => void;
  handleDeactivate: (id: string) => void;
};

const getBadgeStyles = (val: string) => {
  const normalized = val.toUpperCase();
  if (normalized === "ABA BANK") return "bg-blue/10 text-blue";
  if (normalized === "ACLEDA BANK") return "bg-green/10 text-green";
  if (normalized === "CASH") return "bg-primary/10 text-primary";
  if (normalized === "CIMB BANK") return "bg-warning/10 text-warning";
  return "bg-dark/5 text-dark dark:text-white";
};

export function ExpenseDataTable({
  columns,
  rows,
  openEditDialog,
  openDetailDialog,
  handleDeactivate,
}: Props) {
  return (
    <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark md:p-2">
      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-none bg-[#F7F9FC] dark:bg-dark-2 [&>th]:py-4 [&>th]:text-xs [&>th]:font-bold [&>th]:text-dark [&>th]:dark:text-white uppercase tracking-wider">
              {columns.map((col) => (
                <TableHead 
                  key={col}
                  className={cn(
                    "whitespace-nowrap px-3",
                    (col === "Debit" || col === "Credit" || col === "Amount") ? "text-right" : "text-left"
                  )}
                >
                  {col === "Type" ? "Exp Type" : col}
                </TableHead>
              ))}
              <TableHead className="sticky right-0 z-10 bg-[#F7F9FC] dark:bg-dark-2 text-center px-3">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="text-center py-12 text-dark-5"
                >
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-lg font-medium">No records found</p>
                    <p className="text-sm">Try adjusting your filters or add a new entry.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => {
                const isToday = row["Date"] === dayjs().format("YYYY-MM-DD");
                
                return (
                  <TableRow
                    key={row.id || idx}
                    className={cn(
                      "group border-stroke transition-colors",
                      isToday 
                        ? "bg-gradient-to-r from-primary/5 via-primary/10 to-transparent dark:from-primary/10 dark:via-primary/20 dark:to-transparent border-l-4 border-l-primary" 
                        : "hover:bg-gray-2/50 dark:border-dark-3 dark:hover:bg-dark-2/50"
                    )}
                  >
                    {columns.map((col) => {
                    const isIncome = row["Type"] === "Income";
                    let displayVal = row[col];
                    let cellClass = "text-left";

                    if (col === "Debit") {
                      const val = isIncome ? (row["Amount (Income/Expense)"] || row["Amount"] || 0) : "";
                      displayVal = val !== "" ? Math.abs(parseFloat(val.toString())).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
                      cellClass = "text-right text-success font-bold";
                    } else if (col === "Credit") {
                      const val = !isIncome ? (row["Amount (Income/Expense)"] || row["Amount"] || 0) : "";
                      displayVal = val !== "" ? Math.abs(parseFloat(val.toString())).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
                      cellClass = "text-right text-danger font-bold";
                    }

                    const isBadgeField = col === "Payment Method";
                    const badgeStyles = isBadgeField && typeof displayVal === "string" ? getBadgeStyles(displayVal) : "";

                    return (
                      <TableCell
                        key={col}
                        className={cn(
                          "whitespace-nowrap px-3 py-3 text-sm text-dark dark:text-white",
                          cellClass
                        )}
                      >
                        {isBadgeField && typeof displayVal === "string" ? (
                          <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-medium", badgeStyles)}>
                            {displayVal}
                          </span>
                        ) : (
                          <span className={cn(
                            "truncate block",
                            col === "Description" ? "max-w-[200px]" : "max-w-[120px]"
                          )}>
                            {dateFields.includes(col)
                              ? formatDisplayDate(displayVal as string)
                              : displayVal}
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell 
                    className="sticky right-0 z-10 bg-white group-hover:bg-gray-2/5 dark:bg-gray-dark dark:group-hover:bg-dark-2/5 text-center px-4 border-l border-stroke dark:border-dark-3" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <Tooltip title="View Details">
                        <IconButton
                          onClick={() => openDetailDialog(row)}
                          size="small"
                          className="text-dark-4 hover:text-primary transition-colors"
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Expense">
                        <IconButton
                          onClick={() => openEditDialog(row, idx)}
                          size="small"
                          className="text-dark-4 hover:text-secondary transition-colors"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Deactivate">
                        <IconButton
                          onClick={() => handleDeactivate(row.id as string)}
                          size="small"
                          className="text-dark-4 hover:text-danger transition-colors"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
        </Table>
      </div>
    </div>
  );
}
