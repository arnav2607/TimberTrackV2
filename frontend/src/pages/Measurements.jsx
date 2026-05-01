import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, CheckCircle2, Save, AlertTriangle, Ruler, Package, Container, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import api, { formatErr, updateContainerCompletionForm } from "@/lib/api";
import { toast } from "sonner";
import { calcLog, fmt, fmtInt } from "@/lib/calc";

const STATUS_LABEL = {
  pending: { text: "Pending", cls: "badge-pending" },
  in_progress: { text: "In Progress", cls: "badge-progress" },
  completed: { text: "Complete", cls: "badge-complete" },
};

function StatusBadge({ status }) {
  const s = STATUS_LABEL[status] || STATUS_LABEL.pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border-2 ${s.cls}`}>
      {s.text}
    </span>
  );
}

const blank = () => ({ le1: "", l: "", g1: "", g2: "" });

// Completion Form Modal
function CompletionFormModal({ open, onOpenChange, container, onSaved }) {
  const [form, setForm] = useState({
    bend_percent: "",
    quality_by_us: "",
    measurement_date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.bend_percent && !form.quality_by_us && !form.measurement_date) {
      toast.error("Please fill at least one field");
      return;
    }
    setSaving(true);
    try {
      await updateContainerCompletionForm(container.id, {
        bend_percent: form.bend_percent ? parseFloat(form.bend_percent) : null,
        quality_by_us: form.quality_by_us.trim() || null,
        measurement_date: form.measurement_date || null,
      });
      toast.success("Container marked complete with completion data");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(formatErr(e?.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Complete Container</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Bend % (Optional)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.bend_percent}
              onChange={(e) => setForm({ ...form, bend_percent: e.target.value })}
              placeholder="e.g. 5.5"
              className="h-11 border-2"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Quality by Us (Optional)</Label>
            <Input
              value={form.quality_by_us}
              onChange={(e) => setForm({ ...form, quality_by_us: e.target.value })}
              placeholder="e.g. Good, Average, Rejected"
              className="h-11 border-2"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Measurement Date</Label>
            <Input
              type="date"
              value={form.measurement_date}
              onChange={(e) => setForm({ ...form, measurement_date: e.target.value })}
              className="h-11 border-2"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2">
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">
            {saving ? "Saving..." : "Mark Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Measurements() {
  const [purchases, setPurchases] = useState([]);
  const [selectedBl, setSelectedBl] = useState("");
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [containerData, setContainerData] = useState(null); // {purchase, measurements,...}
  const [logs, setLogs] = useState([blank()]);
  const [markComplete, setMarkComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingContainer, setLoadingContainer] = useState(false);
  const [showCompletionForm, setShowCompletionForm] = useState(false);

  useEffect(() => {
    api.get("/purchases").then((r) => setPurchases(r.data)).catch(() => {});
  }, []);

  const blOptions = purchases;
  const currentBl = useMemo(() => blOptions.find((p) => p.id === selectedBl), [blOptions, selectedBl]);
  const containers = currentBl?.containers || [];

  const loadContainer = async (containerId) => {
    setLoadingContainer(true);
    try {
      const { data } = await api.get(`/containers/${containerId}`);
      setContainerData(data);
      setMarkComplete(!!data.is_loading_complete);
      setLogs([blank()]);
    } catch (e) {
      toast.error("Failed to load container");
    } finally {
      setLoadingContainer(false);
    }
  };

  const onSelectContainer = (c) => {
    setSelectedContainer(c);
    loadContainer(c.id);
  };

  // Live totals (existing saved + draft)
  const drafts = useMemo(() =>
    logs.map((m) => ({ ...m, ...calcLog(m.le1, m.l, m.g1, m.g2) })),
    [logs]
  );
  const drafts_filled = drafts.filter((d) => d.le1 || d.l || d.g1 || d.g2);
  const saved = containerData?.measurements || [];
  const allRows = [...saved, ...drafts_filled];

  const totals = useMemo(() => {
    const t = { pieces: allRows.length, cbm1: 0, cft1: 0, cbm2: 0, cft2: 0, sum_g1: 0, sum_g2: 0, sum_le1: 0, sum_l: 0 };
    allRows.forEach((r) => {
      t.cbm1 += +r.cbm1 || 0;
      t.cft1 += +r.cft1 || 0;
      t.cbm2 += +r.cbm2 || 0;
      t.cft2 += +r.cft2 || 0;
      t.sum_g1 += +r.g1 || 0;
      t.sum_g2 += +r.g2 || 0;
      t.sum_le1 += +r.le1 || 0;
      t.sum_l += +r.l || 0;
    });
    const n = Math.max(t.pieces, 1);
    return {
      ...t,
      avg_cbm1: t.cbm1 / n, avg_cbm2: t.cbm2 / n,
      avg_g1: t.sum_g1 / n, avg_g2: t.sum_g2 / n,
      avg_le1: t.sum_le1 / n, avg_l: t.sum_l / n,
    };
  }, [allRows]);

  const updateLog = (idx, key, val) => {
    setLogs((arr) => arr.map((m, i) => (i === idx ? { ...m, [key]: val } : m)));
  };

  const addLogs = (n) => setLogs((arr) => [...arr, ...Array.from({ length: n }, blank)]);

  const removeLog = (idx) => setLogs((arr) => (arr.length === 1 ? [blank()] : arr.filter((_, i) => i !== idx)));

  const clearAllDrafts = () => setLogs([blank()]);

  const save = async () => {
    if (!containerData) return;
    const filled = logs
      .filter((m) => m.le1 || m.l || m.g1 || m.g2)
      .map((m) => ({ le1: +m.le1 || 0, l: +m.l || 0, g1: +m.g1 || 0, g2: +m.g2 || 0 }));
    if (filled.length === 0 && !markComplete) {
      return toast.error("Add at least one log or mark complete");
    }
    // Validate non-zero
    for (const m of filled) {
      if (m.le1 <= 0 || m.l <= 0 || m.g1 <= 0 || m.g2 <= 0) {
        return toast.error("All measurements must be > 0");
      }
    }
    setSaving(true);
    try {
      await api.post(`/containers/${containerData.id}/measurements`, {
        measurements: filled,
        mark_complete: markComplete,
      });
      toast.success(`Saved ${filled.length} log(s)${markComplete ? " · Container marked complete" : ""}`);
      // refresh
      await loadContainer(containerData.id);
      // refresh purchases for status updates
      const r = await api.get("/purchases");
      setPurchases(r.data);
    } catch (e) {
      toast.error(formatErr(e?.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const clearAllSaved = async () => {
    if (!containerData) return;
    try {
      await api.delete(`/containers/${containerData.id}/measurements`);
      toast.success("All logs cleared");
      await loadContainer(containerData.id);
      const r = await api.get("/purchases");
      setPurchases(r.data);
    } catch (e) {
      toast.error("Failed to clear");
    }
  };

  return (
    <div className="space-y-6 pb-32 md:pb-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Measure</h1>
        <p className="text-slate-600 mt-1">Record each log's dimensions.</p>
      </div>

      {/* Step 1 — BL Select */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-3">
        <Label className="text-sm uppercase tracking-wider font-semibold text-slate-700">
          Step 1 · Select BL Number
        </Label>
        <Select
          value={selectedBl}
          onValueChange={(v) => {
            setSelectedBl(v);
            setSelectedContainer(null);
            setContainerData(null);
          }}
        >
          <SelectTrigger
            data-testid="bl-select"
            className="h-14 border-2 text-base font-mono"
          >
            <SelectValue placeholder="Choose a BL Number..." />
          </SelectTrigger>
          <SelectContent>
            {blOptions.map((p) => (
              <SelectItem key={p.id} value={p.id} data-testid={`bl-option-${p.bl_number}`}>
                <span className="font-mono font-bold">{p.bl_number}</span>
                <span className="text-slate-500 ml-2">— {p.supplier_name}</span>
              </SelectItem>
            ))}
            {blOptions.length === 0 && (
              <div className="p-3 text-sm text-slate-500">No BLs yet. Create one in Purchases.</div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Step 2 — Container select */}
      {currentBl && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-3">
          <Label className="text-sm uppercase tracking-wider font-semibold text-slate-700">
            Step 2 · Select Container
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {containers.map((c) => {
              const active = selectedContainer?.id === c.id;
              const statusColors = {
                pending: { bg: "bg-white", border: "border-slate-200", icon: "bg-slate-400" },
                in_progress: { bg: "bg-orange-50", border: "border-orange-300", icon: "bg-orange-500" },
                completed: { bg: "bg-emerald-50", border: "border-emerald-300", icon: "bg-emerald-600" },
              };
              const colors = statusColors[c.status] || statusColors.pending;
              
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => onSelectContainer(c)}
                  data-testid={`container-btn-${c.container_number}`}
                  className={`text-left p-4 rounded-xl border-2 transition ${
                    active
                      ? "border-[#064E3B] bg-emerald-50 shadow-md"
                      : `${colors.border} ${colors.bg} hover:border-slate-400 hover:shadow-sm`
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${colors.icon}`} />
                      <div className="text-xs font-mono text-slate-500">#{c.sr_no}</div>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="font-mono text-base font-bold mb-1">{c.container_number}</div>
                  <div className="text-xs text-slate-500 font-mono">
                    {c.log_count || 0} logs measured
                    {c.status === "completed" && " ✓"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3+ — info banner + log feed */}
      {containerData && (
        <>
          {/* Enhanced info banner with purchased values */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <div><div className="text-xs uppercase text-emerald-800/70 font-bold tracking-wider">BL</div><div className="font-mono font-bold text-emerald-900">{containerData.purchase?.bl_number}</div></div>
              <div><div className="text-xs uppercase text-emerald-800/70 font-bold tracking-wider">Container</div><div className="font-mono font-bold text-emerald-900">{containerData.container_number}</div></div>
              <div><div className="text-xs uppercase text-emerald-800/70 font-bold tracking-wider">Supplier</div><div className="font-semibold text-emerald-900 truncate">{containerData.purchase?.supplier_name}</div></div>
              <div><div className="text-xs uppercase text-emerald-800/70 font-bold tracking-wider">Country</div><div className="font-semibold text-emerald-900">{containerData.purchase?.country}</div></div>
              <div><div className="text-xs uppercase text-emerald-800/70 font-bold tracking-wider">Date</div><div className="font-mono font-bold text-emerald-900">{containerData.purchase?.bl_date}</div></div>
            </div>
            
            {/* Purchased values for reference */}
            {(containerData.cbm_gross || containerData.cbm_net || containerData.pcs_supplier) && (
              <div className="border-t border-emerald-300 pt-3">
                <div className="text-xs uppercase text-emerald-800/70 font-bold tracking-wider mb-2">Supplier Declared Values (for reference)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {containerData.cbm_gross && (
                    <div className="bg-white/60 rounded-lg p-2 border border-emerald-200">
                      <div className="text-[10px] uppercase text-emerald-700 font-bold">CBM Gross</div>
                      <div className="font-mono font-bold text-emerald-900">{containerData.cbm_gross}</div>
                    </div>
                  )}
                  {containerData.cbm_net && (
                    <div className="bg-white/60 rounded-lg p-2 border border-emerald-200">
                      <div className="text-[10px] uppercase text-emerald-700 font-bold">CBM Net</div>
                      <div className="font-mono font-bold text-emerald-900">{containerData.cbm_net}</div>
                    </div>
                  )}
                  {containerData.pcs_supplier && (
                    <div className="bg-white/60 rounded-lg p-2 border border-emerald-200">
                      <div className="text-[10px] uppercase text-emerald-700 font-bold">PCS Supplier</div>
                      <div className="font-mono font-bold text-emerald-900">{containerData.pcs_supplier}</div>
                    </div>
                  )}
                  {containerData.quality_supplier && (
                    <div className="bg-white/60 rounded-lg p-2 border border-emerald-200">
                      <div className="text-[10px] uppercase text-emerald-700 font-bold">Quality</div>
                      <div className="font-semibold text-emerald-900">{containerData.quality_supplier}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Live progress comparison */}
            {containerData.pcs_supplier && (
              <div className="border-t border-emerald-300 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase text-emerald-800/70 font-bold tracking-wider">Measurement Progress</div>
                  <div className="font-mono text-sm font-bold text-emerald-900">
                    {totals.pieces} / {containerData.pcs_supplier} pieces
                  </div>
                </div>
                <Progress 
                  value={(totals.pieces / containerData.pcs_supplier) * 100} 
                  className="h-3 bg-emerald-200"
                />
              </div>
            )}
          </div>

          {/* Live totals bar */}
          <div className="bg-white rounded-xl border-2 border-amber-200 overflow-hidden shadow-sm sticky top-16 z-20">
            <div className="bg-amber-50 px-4 py-2 border-b border-amber-200">
              <span className="text-xs uppercase tracking-wider font-bold text-amber-800">Live Running Totals</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-0 divide-x divide-slate-100">
              {[
                { label: "Pieces", val: fmtInt(totals.pieces), color: "text-amber-700", testid: "total-pieces" },
                { label: "CBM1", val: fmt(totals.cbm1), color: "text-blue-700", testid: "total-cbm1" },
                { label: "CFT1", val: fmt(totals.cft1), color: "text-blue-700", testid: "total-cft1" },
                { label: "CBM2", val: fmt(totals.cbm2), color: "text-emerald-700", testid: "total-cbm2" },
                { label: "CFT2", val: fmt(totals.cft2), color: "text-emerald-700", testid: "total-cft2" },
                { label: "Avg CBM1", val: fmt(totals.avg_cbm1), color: "text-blue-700", testid: "avg-cbm1" },
                { label: "Avg CBM2", val: fmt(totals.avg_cbm2), color: "text-emerald-700", testid: "avg-cbm2" },
              ].map((t) => (
                <div key={t.label} className="px-3 py-2.5 text-center" data-testid={t.testid}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{t.label}</div>
                  <div className={`font-mono text-base sm:text-lg font-bold ${t.color}`}>{t.val}</div>
                </div>
              ))}
            </div>
            <div className="hidden sm:grid grid-cols-4 gap-0 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/40">
              {[
                { label: "Avg G1", val: fmt(totals.avg_g1, 2), testid: "avg-g1" },
                { label: "Avg G2", val: fmt(totals.avg_g2, 2), testid: "avg-g2" },
                { label: "Avg LE1", val: fmt(totals.avg_le1, 2), testid: "avg-le1" },
                { label: "Avg L", val: fmt(totals.avg_l, 2), testid: "avg-l" },
              ].map((t) => (
                <div key={t.label} className="px-3 py-2 text-center" data-testid={t.testid}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{t.label}</div>
                  <div className="font-mono text-sm font-bold text-slate-700">{t.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Saved logs (collapsed summary) */}
          {saved.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-mono font-bold text-emerald-800">{saved.length}</span>{" "}
                <span className="text-slate-600">logs already saved.</span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 border-2 text-rose-600 border-rose-200 hover:bg-rose-50" data-testid="clear-saved-btn">
                    <Trash2 className="w-4 h-4 mr-1" /> Clear
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all logs?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete every saved log measurement for this container. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={clearAllSaved} data-testid="confirm-clear-saved">
                      Yes, clear all
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {/* Log entry cards */}
          <div className="space-y-3" data-testid="log-cards">
            {logs.map((m, idx) => {
              const c = calcLog(m.le1, m.l, m.g1, m.g2);
              const warnG1 = +m.g1 > 0 && +m.g1 < 35;
              const warnG2 = +m.g2 > 0 && +m.g2 < 35;
              return (
                <div
                  key={idx}
                  className={`bg-white rounded-xl border-2 ${warnG1 || warnG2 ? "border-orange-300" : "border-slate-200"} p-4`}
                  data-testid={`log-card-${idx}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-md bg-emerald-50 text-emerald-800 flex items-center justify-center font-mono font-bold text-sm">
                        {saved.length + idx + 1}
                      </div>
                      <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Log Entry</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeLog(idx)} data-testid={`remove-log-${idx}`}>
                      <Trash2 className="w-4 h-4 text-rose-600" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { k: "le1", label: "LE1 (cm)", placeholder: "260", warn: false },
                      { k: "l", label: "L (cm)", placeholder: "270", warn: false },
                      { k: "g1", label: "G1 (cm)", placeholder: "55", warn: warnG1 },
                      { k: "g2", label: "G2 (cm)", placeholder: "60", warn: warnG2 },
                    ].map((f) => (
                      <div key={f.k} className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider font-bold text-slate-600">{f.label}</Label>
                        <Input
                          inputMode="decimal"
                          type="number"
                          step="0.01"
                          value={m[f.k]}
                          onChange={(e) => updateLog(idx, f.k, e.target.value)}
                          placeholder={f.placeholder}
                          data-testid={`log-${idx}-${f.k}`}
                          className={`h-14 border-2 text-2xl font-mono text-center ${f.warn ? "warn-input" : "border-slate-300"}`}
                        />
                      </div>
                    ))}
                  </div>

                  {(warnG1 || warnG2) && (
                    <div className="mt-3 flex items-center gap-2 text-orange-700 text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      Girth below 35 cm — please verify.
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-blue-50 px-3 py-2 border border-blue-100">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-blue-700">CBM1 / CFT1</div>
                      <div className="font-mono font-bold text-blue-800 text-base">{fmt(c.cbm1)} m³ <span className="text-blue-500 font-normal mx-1">·</span> {fmt(c.cft1)} ft³</div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-3 py-2 border border-emerald-100">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">CBM2 / CFT2</div>
                      <div className="font-mono font-bold text-emerald-800 text-base">{fmt(c.cbm2)} m³ <span className="text-emerald-500 font-normal mx-1">·</span> {fmt(c.cft2)} ft³</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={() => addLogs(1)}
              data-testid="add-log-btn"
              className="h-14 border-2 font-bold text-base"
            >
              <Plus className="w-5 h-5 mr-1" strokeWidth={3} /> Add Log
            </Button>
            <Button
              variant="outline"
              onClick={() => addLogs(5)}
              data-testid="add-5-logs-btn"
              className="h-14 border-2 font-bold text-base"
            >
              <Plus className="w-5 h-5 mr-1" strokeWidth={3} /> Add 5 Logs
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" data-testid="clear-drafts-btn" className="h-14 border-2 text-rose-600 border-rose-200 font-bold text-base col-span-2 sm:col-span-1">
                  <Trash2 className="w-5 h-5 mr-1" /> Clear Drafts
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear unsaved drafts?</AlertDialogTitle>
                  <AlertDialogDescription>This will reset the entry cards above. Saved logs are kept.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllDrafts} data-testid="confirm-clear-drafts">Clear</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Mark complete + save */}
          <div className="bg-white rounded-xl border-2 border-emerald-200 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Switch
                  checked={markComplete}
                  onCheckedChange={(checked) => {
                    setMarkComplete(checked);
                    if (checked) {
                      // Auto-open completion form when toggled ON
                      setShowCompletionForm(true);
                    }
                  }}
                  data-testid="mark-complete-switch"
                  className="data-[state=checked]:bg-[#064E3B]"
                />
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                    Mark Container as COMPLETE
                  </div>
                  <div className="text-sm text-slate-500">Toggle ON to open completion form with details (Bend %, Quality, Date)</div>
                </div>
              </div>
              <Button
                onClick={save}
                disabled={saving || loadingContainer}
                data-testid="save-measurements-btn"
                className="h-14 px-6 bg-[#064E3B] hover:bg-[#047857] font-bold text-base rounded-xl"
              >
                <Save className="w-5 h-5 mr-2" />
                {saving ? "Saving..." : "Save Measurements"}
              </Button>
            </div>
          </div>
          
          {/* Completion Form Modal */}
          <CompletionFormModal
            open={showCompletionForm}
            onOpenChange={(isOpen) => {
              setShowCompletionForm(isOpen);
              // If user closes modal without saving, turn off the toggle
              if (!isOpen) {
                setMarkComplete(false);
              }
            }}
            container={containerData}
            onSaved={async () => {
              await loadContainer(containerData.id);
              const r = await api.get("/purchases");
              setPurchases(r.data);
            }}
          />
        </>
      )}
    </div>
  );
}
