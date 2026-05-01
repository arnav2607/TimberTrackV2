import React, { useEffect, useMemo, useState } from "react";
import { Search, Download, Filter, Package, Container, BarChart3, FileSpreadsheet, ChevronDown, ChevronUp, X, TrendingUp, AlertCircle, Clock, CheckCircle, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import api, { getDashboardKPIs } from "@/lib/api";
import { toast } from "sonner";
import { fmt, fmtInt } from "@/lib/calc";
import { useAuth } from "@/context/AuthContext";
import { exportAllXlsx, exportBLXlsx, exportContainerXlsx, exportDealSheet } from "@/lib/excel";

const STATUS = {
  pending: { text: "Pending", cls: "badge-pending" },
  in_progress: { text: "In Progress", cls: "badge-progress" },
  completed: { text: "Complete", cls: "badge-complete" },
};
function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border-2 ${s.cls}`}>
      {s.text}
    </span>
  );
}

function KpiChip({ label, value, color, testid, icon: Icon }) {
  return (
    <div className={`bg-white rounded-xl border-2 ${color.border} p-4 shadow-sm hover:shadow-md transition-shadow`} data-testid={testid}>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className={`w-5 h-5 ${color.text}`} strokeWidth={2.5} />}
        <span className={`text-xs uppercase tracking-wider font-bold ${color.text}`}>{label}</span>
      </div>
      <div className={`font-mono text-3xl font-bold ${color.text}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ purchases: [], grand_totals: {}, countries: [] });
  const [kpis, setKpis] = useState(null);
  const [filters, setFilters] = useState({ bl_search: "", country: "", supplier: "", date_from: "", date_to: "" });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.bl_search) params.bl_search = filters.bl_search;
      if (filters.country && filters.country !== "ALL") params.country = filters.country;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      const { data } = await api.get("/dashboard/summary", { params });
      setData(data);
      
      // Load enhanced KPIs
      const { data: kpiData } = await getDashboardKPIs();
      setKpis(kpiData);
    } catch (e) {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const grand = data.grand_totals || {};

  // Filter purchases by supplier on frontend
  const filteredPurchases = useMemo(() => {
    if (!filters.supplier || filters.supplier === "ALL") return data.purchases;
    return data.purchases.filter(p => p.supplier_name === filters.supplier);
  }, [data.purchases, filters.supplier]);

  // Get unique suppliers
  const suppliers = useMemo(() => {
    const uniqueSuppliers = [...new Set(data.purchases.map(p => p.supplier_name))];
    return uniqueSuppliers.sort();
  }, [data.purchases]);

  const reset = () => {
    setFilters({ bl_search: "", country: "", supplier: "", date_from: "", date_to: "" });
    setTimeout(load, 50);
  };

  const goToMeasure = (blId, containerId) => {
    navigate('/measurements');
    // Would need to pass state or use URL params to pre-select
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-600 mt-1">Complete reporting & insights across your timber operations.</p>
        </div>
        <Button
          onClick={() => exportAllXlsx(filteredPurchases, user?.company_name)}
          disabled={!filteredPurchases?.length}
          data-testid="export-all-btn"
          className="h-12 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl"
        >
          <FileSpreadsheet className="w-5 h-5 mr-2" /> Download All — Excel
        </Button>
      </div>

      {/* Enhanced 3-Row KPI Section */}
      {kpis && (
        <div className="space-y-4">
          {/* Row 1 — Overview */}
          <div>
            <h2 className="text-sm uppercase tracking-wider font-bold text-slate-600 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" /> Overview
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiChip label="Total BLs" value={fmtInt(kpis.overview.total_bls)} icon={Package}
                color={{ border: "border-slate-300", text: "text-slate-800" }} testid="kpi-total-bls" />
              <KpiChip label="Active BLs" value={fmtInt(kpis.overview.active_bls)} icon={TrendingUp}
                color={{ border: "border-blue-300", text: "text-blue-700" }} testid="kpi-active-bls" />
              <KpiChip label="Completed BLs" value={fmtInt(kpis.overview.completed_bls)} icon={CheckCircle}
                color={{ border: "border-emerald-300", text: "text-emerald-700" }} testid="kpi-completed-bls" />
              <KpiChip label="Total Containers" value={fmtInt(kpis.overview.total_containers)} icon={Container}
                color={{ border: "border-slate-300", text: "text-slate-800" }} testid="kpi-total-containers" />
            </div>
          </div>

          {/* Row 2 — Volume */}
          <div>
            <h2 className="text-sm uppercase tracking-wider font-bold text-slate-600 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Volume Measured
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiChip label="Total Pieces" value={fmtInt(kpis.volume.total_pieces)} icon={BarChart3}
                color={{ border: "border-amber-300", text: "text-amber-700" }} testid="kpi-total-pieces" />
              <KpiChip label="Total CBM1" value={fmt(kpis.volume.total_cbm1)}
                color={{ border: "border-blue-300", text: "text-blue-700" }} testid="kpi-total-cbm1" />
              <KpiChip label="Total CFT1" value={fmt(kpis.volume.total_cft1)}
                color={{ border: "border-blue-300", text: "text-blue-700" }} testid="kpi-total-cft1" />
              <KpiChip label="Total CBM2" value={fmt(kpis.volume.total_cbm2)}
                color={{ border: "border-emerald-300", text: "text-emerald-700" }} testid="kpi-total-cbm2" />
              <KpiChip label="Total CFT2" value={fmt(kpis.volume.total_cft2)}
                color={{ border: "border-emerald-300", text: "text-emerald-700" }} testid="kpi-total-cft2" />
            </div>
          </div>

          {/* Row 3 — Alerts */}
          <div>
            <h2 className="text-sm uppercase tracking-wider font-bold text-slate-600 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Alerts & Status
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiChip label="BLs Not Started" value={fmtInt(kpis.alerts.bls_not_started)} icon={AlertCircle}
                color={{ border: "border-red-300", text: "text-red-700" }} testid="kpi-bls-not-started" />
              <KpiChip label="BLs In Progress" value={fmtInt(kpis.alerts.bls_in_progress)} icon={Clock}
                color={{ border: "border-orange-300", text: "text-orange-600" }} testid="kpi-bls-in-progress" />
              <KpiChip label="Containers Pending" value={fmtInt(kpis.alerts.containers_pending)} icon={Package}
                color={{ border: "border-orange-300", text: "text-orange-600" }} testid="kpi-containers-pending" />
              <KpiChip label="Containers Completed" value={fmtInt(kpis.alerts.containers_completed)} icon={CheckCircle}
                color={{ border: "border-emerald-300", text: "text-emerald-700" }} testid="kpi-containers-completed" />
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Filters */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-slate-600" />
          <span className="text-sm uppercase tracking-wider font-bold text-slate-700">Filters & Search</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              data-testid="filter-bl-search"
              value={filters.bl_search}
              onChange={(e) => setFilters({ ...filters, bl_search: e.target.value })}
              placeholder="Search BL..."
              className="h-12 border-2 pl-9"
            />
          </div>
          <Select value={filters.supplier || "ALL"} onValueChange={(v) => setFilters({ ...filters, supplier: v })}>
            <SelectTrigger data-testid="filter-supplier" className="h-12 border-2">
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.country || "ALL"} onValueChange={(v) => setFilters({ ...filters, country: v })}>
            <SelectTrigger data-testid="filter-country" className="h-12 border-2">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Countries</SelectItem>
              {data.countries?.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            data-testid="filter-date-from"
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            placeholder="From Date"
            className="h-12 border-2"
          />
          <Input
            type="date"
            data-testid="filter-date-to"
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            placeholder="To Date"
            className="h-12 border-2"
          />
        </div>
        <div className="flex gap-2 mt-3">
          <Button onClick={load} data-testid="apply-filters-btn" className="h-11 bg-emerald-700 hover:bg-emerald-800 font-semibold">
            Apply Filters
          </Button>
          <Button variant="outline" onClick={reset} data-testid="reset-filters-btn" className="h-11 border-2">
            <X className="w-4 h-4 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {/* Pending Containers Panel */}
      {kpis && kpis.pending_containers && kpis.pending_containers.length > 0 && (
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-300 p-5">
          <h2 className="text-lg font-bold text-orange-900 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5" /> ⏳ Pending Measurements ({kpis.pending_containers.length} containers)
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {kpis.pending_containers.slice(0, 20).map((c) => (
              <div key={c.container_id} className="bg-white rounded-lg p-4 border border-orange-200 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono font-bold text-lg text-slate-900">{c.container_number}</span>
                    <span className="text-xs text-slate-500">BL: {c.bl_number}</span>
                  </div>
                  <div className="flex gap-4 text-sm text-slate-600">
                    <span><strong>Date:</strong> {c.bl_date}</span>
                    <span><strong>Supplier:</strong> {c.supplier_name}</span>
                    <span><strong>Country:</strong> {c.country}</span>
                    {c.pcs_supplier && <span><strong>PCS:</strong> {c.pcs_supplier}</span>}
                    {c.cbm_gross && <span><strong>CBM Gross:</strong> {c.cbm_gross}</span>}
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/measurements')}
                  className="h-11 bg-orange-600 hover:bg-orange-700 font-semibold"
                >
                  <Ruler className="w-4 h-4 mr-2" /> Start Measuring
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending BLs Panel */}
      {kpis && kpis.pending_bls && kpis.pending_bls.length > 0 && (
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl border-2 border-red-300 p-5">
          <h2 className="text-lg font-bold text-red-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> 📋 BLs Awaiting Action ({kpis.pending_bls.length} BLs)
          </h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {kpis.pending_bls.map((bl) => (
              <div key={bl.purchase_id} className="bg-white rounded-lg p-4 border border-red-200 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono font-bold text-lg text-slate-900">{bl.bl_number}</span>
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">Not Started</span>
                  </div>
                  <div className="flex gap-4 text-sm text-slate-600">
                    <span><strong>Date:</strong> {bl.bl_date}</span>
                    <span><strong>Supplier:</strong> {bl.supplier_name}</span>
                    <span><strong>Country:</strong> {bl.country}</span>
                    <span><strong>Containers:</strong> {bl.total_containers}</span>
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/measurements')}
                  className="h-11 bg-red-600 hover:bg-red-700 font-semibold"
                >
                  <Ruler className="w-4 h-4 mr-2" /> Start Measuring
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Panel */}
      {kpis && kpis.recent_activity && kpis.recent_activity.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-emerald-200 p-5">
          <h2 className="text-lg font-bold text-emerald-900 mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" /> Recent Activity (Last 10 containers measured)
          </h2>
          <div className="space-y-2">
            {kpis.recent_activity.map((activity, idx) => (
              <div key={idx} className="bg-emerald-50 rounded-lg p-3 border border-emerald-200 flex items-center justify-between text-sm">
                <div className="flex gap-4">
                  <span className="font-mono font-bold text-slate-900">{activity.container_number}</span>
                  <span className="text-slate-600">BL: {activity.bl_number}</span>
                  <span className="text-slate-600"><strong>Pieces:</strong> {activity.pieces}</span>
                  <span className="text-slate-600"><strong>CBM2:</strong> {fmt(activity.cbm2)}</span>
                </div>
                <span className="text-xs text-slate-500">{activity.measurement_date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BL grouped list */}
      {loading ? (
        <div className="text-center text-slate-500 py-10">Loading...</div>
      ) : filteredPurchases.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-10 text-center">
          <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="font-bold text-lg text-slate-800">No data yet</h3>
          <p className="text-slate-500 mt-1">Add purchases and measurements to populate the dashboard.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPurchases.map((p) => {
            const isOpen = !!expanded[p.id];
            const t = p.totals || {};
            return (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid={`bl-card-${p.bl_number}`}>
                <div className="p-4 sm:p-5 flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-lg font-bold">{p.bl_number}</span>
                      <span className="text-slate-500 text-sm">·</span>
                      <span className="text-sm text-slate-700 truncate">{p.supplier_name}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 font-mono">{p.country}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs font-mono text-slate-600">{p.bl_date}</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-3">
                      {[
                        { l: "Pcs", v: fmtInt(t.pieces), c: "text-amber-700" },
                        { l: "CBM1", v: fmt(t.cbm1), c: "text-blue-700" },
                        { l: "CFT1", v: fmt(t.cft1), c: "text-blue-700" },
                        { l: "CBM2", v: fmt(t.cbm2), c: "text-emerald-700" },
                        { l: "CFT2", v: fmt(t.cft2), c: "text-emerald-700" },
                      ].map((x) => (
                        <div key={x.l}>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{x.l}</div>
                          <div className={`font-mono font-bold ${x.c}`}>{x.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportBLXlsx(p, user?.company_name)}
                      className="h-10 border-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                      data-testid={`export-bl-${p.bl_number}`}
                    >
                      <FileSpreadsheet className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">BL Summary</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportDealSheet(p, user?.company_name)}
                      className="h-10 border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      data-testid={`export-deal-${p.bl_number}`}
                    >
                      <BarChart3 className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Deal Sheet</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpanded({ ...expanded, [p.id]: !isOpen })}
                      data-testid={`toggle-bl-${p.bl_number}`}
                      className="h-10"
                    >
                      {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-3 sm:p-4 space-y-2">
                    {(p.containers || []).map((c) => {
                      const ct = c.totals || {};
                      return (
                        <div key={c.id} className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 flex items-center justify-between gap-3 flex-wrap" data-testid={`container-row-${c.container_number}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center font-mono font-bold text-sm">
                              #{c.sr_no}
                            </div>
                            <div className="min-w-0">
                              <div className="font-mono font-bold text-base truncate">{c.container_number}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <StatusBadge status={c.status} />
                                <span className="text-xs text-slate-500 font-mono">{c.pieces || 0} pcs</span>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs flex-1 min-w-0">
                            <div><div className="text-[10px] uppercase text-slate-500 font-bold">CBM1</div><div className="font-mono text-blue-700 font-bold">{fmt(ct.cbm1)}</div></div>
                            <div><div className="text-[10px] uppercase text-slate-500 font-bold">CFT1</div><div className="font-mono text-blue-700 font-bold">{fmt(ct.cft1)}</div></div>
                            <div><div className="text-[10px] uppercase text-slate-500 font-bold">CBM2</div><div className="font-mono text-emerald-700 font-bold">{fmt(ct.cbm2)}</div></div>
                            <div><div className="text-[10px] uppercase text-slate-500 font-bold">CFT2</div><div className="font-mono text-emerald-700 font-bold">{fmt(ct.cft2)}</div></div>
                            <div><div className="text-[10px] uppercase text-slate-500 font-bold">Avg G1/G2</div><div className="font-mono font-bold">{fmt(ct.avg_g1, 1)} / {fmt(ct.avg_g2, 1)}</div></div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => exportContainerXlsx(p, c, user?.company_name)}
                            className="h-9"
                            data-testid={`export-container-${c.container_number}`}
                          >
                            <Download className="w-4 h-4 mr-1" /> Excel
                          </Button>
                        </div>
                      );
                    })}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2 grid grid-cols-3 sm:grid-cols-6 gap-3">
                      <div className="col-span-3 sm:col-span-1 text-amber-800 font-bold uppercase text-xs tracking-wider">BL Subtotal</div>
                      <div><div className="text-[10px] uppercase text-amber-800 font-bold">Pcs</div><div className="font-mono font-bold text-amber-900">{fmtInt(t.pieces)}</div></div>
                      <div><div className="text-[10px] uppercase text-amber-800 font-bold">CBM1</div><div className="font-mono font-bold text-amber-900">{fmt(t.cbm1)}</div></div>
                      <div><div className="text-[10px] uppercase text-amber-800 font-bold">CFT1</div><div className="font-mono font-bold text-amber-900">{fmt(t.cft1)}</div></div>
                      <div><div className="text-[10px] uppercase text-amber-800 font-bold">CBM2</div><div className="font-mono font-bold text-amber-900">{fmt(t.cbm2)}</div></div>
                      <div><div className="text-[10px] uppercase text-amber-800 font-bold">CFT2</div><div className="font-mono font-bold text-amber-900">{fmt(t.cft2)}</div></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Grand totals */}
          <div className="bg-emerald-900 text-white rounded-xl p-4 sm:p-5 grid grid-cols-3 sm:grid-cols-6 gap-3 shadow-md">
            <div className="col-span-3 sm:col-span-1 font-bold uppercase text-xs tracking-wider text-emerald-200">Grand Total</div>
            <div><div className="text-[10px] uppercase text-emerald-200 font-bold">Pcs</div><div className="font-mono font-bold">{fmtInt(grand.pieces)}</div></div>
            <div><div className="text-[10px] uppercase text-emerald-200 font-bold">CBM1</div><div className="font-mono font-bold">{fmt(grand.cbm1)}</div></div>
            <div><div className="text-[10px] uppercase text-emerald-200 font-bold">CFT1</div><div className="font-mono font-bold">{fmt(grand.cft1)}</div></div>
            <div><div className="text-[10px] uppercase text-emerald-200 font-bold">CBM2</div><div className="font-mono font-bold">{fmt(grand.cbm2)}</div></div>
            <div><div className="text-[10px] uppercase text-emerald-200 font-bold">CFT2</div><div className="font-mono font-bold">{fmt(grand.cft2)}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}
