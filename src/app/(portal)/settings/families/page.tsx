'use client';

import React, { useState, useEffect, useCallback } from "react";
import {
  IconButton,
  Tooltip,
  Skeleton,
  Typography,
  Box,
  Chip,
  Switch,
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import { auth } from "@/lib/firebase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/NextAdmin/ui/table";
import { cn } from "@/lib/NextAdmin/utils";
import { useAuthContext } from "@/components/AuthProvider";
import { useToast } from "@/components/NextAdmin/ui/toast";
import { useConfirm } from "@/hooks/NextAdmin/useConfirm";
import { ConfirmationDialog } from "@/components/NextAdmin/ui/ConfirmationDialog";
import { cachedFetch, cacheInvalidate } from "@/utils/clientCache";

const FAMILIES_CACHE_TTL = 30 * 60_000;
const FAMILIES_CACHE_KEY = "admin-families";

interface FamilyItem {
  id: string;
  name: string;
  status: "active" | "inactive";
  memberCount: number;
  members?: Array<{
    uid: string;
    role: string;
    fullName?: string;
    username?: string;
    loginEmail?: string;
  }>;
  manageable?: boolean;
  createdAt: string | null;
}

export default function FamilyManagementPage() {
  const { userRole } = useAuthContext();
  const { showToast } = useToast();
  const { confirm, isOpen: isConfirmOpen, options: confirmOptions, handleConfirm, handleCancel } = useConfirm();

  const [families, setFamilies] = useState<FamilyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Authentication token is missing.");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const fetchFamilies = useCallback(async () => {
    setLoading(true);
    try {
      if (userRole !== "admin") {
        setFamilies([]);
        return;
      }
      const families = await cachedFetch<FamilyItem[]>(FAMILIES_CACHE_KEY, FAMILIES_CACHE_TTL, async () => {
        const res = await fetch("/api/admin/families", {
          method: "GET",
          headers: await getAuthHeaders(),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || "Failed to fetch families.");
        return (payload?.families || []) as FamilyItem[];
      });
      setFamilies(families);
    } catch (err: any) {
      console.error("Error fetching families:", err);
      showToast(err.message || "Failed to load families.", "error");
    } finally {
      setLoading(false);
    }
  }, [userRole, getAuthHeaders, showToast]);

  useEffect(() => {
    fetchFamilies();
  }, [fetchFamilies]);

  const handleToggleStatus = async (family: FamilyItem) => {
    if (!family.manageable) {
      showToast("You are not admin of this family.", "error");
      return;
    }

    const newStatus = family.status === "active" ? "inactive" : "active";
    const confirmed = await confirm({
      title: newStatus === "inactive" ? "Deactivate Family?" : "Activate Family?",
      message:
        newStatus === "inactive"
          ? `Deactivate family "${family.name}"? Members may lose access.`
          : `Activate family "${family.name}"? Members will regain access.`,
      confirmText: newStatus === "inactive" ? "Deactivate" : "Activate",
      type: newStatus === "inactive" ? "danger" : "info",
    });
    if (!confirmed) return;

    setTogglingId(family.id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/families", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ familyId: family.id, status: newStatus }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to update family status.");
      cacheInvalidate(FAMILIES_CACHE_KEY);
      setFamilies((prev) =>
        prev.map((f) => (f.id === family.id ? { ...f, status: newStatus } : f))
      );
      showToast(
        `Family "${family.name}" ${newStatus === "active" ? "activated" : "deactivated"} successfully.`,
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to update family.", "error");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-full space-y-6">
      <ConfirmationDialog
        open={isConfirmOpen}
        title={confirmOptions?.title || ''}
        message={confirmOptions?.message || ''}
        confirmText={confirmOptions?.confirmText}
        type={confirmOptions?.type}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-heading-5 font-bold text-dark dark:text-white">
              Family Management
            </h1>
            <p className="text-body-sm font-medium text-dark-5">
              Activate or deactivate family accounts
            </p>
          </div>
        </div>

        {userRole !== "admin" ? (
          <div className="flex flex-col items-center justify-center py-20 text-dark-5">
            <GroupsIcon sx={{ fontSize: 48, mb: 2, opacity: 0.4 }} />
            <Typography className="font-bold">Admin access required</Typography>
            <Typography variant="caption">Only admins can manage families.</Typography>
          </div>
        ) : (
          <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark overflow-hidden">
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-none bg-[#F7F9FC] dark:bg-dark-2 [&>th]:py-4 [&>th]:text-sm [&>th]:font-semibold [&>th]:text-dark [&>th]:dark:text-white">
                    <TableHead className="px-4 text-left">Family</TableHead>
                    <TableHead className="px-4 text-left">Members</TableHead>
                    <TableHead className="px-4 text-left">Member Roles</TableHead>
                    <TableHead className="px-4 text-left">Status</TableHead>
                    <TableHead className="sticky right-0 z-10 bg-[#F7F9FC] dark:bg-dark-2 text-center px-4">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(3)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={5}><Skeleton height={60} /></TableCell>
                      </TableRow>
                    ))
                  ) : families.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">
                        No families found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    families.map((f) => (
                      <TableRow
                        key={f.id}
                        className="group hover:bg-gray-2/50 dark:hover:bg-dark-2/50 transition-colors border-b border-stroke dark:border-dark-3 last:border-0"
                      >
                        <TableCell className="px-4 py-3.5">
                          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: "12px",
                                bgcolor: "primary.light",
                                color: "primary.main",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: "bold",
                                fontSize: "1rem",
                              }}
                            >
                              {f.name.charAt(0).toUpperCase()}
                            </Box>
                            <Box>
                              <Typography className="font-bold text-dark dark:text-white text-sm">
                                {f.name}
                              </Typography>
                              <Typography variant="caption" className="text-dark-5">
                                ID: {f.id}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell className="px-4 py-3.5 font-medium text-dark dark:text-white">
                          {f.memberCount} member{f.memberCount !== 1 ? "s" : ""}
                        </TableCell>
                        <TableCell className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1.5 max-w-[420px]">
                            {(f.members || []).slice(0, 6).map((m) => (
                              <Chip
                                key={`${f.id}-${m.uid}`}
                                size="small"
                                label={`${m.fullName || m.username || m.uid.slice(0, 6)} (${m.role})`}
                                className={cn(
                                  "font-semibold",
                                  m.role === "admin"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-gray-100 text-dark-4 dark:bg-dark-2 dark:text-dark-6"
                                )}
                              />
                            ))}
                            {(f.members || []).length > 6 && (
                              <Chip
                                size="small"
                                label={`+${(f.members || []).length - 6} more`}
                                className="font-semibold bg-gray-100 text-dark-4 dark:bg-dark-2 dark:text-dark-6"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3.5">
                          <Chip
                            label={f.status.toUpperCase()}
                            size="small"
                            className={cn(
                              "font-bold",
                              f.status === "active"
                                ? "bg-green/10 text-green"
                                : "bg-danger/10 text-danger"
                            )}
                          />
                        </TableCell>
                        <TableCell className="sticky right-0 z-10 bg-white group-hover:bg-gray-2/5 dark:bg-gray-dark dark:group-hover:bg-dark-2/5 text-center px-4">
                          <Tooltip
                            title={
                              !f.manageable
                                ? "You are not admin of this family"
                                : f.status === "active"
                                  ? "Click to deactivate this family"
                                  : "Click to activate this family"
                            }
                          >
                            <span>
                              <Switch
                                checked={f.status === "active"}
                                onChange={() => handleToggleStatus(f)}
                                disabled={togglingId === f.id || !f.manageable}
                                color="primary"
                                size="small"
                                sx={{
                                  "& .MuiSwitch-switchBase.Mui-checked": { color: "#006BFF" },
                                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                    backgroundColor: "#006BFF",
                                  },
                                }}
                              />
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
