import dayjs from "dayjs";

export const formatDisplayDate = (value: string) => {
  if (!value) return "";
  const d = dayjs(value, ["YYYY-MM-DD", "DD-MM-YYYY"]);
  return d.isValid() ? d.format("DD-MM-YYYY") : value;
};

export const dateFields = ["Date"];

export const dropdownFields: Record<string, string[]> = {
  "Payment Method": ["Cash", "ABA Bank", "ACLEDA Bank", "Chip Mong Bank", "From Chipmong bank to ACALEDA"],
};

export const PAGE_SIZE = 20;

export const sanitizeKey = (key: string) =>
  key.trim().replace(/[.~*/[\] ]/g, "_");

export const unsanitizeKey = (key: string) =>
  key.replace(/_/g, " ");

export const columns = [
  "Date",
  "Description",
  "Category",
  "Debit",
  "Credit",
  "Type",
  "Payment Method",
];
