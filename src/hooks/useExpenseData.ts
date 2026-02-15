'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import dayjs from "dayjs";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { PAGE_SIZE, sanitizeKey, unsanitizeKey } from "@/utils/KeySanitizer";

export function useExpenseData() {
  const [allRows, setAllRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({
    searchText: "",
    date: null as string | null,
    typeFilter: "All",
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
  });

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "expenses"),
        orderBy("Date", "desc"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => {
        const raw = doc.data();
        const mapped: { id: string; [key: string]: any } = { id: doc.id };
        for (const key of Object.keys(raw)) {
          const uiKey = unsanitizeKey(key);
          if (uiKey === "Amount") {
            mapped["Amount (Income/Expense)"] = raw[key];
          } else {
            mapped[uiKey] = raw[key];
          }
        }
        // Ensure Type exists
        if (!mapped["Type"]) mapped["Type"] = "Expense";
        return mapped;
      });
      setAllRows(data);
    } catch (err) {
      console.error("Error fetching expense data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        const searchFields = ["Description", "Payment Method"];
        const matchesSearch = searchFields.some((field) => {
          const val = row[field];
          return val && val.toString().toLowerCase().includes(search);
        });
        if (!matchesSearch) return false;
      }

      if (filters.date && row["Date"] !== filters.date) {
        return false;
      }

      if (filters.typeFilter !== "All" && row["Type"] !== filters.typeFilter) {
        return false;
      }

      // Default month/year filter
      const rowDate = dayjs(row["Date"]);
      if (rowDate.month() !== filters.month || rowDate.year() !== filters.year) {
        // If a specific Date filter is set, ignore the month/year filter
        if (!filters.date) return false;
      }

      return true;
    });
  }, [allRows, filters]);

  const [page, setPage] = useState(1);

  const uniqueDescriptions = useMemo(() => {
    const descriptions = allRows.map(row => row.Description).filter(Boolean);
    return Array.from(new Set(descriptions)).sort();
  }, [allRows]);

  const stats = useMemo(() => {
    const filterMonth = filters.month;
    const filterYear = filters.year;
    
    // Reference date based on filter
    const refDate = dayjs().year(filterYear).month(filterMonth);

    const result = {
      weeklyIncome: 0,
      weeklyExpense: 0,
      monthlyIncome: 0,
      monthlyExpense: 0,
      totalIncome: 0,
      totalExpense: 0,
    };

    allRows.forEach(row => {
      if (row.status === 'inactive') return;

      const date = dayjs(row.Date);
      const amount = Math.abs(parseFloat(row["Amount (Income/Expense)"] || row["Amount"] || 0));
      const isIncome = row.Type === 'Income';

      const isTargetMonth = date.month() === filterMonth && date.year() === filterYear;
      // Week is only relevant if we are looking at the current month/year or a specific reference week
      const isTargetWeek = date.isSame(dayjs(), 'week'); 

      if (isIncome) {
        result.totalIncome += amount;
        if (isTargetWeek) result.weeklyIncome += amount;
        if (isTargetMonth) result.monthlyIncome += amount;
      } else {
        result.totalExpense += amount;
        if (isTargetWeek) result.weeklyExpense += amount;
        if (isTargetMonth) result.monthlyExpense += amount;
      }
    });

    return result;
  }, [allRows, filters.month, filters.year]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    // Also filter out inactive from table display
    const visibleRows = filteredRows.filter(row => row.status !== 'inactive');
    return visibleRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const fetchRows = useCallback(
    async (pageNumber: number, newFilters?: typeof filters) => {
      if (newFilters) {
        setFilters(newFilters);
      }
      setPage(pageNumber);
    },
    []
  );

  const [dropdownOptions, setDropdownOptions] = useState<Record<string, string[]>>({
    "Payment Method": ["Cash", "ABA Bank", "ACLEDA Bank", "Chip Mong Bank", "From Chipmong bank to ACALEDA", "CIMB Bank"],
    "Type": ["Expense", "Income"],
    "Category": [],
    "incomeCategories": [],
    "expenseCategories": []
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        const incomeDoc = await getDoc(doc(db, 'settings', 'incomeTypes'));
        const expenseDoc = await getDoc(doc(db, 'settings', 'expenseTypes'));
        
        // Also fetch from income_configs collection for the new names
        const incomeConfigsSnap = await getDocs(collection(db, 'income_configs'));
        const configNames = incomeConfigsSnap.docs.map(d => d.data().name);
        
        const incomeTypes = incomeDoc.exists() ? incomeDoc.data().types || [] : [];
        const expenseTypes = expenseDoc.exists() ? expenseDoc.data().types || [] : [];
        
        const allIncomeNames = [...new Set([...incomeTypes, ...configNames])];

        setDropdownOptions(prev => ({
          ...prev,
          "incomeCategories": allIncomeNames,
          "expenseCategories": expenseTypes,
          "Category": [...new Set([...allIncomeNames, ...expenseTypes])]
        }));
      } catch (err) {
        console.error("Error fetching category settings:", err);
      }
    }
    fetchSettings();
  }, []);

  const saveEntry = async (id: string | null, data: Record<string, any>) => {
    setSaving(true);
    try {
      if (id) {
        await updateDoc(doc(db, "expenses", id), data);
      } else {
        // Ensure new entries are active and have createdAt
        await addDoc(collection(db, "expenses"), { 
          ...data, 
          status: 'active',
          createdAt: new Date().toISOString()
        });
      }
      // Re-fetch everything immediately to update the list
      await fetchAllData();
      return true;
    } catch (err) {
      console.error("Error saving entry:", err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deactivateEntry = async (id: string) => {
    try {
      await updateDoc(doc(db, "expenses", id), { status: 'inactive' });
      // Re-fetch everything immediately to update the list
      await fetchAllData();
      return true;
    } catch (err) {
      console.error("Error deactivating entry:", err);
      return false;
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return {
    rows: paginatedRows,
    loading,
    saving,
    totalRows: filteredRows.filter(r => r.status !== 'inactive').length,
    fetchRows,
    dropdownOptions,
    saveEntry,
    deactivateEntry,
    refreshCount: fetchAllData,
    stats,
    uniqueDescriptions,
  };
}
