import React, { useEffect, useState } from "react";
import { Plus, Package, Pencil, Trash2, X, ChevronRight, Calendar, Building2, Globe2, FileText, Container, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import api, { formatErr, getSuppliers, createSupplier, getCountries, createCountry, seedCountries } from "@/lib/api";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const STATUS_LABEL = {
  pending: { text: "Pending", cls: "badge-pending", dot: "bg-slate-400" },
  in_progress: { text: "In Progress", cls: "badge-progress", dot: "bg-blue-500" },
  completed: { text: "Complete", cls: "badge-complete", dot: "bg-emerald-600" },
};

function StatusBadge({ status }) {
  const s = STATUS_LABEL[status] || STATUS_LABEL.pending;
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider border-2 ${s.cls}`}
      data-testid={`status-${status}`}
    >
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {s.text}
    </span>
  );
}

const todayISO = () => new Date().toISOString().slice(0, 10);

// Helper to calculate avg girth
const calcAvgGirth = (cbm, pcs) => {
  if (!cbm || !pcs || pcs === 0) return null;
  return ((cbm * 35.315) / pcs).toFixed(4);
};

// Container Card Component
function ContainerCard({ container, index, onUpdate, onRemove, isExisting }) {
  const [isOpen, setIsOpen] = useState(true);
  
  const updateField = (field, value) => {
    onUpdate(index, { ...container, [field]: value });
  };

  const avgGirthGross = calcAvgGirth(container.cbm_gross, container.pcs_supplier);
  const avgGirthNet = calcAvgGirth(container.cbm_net, container.pcs_supplier);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-2 rounded-lg mb-3">
      <div className="bg-slate-50 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-md ${isExisting ? 'bg-slate-200' : 'bg-emerald-100'} flex items-center justify-center font-mono font-bold`}>
            {container.sr_no || index + 1}
          </div>
          <div>
            <div className="font-mono font-bold text-base">
              {container.container_number || <span className="text-slate-400">New Container</span>}
            </div>
            {container.cbm_gross && (
              <div className="text-xs text-slate-600">
                CBM Gross: {container.cbm_gross} | PCS: {container.pcs_supplier}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isExisting && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
              className="h-8 w-8"
            >
              <X className="w-4 h-4 text-rose-600" />
            </Button>
          )}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>
      
      <CollapsibleContent>
        <div className="p-4 space-y-4 bg-white">
          {/* Container Number */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider font-semibold">Container Number *</Label>
            <Input
              value={container.container_number || ""}
              onChange={(e) => updateField("container_number", e.target.value)}
              placeholder="MSCU1234567"
              disabled={isExisting}
              className="h-11 border-2 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* CBM Gross */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-semibold">CBM Gross *</Label>
              <Input
                type="number"
                step="0.01"
                value={container.cbm_gross || ""}
                onChange={(e) => updateField("cbm_gross", parseFloat(e.target.value) || null)}
                placeholder="0.00"
                disabled={isExisting}
                className="h-11 border-2"
              />
            </div>

            {/* CBM Net */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-semibold">CBM Net *</Label>
              <Input
                type="number"
                step="0.01"
                value={container.cbm_net || ""}
                onChange={(e) => updateField("cbm_net", parseFloat(e.target.value) || null)}
                placeholder="0.00"
                disabled={isExisting}
                className="h-11 border-2"
              />
            </div>

            {/* PCS Supplier */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-semibold">PCS Supplier *</Label>
              <Input
                type="number"
                value={container.pcs_supplier || ""}
                onChange={(e) => updateField("pcs_supplier", parseInt(e.target.value) || null)}
                placeholder="0"
                disabled={isExisting}
                className="h-11 border-2"
              />
            </div>

            {/* L Avg */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-semibold">L Avg (Optional)</Label>
              <Input
                type="number"
                step="0.01"
                value={container.l_avg || ""}
                onChange={(e) => updateField("l_avg", parseFloat(e.target.value) || null)}
                placeholder="0.00"
                disabled={isExisting}
                className="h-11 border-2"
              />
            </div>
          </div>

          {/* Quality by Supplier */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider font-semibold">Quality by Supplier (Optional)</Label>
            <Input
              value={container.quality_supplier || ""}
              onChange={(e) => updateField("quality_supplier", e.target.value)}
              placeholder="e.g. Grade A, N5V"
              disabled={isExisting}
              className="h-11 border-2"
            />
          </div>

          {/* Auto-calculated Avg Girth chips */}
          {avgGirthGross && avgGirthNet && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge className="bg-green-100 text-green-800 text-sm px-3 py-1.5 font-mono">
                Avg Girth Gross: {avgGirthGross}
              </Badge>
              <Badge className="bg-blue-100 text-blue-800 text-sm px-3 py-1.5 font-mono">
                Avg Girth Net: {avgGirthNet}
              </Badge>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PurchaseDialog({ open, onOpenChange, editing, onSaved }) {
  const [form, setForm] = useState({
    bl_number: "", bl_date: todayISO(), supplier_name: "",
    country: "", remarks: "",
  });
  const [containers, setContainers] = useState([{ container_number: "", cbm_gross: null, cbm_net: null, pcs_supplier: null, l_avg: null, quality_supplier: "" }]);
  const [newContainers, setNewContainers] = useState([]);
  const [saving, setSaving] = useState(false);
  
  // Supplier & Country management
  const [suppliers, setSuppliers] = useState([]);
  const [countries, setCountries] = useState([]);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showAddCountry, setShowAddCountry] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newCountryName, setNewCountryName] = useState("");
  
  const isEdit = !!editing;

  // Load suppliers and countries
  useEffect(() => {
    if (open) {
      loadSuppliers();
      loadCountries();
    }
  }, [open]);

  const loadSuppliers = async () => {
    try {
      const { data } = await getSuppliers();
      setSuppliers(data);
    } catch (e) {
      console.error("Failed to load suppliers", e);
    }
  };

  const loadCountries = async () => {
    try {
      const { data } = await getCountries();
      if (data.length === 0) {
        // Seed countries for first-time users
        await seedCountries();
        const { data: seeded } = await getCountries();
        setCountries(seeded);
      } else {
        setCountries(data);
      }
    } catch (e) {
      console.error("Failed to load countries", e);
    }
  };

  const handleAddSupplier = async () => {
    const trimmed = newSupplierName.trim();
    if (!trimmed) {
      toast.error("Supplier name required");
      return;
    }
    try {
      const { data } = await createSupplier(trimmed);
      setSuppliers([...suppliers, data]);
      setForm({ ...form, supplier_name: data.name });
      setNewSupplierName("");
      setShowAddSupplier(false);
      toast.success("Supplier added");
    } catch (e) {
      toast.error("Failed to add supplier");
    }
  };

  const handleAddCountry = async () => {
    const trimmed = newCountryName.trim();
    if (!trimmed) {
      toast.error("Country name required");
      return;
    }
    try {
      const { data } = await createCountry(trimmed);
      setCountries([...countries, data]);
      setForm({ ...form, country: data.name });
      setNewCountryName("");
      setShowAddCountry(false);
      toast.success("Country added");
    } catch (e) {
      toast.error("Failed to add country");
    }
  };

  useEffect(() => {
    if (editing) {
      setForm({
        bl_number: editing.bl_number || "",
        bl_date: editing.bl_date || todayISO(),
        supplier_name: editing.supplier_name || "",
        country: editing.country || "",
        remarks: editing.remarks || "",
      });
      setContainers(editing.containers || []);
      setNewContainers([]);
    } else if (open) {
      setForm({ bl_number: "", bl_date: todayISO(), supplier_name: "", country: "", remarks: "" });
      setContainers([{ container_number: "", cbm_gross: null, cbm_net: null, pcs_supplier: null, l_avg: null, quality_supplier: "" }]);
      setNewContainers([]);
    }
  }, [editing, open]);

  const updateContainer = (idx, updatedContainer, isNew = false) => {
    if (isNew) {
      setNewContainers((arr) => arr.map((c, i) => (i === idx ? updatedContainer : c)));
    } else {
      setContainers((arr) => arr.map((c, i) => (i === idx ? updatedContainer : c)));
    }
  };

  const removeContainer = (idx, isNew = false) => {
    if (isNew) {
      setNewContainers(newContainers.filter((_, i) => i !== idx));
    } else {
      if (containers.length > 1) {
        setContainers(containers.filter((_, i) => i !== idx));
      }
    }
  };

  const addNewContainer = () => {
    const newC = { container_number: "", cbm_gross: null, cbm_net: null, pcs_supplier: null, l_avg: null, quality_supplier: "" };
    if (isEdit) {
      setNewContainers([...newContainers, newC]);
    } else {
      setContainers([...containers, newC]);
    }
  };

  const submit = async () => {
    if (!form.bl_number.trim()) return toast.error("BL Number required");
    if (!form.bl_date) return toast.error("BL Date required");
    if (!form.supplier_name.trim()) return toast.error("Supplier required");
    if (!form.country.trim()) return toast.error("Country required");
    
    setSaving(true);
    try {
      if (isEdit) {
        const cleanNew = newContainers.filter((c) => c.container_number.trim()).map((c) => ({
          container_number: c.container_number.trim(),
          cbm_gross: c.cbm_gross,
          cbm_net: c.cbm_net,
          pcs_supplier: c.pcs_supplier,
          l_avg: c.l_avg,
          quality_supplier: c.quality_supplier,
        }));
        await api.patch(`/purchases/${editing.id}`, { ...form, new_containers: cleanNew });
      } else {
        const cleanContainers = containers.filter((c) => c.container_number.trim()).map((c) => ({
          container_number: c.container_number.trim(),
          cbm_gross: c.cbm_gross,
          cbm_net: c.cbm_net,
          pcs_supplier: c.pcs_supplier,
          l_avg: c.l_avg,
          quality_supplier: c.quality_supplier,
        }));
        if (cleanContainers.length === 0) return toast.error("At least one container required");
        await api.post("/purchases", { ...form, containers: cleanContainers });
      }
      toast.success(isEdit ? "Purchase updated" : "Purchase saved");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(formatErr(e?.response?.data?.detail) || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        data-testid="purchase-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">{isEdit ? "Edit Purchase" : "New Purchase (BL)"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm uppercase tracking-wider font-semibold">BL Number</Label>
              <Input
                data-testid="bl-number-input"
                value={form.bl_number}
                onChange={(e) => setForm({ ...form, bl_number: e.target.value })}
                placeholder="MSCU-2025-001"
                className="h-12 border-2 text-base font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm uppercase tracking-wider font-semibold">BL Date</Label>
              <Input
                type="date"
                data-testid="bl-date-input"
                value={form.bl_date}
                onChange={(e) => setForm({ ...form, bl_date: e.target.value })}
                className="h-12 border-2 text-base"
              />
            </div>
            
            {/* Supplier with Add functionality */}
            <div className="space-y-2">
              <Label className="text-sm uppercase tracking-wider font-semibold">Supplier</Label>
              <div className="flex gap-2">
                <Select value={form.supplier_name} onValueChange={(v) => setForm({ ...form, supplier_name: v })}>
                  <SelectTrigger data-testid="supplier-select" className="h-12 border-2 text-base">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddSupplier(!showAddSupplier)}
                  className="h-12 border-2"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {showAddSupplier && (
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="New supplier name"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="h-10 border-2"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSupplier()}
                  />
                  <Button onClick={handleAddSupplier} size="sm" className="bg-emerald-700">Add</Button>
                </div>
              )}
            </div>
            
            {/* Country with Add functionality */}
            <div className="space-y-2">
              <Label className="text-sm uppercase tracking-wider font-semibold">Country</Label>
              <div className="flex gap-2">
                <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                  <SelectTrigger data-testid="country-select" className="h-12 border-2 text-base">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddCountry(!showAddCountry)}
                  className="h-12 border-2"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {showAddCountry && (
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="New country name"
                    value={newCountryName}
                    onChange={(e) => setNewCountryName(e.target.value)}
                    className="h-10 border-2"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCountry()}
                  />
                  <Button onClick={handleAddCountry} size="sm" className="bg-emerald-700">Add</Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm uppercase tracking-wider font-semibold">Remarks (optional)</Label>
            <Textarea
              data-testid="remarks-input"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              placeholder="Notes..."
              className="border-2"
              rows={2}
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Container className="w-5 h-5 text-emerald-800" />
                Containers
              </h3>
              <Button
                type="button"
                variant="outline"
                onClick={addNewContainer}
                data-testid="add-container-row"
                className="h-10 border-2"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Container
              </Button>
            </div>

            {/* Existing containers (edit mode - read-only) */}
            {isEdit && (containers || []).map((c, idx) => (
              <ContainerCard
                key={c.id || idx}
                container={c}
                index={idx}
                onUpdate={() => {}}
                onRemove={() => {}}
                isExisting={true}
              />
            ))}

            {/* New containers */}
            {(isEdit ? newContainers : containers).map((c, idx) => (
              <ContainerCard
                key={`new-${idx}`}
                container={c}
                index={isEdit ? containers.length + idx : idx}
                onUpdate={(i, updated) => updateContainer(i, updated, isEdit)}
                onRemove={(i) => removeContainer(i, isEdit)}
                isExisting={false}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-12 border-2" data-testid="cancel-purchase">
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="h-12 bg-[#064E3B] hover:bg-[#047857] font-bold"
            data-testid="save-purchase"
          >
            {saving ? "Saving..." : isEdit ? "Update Purchase" : "Save Purchase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Purchases() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/purchases");
      setItems(data);
    } catch (e) {
      toast.error("Failed to load purchases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onDelete = async (p) => {
    try {
      await api.delete(`/purchases/${p.id}`);
      toast.success("Purchase deleted");
      load();
    } catch (e) {
      toast.error(formatErr(e?.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Purchases</h1>
          <p className="text-slate-600 mt-1">Bills of Lading & containers</p>
        </div>
      </div>

      <Button
        onClick={() => { setEditing(null); setOpen(true); }}
        data-testid="add-purchase-btn"
        className="w-full h-16 text-lg rounded-xl bg-[#064E3B] hover:bg-[#047857] text-white font-bold shadow-sm"
      >
        <Plus className="w-6 h-6 mr-2" strokeWidth={3} /> Add New Purchase
      </Button>

      {loading ? (
        <div className="text-center text-slate-500 py-10">Loading...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-10 text-center">
          <Package className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="font-bold text-lg text-slate-800">No purchases yet</h3>
          <p className="text-slate-500 mt-1">Tap "Add New Purchase" to record your first BL.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              data-testid={`purchase-card-${p.bl_number}`}
            >
              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-lg sm:text-xl font-bold text-slate-900">{p.bl_number}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-sm">
                      <div className="flex items-start gap-2">
                        <Calendar className="w-4 h-4 text-slate-500 mt-0.5" />
                        <div>
                          <div className="text-xs uppercase text-slate-500 tracking-wider">Date</div>
                          <div className="font-mono font-semibold">{p.bl_date}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Building2 className="w-4 h-4 text-slate-500 mt-0.5" />
                        <div>
                          <div className="text-xs uppercase text-slate-500 tracking-wider">Supplier</div>
                          <div className="font-semibold truncate">{p.supplier_name}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Globe2 className="w-4 h-4 text-slate-500 mt-0.5" />
                        <div>
                          <div className="text-xs uppercase text-slate-500 tracking-wider">Country</div>
                          <div className="font-semibold">{p.country}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Container className="w-4 h-4 text-slate-500 mt-0.5" />
                        <div>
                          <div className="text-xs uppercase text-slate-500 tracking-wider">Containers</div>
                          <div className="font-mono font-bold text-emerald-800">
                            {p.completed_containers}/{p.total_containers} done
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 border-2"
                      onClick={() => { setEditing(p); setOpen(true); }}
                      data-testid={`edit-purchase-${p.bl_number}`}
                    >
                      <Pencil className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 border-2 text-rose-600 border-rose-200 hover:bg-rose-50"
                          data-testid={`delete-purchase-${p.bl_number}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this purchase?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove BL {p.bl_number}, all its containers and measurements.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-rose-600 hover:bg-rose-700"
                            onClick={() => onDelete(p)}
                            data-testid={`confirm-delete-${p.bl_number}`}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {p.containers?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex flex-wrap gap-2">
                      {p.containers.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200"
                          data-testid={`container-chip-${c.container_number}`}
                        >
                          <span className="font-mono text-xs font-bold text-slate-500">#{c.sr_no}</span>
                          <span className="font-mono text-sm font-semibold">{c.container_number}</span>
                          <StatusBadge status={c.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {p.remarks && (
                  <div className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                    <FileText className="w-4 h-4 mt-0.5" />
                    <p>{p.remarks}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <PurchaseDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={load}
      />
    </div>
  );
}
