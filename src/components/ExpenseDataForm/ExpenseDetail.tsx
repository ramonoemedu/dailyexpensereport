'use client';

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { columns, dateFields, dropdownFields, sanitizeKey, unsanitizeKey } from "@/utils/KeySanitizer";
import saveAs from "file-saver";

type Props = {
  id: string | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  dropdownOptions?: Record<string, string[]>;
};

const EmployeeDetail: React.FC<Props> = ({ id, open, onClose, onSaved, dropdownOptions = {} }) => {
  const [item, setItem] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id || !open) return;
    const load = async () => {
      try {
        const d = await getDoc(doc(db, "expenses", id));
        if (d.exists()) {
          const raw = d.data();
          const mapped: Record<string, any> = { id: d.id };
          Object.keys(raw).forEach((k) => {
            mapped[unsanitizeKey(k)] = raw[k];
          });
          // Normalize date fields to YYYY-MM-DD strings when possible
          (dateFields || []).forEach((f) => {
            const val = mapped[f];
            if (!val && val !== 0) return;
            // Firestore Timestamp
            if (typeof val === "object" && typeof (val as any).toDate === "function") {
              mapped[f] = dayjs((val as any).toDate()).format("YYYY-MM-DD");
              return;
            }
            // plain string or Date
            const parsed = dayjs(val);
            if (parsed.isValid()) mapped[f] = parsed.format("YYYY-MM-DD");
          });
          setItem(mapped);
        } else {
          setItem(null);
        }
      } catch (err) {
        console.error("Failed to load detail:", err);
        setItem(null);
      }
    };
    load();
  }, [id, open]);

  const handleChange = (key: string, value: any) => {
    setItem((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const handleSave = async () => {
    if (!item || !item.id) return;
    setSaving(true);
    try {
      const sanitized: Record<string, any> = {};
      Object.entries(item).forEach(([k, v]) => {
        if (k === "id") return;
        if ((dateFields || []).includes(k) && v) {
          // handle Dayjs, Date, or Timestamp-like objects
          if (typeof v === "object" && typeof (v as any).toDate === "function") {
            sanitized[sanitizeKey(k)] = dayjs((v as any).toDate()).format("YYYY-MM-DD");
          } else if (dayjs(v).isValid()) {
            sanitized[sanitizeKey(k)] = dayjs(v).format("YYYY-MM-DD");
          } else {
            sanitized[sanitizeKey(k)] = v;
          }
        } else {
          sanitized[sanitizeKey(k)] = v;
        }
      });
      await updateDoc(doc(db, "expenses", item.id), sanitized);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error("Error saving detail:", err);
    } finally {
      setSaving(false);
    }
  };

  const exportToWord = async () => {
    if (!item) return;
    try {
      const PizZip = (await import("pizzip")).default;
      const Docxtemplater = (await import("docxtemplater")).default;
      const response = await fetch("/assets/template.docx");
      const arrayBuffer = await response.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      // @ts-ignore
      const docx = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      const templateData: Record<string, any> = {};
      Object.keys(item).forEach((k) => {
        if (k === "id") return;
        templateData[k.replace(/[^A-Za-z0-9_]/g, "_")] = item[k];
      });
      docx.render(templateData);
      const out = docx.getZip().generate({ type: "blob" });
      saveAs(out, `Detail_${item.id || "export"}.docx`);
    } catch (err) {
      console.error("Word export failed. Make sure docxtemplater/pizzip are installed and /assets/template.docx exists", err);
      alert("Failed to export Word. See console for details.");
    }
  };

  const exportToPDF = async () => {
    if (!item) return;
    try {
      const html = `
        <div style="font-family: Arial; padding: 16px; max-width: 800px;">
          <h2>Detail: ${item["Job"] || item["id"] || ""}</h2>
          <table style="width:100%; border-collapse: collapse;">
            ${columns
          .map((col) => {
            const val = item[col] ?? "";
            return `<tr>
                  <td style="border: 1px solid #ddd; padding:8px; width:30%; font-weight:600;">${col}</td>
                  <td style="border: 1px solid #ddd; padding:8px;">${val}</td>
                </tr>`;
          })
          .join("")}
          </table>
        </div>
      `;
      const jsPDF = (await import("jspdf")).default;
      const html2canvas = (await import("html2canvas")).default;
      const wrapper = document.createElement("div");
      wrapper.style.position = "fixed";
      wrapper.style.left = "-9999px";
      wrapper.innerHTML = html;
      document.body.appendChild(wrapper);
      const canvas = await html2canvas(wrapper, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgProps = (pdf as any).getImageProperties(imgData);
      const imgWidth = pageWidth - 40;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      pdf.addImage(imgData, "PNG", 20, 20, imgWidth, imgHeight);
      pdf.save(`Detail_${item.id || "export"}.pdf`);
      document.body.removeChild(wrapper);
    } catch (err) {
      console.error("PDF export failed. Make sure jspdf/html2canvas are installed", err);
      alert("Failed to export PDF. See console for details.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Detail</DialogTitle>
      <DialogContent dividers>
        {!item ? (
          <Typography>Loading...</Typography>
        ) : (
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                alignItems: "start",
              }}
            >
              {columns.map((col) => {
                const value = item[col] ?? "";
                const options =
                  dropdownOptions[col] ||
                  (dropdownFields && (dropdownFields as any)[col] ? (dropdownFields as any)[col] : undefined);

                if ((dateFields || []).includes(col)) {
                  return (
                    <Box key={col}>
                      <DatePicker
                        label={col}
                        value={value ? dayjs(value) : null}
                        onChange={(d) => handleChange(col, d ? d.format("YYYY-MM-DD") : null)}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                    </Box>
                  );
                }

                if (options) {
                  return (
                    <Box key={col}>
                      <FormControl fullWidth>
                        <InputLabel>{col}</InputLabel>
                        <Select value={value || ""} label={col} onChange={(e) => handleChange(col, e.target.value)}>
                          {options.map((opt: string) => (
                            <MenuItem key={opt} value={opt}>
                              {opt}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  );
                }

                return (
                  <Box key={col}>
                    <TextField
                      label={col}
                      value={value}
                      onChange={(e) => handleChange(col, e.target.value)}
                      fullWidth
                      multiline={col.length > 20 || (typeof value === "string" && value.length > 60)}
                      minRows={1}
                      maxRows={6}
                    />
                  </Box>
                );
              })}
            </Box>
          </LocalizationProvider>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={exportToWord} color="primary" variant="outlined" disabled={!item}>
          Export Word (template)
        </Button>
        <Button onClick={exportToPDF} color="primary" variant="outlined" disabled={!item}>
          Export PDF
        </Button>
        <Button onClick={onClose}>Close</Button>
        <Button onClick={handleSave} variant="contained" color="primary" disabled={!item || saving}>
          {saving ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </span>
          ) : (
            "Save"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmployeeDetail;
