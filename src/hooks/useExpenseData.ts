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
import { sendTelegramNotification, formatExpenseMessage } from "@/utils/telegramService";

export function useExpenseData() {
  const [allRows, setAllRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [balanceRecords, setBalanceRecords] = useState<{year: number, month: number, amount: number}[]>([]);
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
      // Fetch Expenses
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
        if (!mapped["Type"]) mapped["Type"] = "Expense";
        return mapped;
      });
      setAllRows(data);

      // Fetch Balances
      const balanceSnapshot = await getDocs(collection(db, "settings"));
      const balances = balanceSnapshot.docs
        .filter(d => d.id.startsWith("balance_"))
        .map(d => {
          const parts = d.id.split("_");
          return { 
            year: parseInt(parts[1]), 
            month: parseInt(parts[2]), 
            amount: parseFloat(d.data().amount || 0)
          };
        })
        .sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
      setBalanceRecords(balances);

    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        const searchFields = ["Description", "Payment Method", "Category"];
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
    
    const result = {
      weeklyIncome: 0,
      weeklyExpense: 0,
      monthlyIncome: 0,
      monthlyExpense: 0,
      totalIncome: 0,
      totalExpense: 0,
      startingBalance: 0,
      currentBalance: 0,
    };

    // Find anchor balance
    const targetTime = filterYear * 12 + filterMonth;
    const anchor = [...balanceRecords].reverse().find(r => (r.year * 12 + r.month) <= targetTime);
    
    let baseBalance = 0;
    let anchorYear = 0;
    let anchorMonth = 0;
    let hasAnchor = false;

    if (anchor) {
      baseBalance = anchor.amount;
      anchorYear = anchor.year;
      anchorMonth = anchor.month;
      hasAnchor = true;
    }

    allRows.forEach(row => {
      if (row.status === 'inactive') return;

      const date = dayjs(row.Date);
      const isFuture = date.isAfter(dayjs(), 'day');

      const amount = Math.abs(parseFloat(row["Amount (Income/Expense)"] || row["Amount"] || 0));
      const isIncome = row.Type === 'Income';

      // 1. Calculate Carryover for "startingBalance"
      if (hasAnchor) {
        const transTime = date.year() * 12 + date.month();
        const anchorTime = anchorYear * 12 + anchorMonth;
        if (transTime >= anchorTime && transTime < targetTime) {
          if (isIncome) baseBalance += amount;
          else baseBalance -= amount;
        }
      }

      // 2. Regular stats logic
      if (isFuture) return;

      const isTargetMonth = date.month() === filterMonth && date.year() === filterYear;
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

    result.startingBalance = baseBalance;
    result.currentBalance = baseBalance + result.monthlyIncome - result.monthlyExpense;

    return result;
  }, [allRows, filters.month, filters.year, balanceRecords]);

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

    const saveEntry = async (id: string | null, data: Record<string, any>, sendNotification: boolean = true) => {
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
  
        // Send Telegram Notification if enabled
        if (sendNotification) {
          const message = formatExpenseMessage(
            id ? 'Updated' : 'Created',
            data,
            stats
          );
          await sendTelegramNotification(message);
        }
  
        // Re-fetch everything immediately to update the list
        await fetchAllData();
        return true;
      } catch (err: any) {
        console.error("Error saving entry:", err);
        
        // Send Error Notification to Telegram (Always send errors if possible, or maybe respect flag? Let's respect flag for user actions, but errors are system level. But for now, let's keep error reporting active or respect flag? 
        // User likely wants to toggle the "Success" report. I'll stick to respecting the flag for the main message, but maybe suppress error if flag is off? 
        // Actually, if I uncheck "Send to Telegram", I probably don't want any noise.
        
              if (sendNotification) {
                const errorMessage = formatExpenseMessage(
                  'Error',
                  data,
                  stats,
                  err.message
                );
                await sendTelegramNotification(errorMessage, true);
              }  
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
