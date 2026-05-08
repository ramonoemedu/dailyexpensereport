'use client';

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import { useAuthContext } from "@/components/AuthProvider";
import dayjs from "dayjs";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { PAGE_SIZE, sanitizeKey, unsanitizeKey } from "@/utils/KeySanitizer";
import { sendTelegramNotification, formatExpenseMessage } from "@/utils/telegramService";
import { invalidateFamilyCache } from "@/services/charts.services";
import { cacheRead, cacheWrite, cacheInvalidate } from "@/utils/clientCache";

// Module-level cache for dropdown/settings so Firestore isn't re-read on every mount
type SettingsCacheEntry = {
  ts: number;
  incomeCategories: string[];
  expenseCategories: string[];
};
const settingsCache = new Map<string, SettingsCacheEntry>();
const SETTINGS_CACHE_TTL_MS = 30 * 60_000;

export function useExpenseData(options?: { 
  paymentMethodFilter?: string | string[], 
  balanceType?: 'bank' | 'cash',
  bankId?: string,
  statusFilter?: 'all' | 'active' | 'inactive',
  familyId?: string, // allow override for testing, else use from auth
  useServerPagination?: boolean,
}) {
  const { user, currentFamilyId, loading: authLoading } = useAuthContext();
  const useServerPagination = options?.useServerPagination === true;
  const familyId = options?.familyId || currentFamilyId;
  const [allRows, setAllRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [balanceRecords, setBalanceRecords] = useState<{year: number, month: number, amount: number}[]>([]);
  const [filters, setFilters] = useState({
    searchText: "",
    date: null as string | null,
    typeFilter: "All",
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    statusFilter: "active"
  });
  const [serverRows, setServerRows] = useState<Record<string, any>[]>([]);
  const [serverTotalRows, setServerTotalRows] = useState(0);
  const [serverUniqueDescriptions, setServerUniqueDescriptions] = useState<string[]>([]);
  const [serverStats, setServerStats] = useState<any>({
    weeklyIncome: 0,
    weeklyExpense: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    totalIncome: 0,
    totalExpense: 0,
    startingBalance: 0,
    currentBalance: 0,
    startingBalanceKHR: 0,
    monthlyIncomeKHR: 0,
    monthlyExpenseKHR: 0,
    currentBalanceKHR: 0,
  });
  const [serverFilteredStats, setServerFilteredStats] = useState<any>({
    totalDebit: 0,
    totalCredit: 0,
    totalDebitKHR: 0,
    totalCreditKHR: 0,
  });
  const paymentMethodsParam = Array.isArray(options?.paymentMethodFilter)
    ? [...options.paymentMethodFilter].join("|")
    : options?.paymentMethodFilter || "";
  const balanceTypeParam = options?.balanceType || "bank";
  const bankIdParam = options?.bankId || "";
  const optionStatusParam = options?.statusFilter || "active";

  const getAuthHeaders = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) throw new Error("Authentication token is missing.");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, [user]);

  const fetchAllData = useCallback(async (forceRefresh = false) => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    setLoading(true);
    try {
      if (!familyId) {
        setAllRows([]);
        setBalanceRecords([]);
        return;
      }
      let data: Record<string, any>[] = [];
      let config: any = null;

      // Always fetch fresh — no client-side cache
      const q = query(
        collection(db, "families", familyId, "expenses"),
        orderBy("Date", "desc"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      data = snapshot.docs.map((doc) => {
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

      const configDoc = await getDoc(doc(db, 'families', familyId, 'settings', 'config'));
      config = configDoc.exists() ? configDoc.data() : null;

      setAllRows(data);

      // Build balances from cached or fetched family-scoped config.
      let balances: {year: number, month: number, amount: number, amountKHR: number}[] = [];
      if (config) {
        const familyBankBalances = Array.isArray(config?.balances) ? config.balances : [];
        const familyCashBalances = Array.isArray(config?.cashBalances) ? config.cashBalances : [];

        if (options?.balanceType === 'cash') {
          balances = familyCashBalances
            .map((b: any) => ({
              year: Number(b.year),
              month: Number(b.month),
              amount: Number(b.amount || 0),
              amountKHR: Number(b.amountKHR || 0),
            }))
            .filter((b: {year: number; month: number}) => Number.isFinite(b.year) && Number.isFinite(b.month))
            .sort((a: {year: number; month: number}, b: {year: number; month: number}) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
        } else {
          balances = familyBankBalances
            .filter((b: any) => !options?.bankId || b.bankId === options.bankId)
            .map((b: any) => ({
              year: Number(b.year),
              month: Number(b.month),
              amount: Number(b.amount || 0),
              amountKHR: Number(b.amountKHR || 0),
            }))
            .filter((b: {year: number; month: number}) => Number.isFinite(b.year) && Number.isFinite(b.month))
            .sort((a: {year: number; month: number}, b: {year: number; month: number}) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
        }
      }

      setBalanceRecords(balances);

    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [authLoading, familyId, options?.balanceType, options?.bankId]);

  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      // Apply statusFilter from options or filters state
      const effectiveStatusFilter = options?.statusFilter || filters.statusFilter;
      if (effectiveStatusFilter && effectiveStatusFilter !== 'all') {
        if (effectiveStatusFilter === 'active' && row.status === 'inactive') return false;
        if (effectiveStatusFilter === 'inactive' && row.status !== 'inactive') return false;
      }
      
      // Apply paymentMethodFilter if provided
      if (options?.paymentMethodFilter) {
        const method = row["Payment Method"] || row["Payment_Method"];
        
        // Normalize method name for comparison
        const normalizedMethod = (method || "").toString().toLowerCase().trim();
        
        const filterArray = Array.isArray(options.paymentMethodFilter) 
          ? options.paymentMethodFilter 
          : [options.paymentMethodFilter];

        // Map filters to include potential variants
        const expandedFilters = filterArray.flatMap(f => {
          const lowerF = f.toLowerCase();
          if (lowerF.includes("chip mong")) return [lowerF, "from chipmong bank to acaleda", "chip mong bank"];
          if (lowerF.includes("acleda")) return [lowerF, "acleda bank", "from chipmong bank to acaleda"];
          return [lowerF];
        });

        if (!expandedFilters.some(f => normalizedMethod.includes(f) || f.includes(normalizedMethod))) return false;
      }

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
  }, [allRows, filters, options?.paymentMethodFilter, options?.statusFilter]);

  const [page, setPage] = useState(1);

  const uniqueDescriptions = useMemo(() => {
    const descriptions = allRows.map(row => row.Description).filter(Boolean);
    return Array.from(new Set(descriptions)).sort();
  }, [allRows]);

  const stats = useMemo(() => {
    const filterMonth = filters.month;
    const filterYear = filters.year;
    const effectiveStatusFilter = options?.statusFilter || filters.statusFilter;
    
    const result = {
      weeklyIncome: 0,
      weeklyExpense: 0,
      monthlyIncome: 0,
      monthlyExpense: 0,
      totalIncome: 0,
      totalExpense: 0,
      startingBalance: 0,
      currentBalance: 0,
      // Cash specific dual currency stats
      startingBalanceKHR: 0,
      monthlyIncomeKHR: 0,
      monthlyExpenseKHR: 0,
      currentBalanceKHR: 0,
    };

    // Find anchor balance
    const targetTime = filterYear * 12 + filterMonth;
    const anchor = [...balanceRecords].reverse().find(r => (r.year * 12 + r.month) <= targetTime);
    
    let baseBalance = 0;
    let baseBalanceKHR = 0;
    let anchorYear = 0;
    let anchorMonth = 0;
    let hasAnchor = false;

    if (anchor) {
      baseBalance = (anchor as any).amount || 0;
      baseBalanceKHR = (anchor as any).amountKHR || 0;
      anchorYear = anchor.year;
      anchorMonth = anchor.month;
      hasAnchor = true;
    }

    allRows.forEach(row => {
      const status = row.status || 'active';

      // Respect status filter for stats calculation
      if (effectiveStatusFilter && effectiveStatusFilter !== 'all') {
        if (effectiveStatusFilter === 'active' && status === 'inactive') return;
        if (effectiveStatusFilter === 'inactive' && status !== 'inactive') return;
      }
      // If effectiveStatusFilter is 'all', we include both active and inactive.

      // Apply paymentMethodFilter to stats calculation
      if (options?.paymentMethodFilter) {
        const method = row["Payment Method"] || row["Payment_Method"];
        const normalizedMethod = (method || "").toString().toLowerCase().trim();
        const filterArray = Array.isArray(options.paymentMethodFilter) 
          ? options.paymentMethodFilter 
          : [options.paymentMethodFilter];

        const expandedFilters = filterArray.flatMap(f => {
          const lowerF = f.toLowerCase();
          if (lowerF.includes("chip mong")) return [lowerF, "from chipmong bank to acaleda", "chip mong bank"];
          if (lowerF.includes("acleda")) return [lowerF, "acleda bank", "from chipmong bank to acaleda"];
          return [lowerF];
        });

        if (!expandedFilters.some(f => normalizedMethod.includes(f) || f.includes(normalizedMethod))) return;
      }

      const date = dayjs(row.Date);
      const isFuture = date.isAfter(dayjs(), 'day');

      const amount = Math.abs(parseFloat(row["Amount (Income/Expense)"] || row["Amount"] || 0));
      const currency = row["Currency"] || "USD";
      const isIncome = row.Type === 'Income';

      // 1. Calculate Carryover
      if (hasAnchor) {
        const transTime = date.year() * 12 + date.month();
        const anchorTime = anchorYear * 12 + anchorMonth;
        if (transTime >= anchorTime && transTime < targetTime) {
          if (currency === "KHR") {
            if (isIncome) baseBalanceKHR += amount;
            else baseBalanceKHR -= amount;
          } else {
            if (isIncome) baseBalance += amount;
            else baseBalance -= amount;
          }
        }
      }

      // 2. Regular stats logic
      if (isFuture) return;

      const isTargetMonth = date.month() === filterMonth && date.year() === filterYear;
      const isTargetWeek = date.isSame(dayjs(), 'week'); 

      if (currency === "KHR") {
        if (isIncome) {
          if (isTargetMonth) result.monthlyIncomeKHR += amount;
        } else {
          if (isTargetMonth) result.monthlyExpenseKHR += amount;
        }
      } else {
        if (isIncome) {
          result.totalIncome += amount;
          if (isTargetWeek) result.weeklyIncome += amount;
          if (isTargetMonth) result.monthlyIncome += amount;
        } else {
          result.totalExpense += amount;
          if (isTargetWeek) result.weeklyExpense += amount;
          if (isTargetMonth) result.monthlyExpense += amount;
        }
      }
    });

    result.startingBalance = baseBalance;
    result.currentBalance = baseBalance + result.monthlyIncome - result.monthlyExpense;
    
    result.startingBalanceKHR = baseBalanceKHR;
    result.currentBalanceKHR = baseBalanceKHR + result.monthlyIncomeKHR - result.monthlyExpenseKHR;

    return result;
  }, [allRows, filters.month, filters.year, filters.statusFilter, balanceRecords, options?.paymentMethodFilter, options?.statusFilter]);

  const filteredStats = useMemo(() => {
    const result = {
      totalDebit: 0,
      totalCredit: 0,
      totalDebitKHR: 0,
      totalCreditKHR: 0
    };

    filteredRows.forEach(row => {
      const amount = Math.abs(parseFloat(row["Amount (Income/Expense)"] || row["Amount"] || 0));
      const isIncome = row.Type === 'Income';
      const currency = row["Currency"] || "USD";

      if (currency === "KHR") {
        if (isIncome) result.totalDebitKHR += amount;
        else result.totalCreditKHR += amount;
      } else {
        if (isIncome) result.totalDebit += amount;
        else result.totalCredit += amount;
      }
    });

    return result;
  }, [filteredRows]);

  const paginatedRows = useMemo(() => {
    if (useServerPagination) return serverRows;
    const start = (page - 1) * PAGE_SIZE;
    // Don't filter inactive here - statusFilter is already applied in filteredRows
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page, serverRows, useServerPagination]);

  const filtersRef = React.useRef(filters);
  filtersRef.current = filters;

  const fetchRows = useCallback(
    async (pageNumber: number, newFilters?: typeof filters) => {
      const effectiveFilters = newFilters || filtersRef.current;
      if (newFilters) {
        setFilters((prev) => {
          const isSame =
            prev.searchText === newFilters.searchText &&
            prev.date === newFilters.date &&
            prev.typeFilter === newFilters.typeFilter &&
            prev.month === newFilters.month &&
            prev.year === newFilters.year &&
            prev.statusFilter === newFilters.statusFilter;
          return isSame ? prev : newFilters;
        });
      }
      setPage(pageNumber);

      if (!useServerPagination) return;
      if (authLoading || !familyId) return;

      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        page: String(pageNumber),
        pageSize: String(PAGE_SIZE),
        month: String(effectiveFilters.month),
        year: String(effectiveFilters.year),
        date: effectiveFilters.date || "",
        searchText: effectiveFilters.searchText || "",
        typeFilter: effectiveFilters.typeFilter || "All",
        statusFilter: (effectiveFilters.statusFilter || optionStatusParam) as string,
        paymentMethods: paymentMethodsParam,
        balanceType: balanceTypeParam,
        bankId: bankIdParam,
      });

      const cacheKey = `expenses:${familyId}:${params.toString()}`;
      const TTL = 30_000; // 30 seconds — in-memory only, no localStorage
      const cached = cacheRead<any>(cacheKey, TTL);

      const applyPayload = (payload: any) => {
        setServerRows(Array.isArray(payload?.rows) ? payload.rows : []);
        setServerTotalRows(Number(payload?.totalRows || 0));
        setServerStats((prev: any) => payload?.stats || prev);
        setServerFilteredStats((prev: any) => payload?.filteredStats || prev);
        setServerUniqueDescriptions(Array.isArray(payload?.uniqueDescriptions) ? payload.uniqueDescriptions : []);
      };

      if (cached) {
        applyPayload(cached);
        setLoading(false);
        return; // fresh enough — skip the API call
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/families/${familyId}/expenses?${params.toString()}`, { method: "GET", headers, cache: 'no-store' });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || "Failed to fetch expenses.");
        cacheWrite(cacheKey, payload);
        applyPayload(payload);
      } catch (err) {
        console.error("Error fetching paginated rows:", err);
      } finally {
        setLoading(false);
      }
    },
    [
      authLoading,
      familyId,
      getAuthHeaders,
      balanceTypeParam,
      bankIdParam,
      optionStatusParam,
      paymentMethodsParam,
      useServerPagination,
    ]
  );

  const [dropdownOptions, setDropdownOptions] = useState<Record<string, string[]>>({
    "Payment Method": ["Cash", "ABA Bank", "ACLEDA Bank", "Chip Mong Bank", "From Chipmong bank to ACALEDA", "CIMB Bank"],
    "Type": ["Expense", "Income"],
    "Currency": ["USD", "KHR"],
    "Category": [],
    "incomeCategories": [],
    "expenseCategories": []
  });

  useEffect(() => {
    if (authLoading || !currentFamilyId) return;

    const cached = settingsCache.get(currentFamilyId);
    if (cached && Date.now() - cached.ts < SETTINGS_CACHE_TTL_MS) {
      setDropdownOptions(prev => ({
        ...prev,
        "incomeCategories": cached.incomeCategories,
        "expenseCategories": cached.expenseCategories,
        "Category": [...new Set([...cached.incomeCategories, ...cached.expenseCategories])]
      }));
      return;
    }

    async function fetchSettings() {
      try {
        const configDoc = await getDoc(doc(db, 'families', currentFamilyId!, 'settings', 'config'));
        if (!configDoc.exists()) return;
        const config = configDoc.data();

        const toStringList = (value: any): string[] => {
          if (Array.isArray(value)) {
            return value
              .map((item) => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object') {
                  return item.name || item.label || item.value || null;
                }
                return null;
              })
              .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
          }
          if (value && typeof value === 'object') {
            return Object.keys(value).filter((key) => key.trim().length > 0);
          }
          return [];
        };

        const storedIncomeNames = toStringList(config.incomeTypes);
        const incomeCategories = storedIncomeNames.length > 0
          ? storedIncomeNames
          : toStringList(config.incomeConfigs);
        const expenseCategories = toStringList(config.expenseTypes);

        settingsCache.set(currentFamilyId!, { ts: Date.now(), incomeCategories, expenseCategories });
        setDropdownOptions(prev => ({
          ...prev,
          "incomeCategories": incomeCategories,
          "expenseCategories": expenseCategories,
          "Category": [...new Set([...incomeCategories, ...expenseCategories])]
        }));
      } catch (err) {
        console.error("Error fetching category settings:", err);
      }
    }
    fetchSettings();
  }, [authLoading, currentFamilyId]);

    const saveEntry = async (id: string | null, data: Record<string, any>, sendNotification: boolean = true) => {
      setSaving(true);
      try {
        if (!familyId) throw new Error("No familyId set");
        const headers = await getAuthHeaders();
        if (id) {
          const res = await fetch(`/api/families/${familyId}/expenses/${id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ data }),
          });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload?.error || "Failed to update expense.");
        } else {
          const res = await fetch(`/api/families/${familyId}/expenses`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              data: {
                ...data,
                status: 'active',
                createdAt: new Date().toISOString()
              }
            }),
          });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload?.error || "Failed to create expense.");
        }

        invalidateFamilyCache(familyId);

        // Send Telegram Notification if enabled
        if (sendNotification) {
          const message = formatExpenseMessage(
            id ? 'Updated' : 'Created',
            data,
            stats
          );
          await sendTelegramNotification(message);
        }
  
        // Re-fetch data immediately to update the list
        if (useServerPagination) {
          await fetchRows(page, filters);
        } else {
          await fetchAllData(true);
        }
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
  const deactivateEntry = async (id: string, sendNotification: boolean = true) => {
    try {
      // Fetch record data first for notification
      if (!familyId) throw new Error("No familyId set");
      const recordRef = doc(db, "families", familyId, "expenses", id);
      const recordSnap = await getDoc(recordRef);
      const recordData = recordSnap.exists() ? recordSnap.data() : null;

      const headers = await getAuthHeaders();
      const res = await fetch(`/api/families/${familyId}/expenses/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ data: { status: 'inactive' } }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to deactivate expense.");

      invalidateFamilyCache(familyId);

      // Send Telegram Notification if enabled
      if (sendNotification && recordData) {
        // Map Firestore keys back to UI keys for the notification
        const mappedData: any = {};
        for (const k of Object.keys(recordData)) {
          mappedData[unsanitizeKey(k)] = recordData[k];
        }
        if (recordData.Amount !== undefined) mappedData.Amount = recordData.Amount;

        const message = formatExpenseMessage(
          'Deactivated',
          mappedData,
          stats
        );
        await sendTelegramNotification(message);
      }

      // Re-fetch data immediately to update the list
      if (useServerPagination) {
        await fetchRows(page, filters);
      } else {
        await fetchAllData(true);
      }
      return true;
    } catch (err) {
      console.error("Error deactivating entry:", err);
      return false;
    }
  };

  const activateEntry = async (id: string, sendNotification: boolean = true) => {
    try {
      // Fetch record data first for notification
      if (!familyId) throw new Error("No familyId set");
      const recordRef = doc(db, "families", familyId, "expenses", id);
      const recordSnap = await getDoc(recordRef);
      const recordData = recordSnap.exists() ? recordSnap.data() : null;

      const headers = await getAuthHeaders();
      const res = await fetch(`/api/families/${familyId}/expenses/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ data: { status: 'active' } }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to activate expense.");

      invalidateFamilyCache(familyId);

      // Send Telegram Notification if enabled
      if (sendNotification && recordData) {
        // Map Firestore keys back to UI keys for the notification
        const mappedData: any = {};
        for (const k of Object.keys(recordData)) {
          mappedData[unsanitizeKey(k)] = recordData[k];
        }
        if (recordData.Amount !== undefined) mappedData.Amount = recordData.Amount;

        const message = formatExpenseMessage(
          'Activated',
          mappedData,
          stats
        );
        await sendTelegramNotification(message);
      }

      // Re-fetch data immediately to update the list
      if (useServerPagination) {
        await fetchRows(page, filters);
      } else {
        await fetchAllData(true);
      }
      return true;
    } catch (err) {
      console.error("Error activating entry:", err);
      return false;
    }
  };

  useEffect(() => {
    if (useServerPagination) return;
    fetchAllData();
  }, [fetchAllData, useServerPagination]);

  return {
    rows: paginatedRows,
    loading,
    saving,
    totalRows: useServerPagination ? serverTotalRows : filteredRows.length,
    fetchRows,
    dropdownOptions,
    saveEntry,
    deactivateEntry,
    activateEntry,
    refreshCount: fetchAllData,
    stats: useServerPagination ? serverStats : stats,
    filteredStats: useServerPagination ? serverFilteredStats : filteredStats,
    uniqueDescriptions: useServerPagination ? serverUniqueDescriptions : uniqueDescriptions,
  };
}
