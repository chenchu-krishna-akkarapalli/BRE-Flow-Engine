"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Database,
  Edit,
  Eye,
  FileCheck,
  FileText,
  FolderLock,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Sliders,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import {
  CatalogModuleItem,
  RolePermissionMatrixItem,
  useModuleStore,
} from "@/store/useModuleStore";

const ALL_ROLES = [
  { key: "SUPER_ADMIN", label: "Super Admin", color: "indigo" },
  { key: "OPERATIONS_HEAD", label: "Operations Head", color: "amber" },
  { key: "ACCOUNTS_HEAD", label: "Accounts Head", color: "rose" },
  { key: "REGIONAL_DIRECTOR", label: "Regional Director", color: "emerald" },
  { key: "AREA_MANAGER", label: "Area Manager", color: "emerald" },
  { key: "TEAM_LEADER", label: "Team Leader", color: "emerald" },
  { key: "SALES_MANAGER", label: "Sales Manager", color: "emerald" },
  { key: "CHANNEL_ADMIN", label: "Channel Admin", color: "teal" },
  { key: "TRANSACTIONAL_USER", label: "Transactional User", color: "sky" },
  { key: "DB_ADMIN", label: "DB Admin", color: "slate" },
  { key: "SOC_ANALYST", label: "SOC Analyst", color: "rose" },
];

export default function DynamicModuleManagerPage() {
  const { role, tenantUuid } = useAuthStore();
  const {
    catalog,
    matrix,
    fetchCatalog,
    fetchMatrix,
    saveMatrix,
    createCatalogModule,
    updateCatalogModule,
    deleteCatalogModule,
    isSaving,
    fetchModules,
  } = useModuleStore();

  const [activeTab, setActiveTab] = useState<"catalog" | "matrix" | "tenant">("catalog");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("ALL");
  const [localMatrix, setLocalMatrix] = useState<RolePermissionMatrixItem[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // New module modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newRoute, setNewRoute] = useState("/{{tenant}}/");
  const [newIcon, setNewIcon] = useState("FileText");
  const [newSectionKey, setNewSectionKey] = useState("PORTAL_NAV");
  const [newSectionTitle, setNewSectionTitle] = useState("Portal Navigation");
  const [newBadge, setNewBadge] = useState("");
  const [newBadgeType, setNewBadgeType] = useState<"brand" | "emerald" | "amber" | "rose">("brand");
  const [newDesc, setNewDesc] = useState("");

  // Initial data load
  useEffect(() => {
    fetchCatalog();
    fetchMatrix();
  }, [fetchCatalog, fetchMatrix]);

  // Sync matrix to local state for editing
  useEffect(() => {
    if (matrix && matrix.length > 0) {
      setLocalMatrix(matrix);
    }
  }, [matrix]);

  // Handle local permission toggle
  const handleTogglePerm = (
    roleKey: string,
    moduleCode: string,
    permType: "can_view" | "can_create" | "can_edit" | "can_approve"
  ) => {
    setLocalMatrix((prev) => {
      const idx = prev.findIndex(
        (p) => p.role_key === roleKey && p.module_code === moduleCode
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          [permType]: !updated[idx][permType],
        };
        return updated;
      } else {
        const newItem: RolePermissionMatrixItem = {
          role_key: roleKey,
          module_code: moduleCode,
          can_view: permType === "can_view",
          can_create: permType === "can_create",
          can_edit: permType === "can_edit",
          can_approve: permType === "can_approve",
        };
        return [...prev, newItem];
      }
    });
    setHasUnsavedChanges(true);
  };

  const getPermValue = (
    roleKey: string,
    moduleCode: string,
    permType: "can_view" | "can_create" | "can_edit" | "can_approve"
  ): boolean => {
    const item = localMatrix.find(
      (p) => p.role_key === roleKey && p.module_code === moduleCode
    );
    if (!item) return false;
    return !!item[permType];
  };

  const handleSaveMatrix = async () => {
    const success = await saveMatrix(localMatrix);
    if (success) {
      setHasUnsavedChanges(false);
      setFeedbackMessage("Permission matrix saved successfully! All user sessions refreshed.");
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName || !newRoute) return;

    const success = await createCatalogModule({
      code: newCode.trim().toUpperCase(),
      name: newName.trim(),
      route_template: newRoute.trim(),
      icon_name: newIcon.trim(),
      section_key: newSectionKey,
      section_title: newSectionTitle,
      badge: newBadge ? newBadge.trim() : undefined,
      badge_type: newBadge ? newBadgeType : undefined,
      description: newDesc.trim(),
      is_active: true,
      is_core: false,
      sort_order: (catalog.length || 0) + 1,
    });

    if (success) {
      setShowAddModal(false);
      setNewCode("");
      setNewName("");
      setNewRoute("/{{tenant}}/");
      setNewBadge("");
      setNewDesc("");
      setFeedbackMessage(`Module '${newCode.toUpperCase()}' created and added to dynamic navigation.`);
      await fetchCatalog();
      await fetchMatrix();
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  const handleToggleModuleActive = async (mod: CatalogModuleItem) => {
    const updated = await updateCatalogModule(mod.code, {
      is_active: !mod.is_active,
    });
    if (updated) {
      setFeedbackMessage(`Module '${mod.name}' status updated to ${!mod.is_active ? "Active" : "Disabled"}.`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  const handleDeleteModule = async (mod: CatalogModuleItem) => {
    if (!confirm(`Are you sure you want to permanently delete module '${mod.name}' (${mod.code})?`)) return;
    const deleted = await deleteCatalogModule(mod.code);
    if (deleted) {
      setFeedbackMessage(`Module '${mod.name}' was permanently removed.`);
      await fetchCatalog();
      await fetchMatrix();
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };


  const filteredCatalog = catalog.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.code.toLowerCase().includes(q) ||
      m.section_title.toLowerCase().includes(q) ||
      m.route_template.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 space-y-6 p-6 lg:p-8">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-teal-600">
            <Sliders size={14} />
            <span>Platform Governance</span>
            <ChevronRight size={12} className="text-slate-400" />
            <span className="text-slate-800">Dynamic Module Studio</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 font-display">
            Dynamic Module Manager & Role Entitlements
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-2xl">
            Configure platform modules on the fly. Enable, disable, create custom modules, and assign granular View, Create, Edit, and Approve capabilities across all 11 hierarchy tiers with zero code redeployments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <button
              onClick={handleSaveMatrix}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 transition-all"
            >
              {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Save Changes</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-all"
          >
            <Plus size={14} />
            <span>New Dynamic Module</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div className="flex items-center gap-2.5 rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-xs font-medium text-teal-800 animate-fade-in shadow-xs">
          <CheckCircle2 size={16} className="text-teal-600 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-px">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === "catalog"
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers size={14} />
            <span>Module Catalog ({catalog.length || 14})</span>
          </button>

          <button
            onClick={() => setActiveTab("matrix")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === "matrix"
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Shield size={14} />
            <span>Role Permission Matrix</span>
            {hasUnsavedChanges && (
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-48 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* TAB 1: MODULE CATALOG */}
      {activeTab === "catalog" && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map((mod) => (
              <div
                key={mod.code}
                className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-md ${
                  mod.is_active ? "border-slate-200" : "border-slate-200 bg-slate-50/50 opacity-60"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold border border-slate-200">
                        <FileText size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 font-display">
                          {mod.name}
                        </h3>
                        <p className="font-mono text-[0.625rem] text-slate-500 uppercase tracking-wider">
                          {mod.code}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {mod.badge && (
                        <span className="inline-flex rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[0.5625rem] font-bold font-mono text-teal-700">
                          {mod.badge}
                        </span>
                      )}
                      {mod.is_core && (
                        <span className="inline-flex rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[0.5625rem] font-bold font-mono text-slate-600">
                          CORE
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between text-[0.6875rem]">
                      <span className="text-slate-400">Section:</span>
                      <span className="font-medium text-slate-700">{mod.section_title}</span>
                    </div>
                    <div className="flex items-center justify-between text-[0.6875rem]">
                      <span className="text-slate-400">Route:</span>
                      <span className="font-mono text-[0.625rem] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {mod.route_template}
                      </span>
                    </div>
                    {mod.description && (
                      <p className="mt-2 text-[0.6875rem] text-slate-500 line-clamp-2">
                        {mod.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        mod.is_active ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                    <span className="text-[0.6875rem] font-medium text-slate-600">
                      {mod.is_active ? "Active" : "Disabled"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!mod.is_core && (
                      <button
                        onClick={() => handleDeleteModule(mod)}
                        title="Delete custom module"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleModuleActive(mod)}
                      disabled={mod.is_core}
                      className={`rounded-lg px-2.5 py-1 text-[0.6875rem] font-bold transition-all ${
                        mod.is_core
                          ? "text-slate-300 cursor-not-allowed"
                          : mod.is_active
                          ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                          : "bg-teal-50 text-teal-600 hover:bg-teal-100"
                      }`}
                    >
                      {mod.is_core ? "System Lock" : mod.is_active ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: ROLE ENTITLEMENT MATRIX */}
      {activeTab === "matrix" && (
        <div className="space-y-4 animate-fade-in">
          {/* Role Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            <span className="text-xs font-bold text-slate-500 mr-2 shrink-0">Focus Role:</span>
            <button
              onClick={() => setSelectedRoleFilter("ALL")}
              className={`rounded-lg px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wider transition-all shrink-0 ${
                selectedRoleFilter === "ALL"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Roles (Matrix)
            </button>
            {ALL_ROLES.map((r) => (
              <button
                key={r.key}
                onClick={() => setSelectedRoleFilter(r.key)}
                className={`rounded-lg px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wider transition-all shrink-0 ${
                  selectedRoleFilter === r.key
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Matrix Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto max-h-[640px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-3.5 font-extrabold uppercase tracking-wider text-slate-600 min-w-[200px] bg-slate-50">
                      Module Catalog
                    </th>
                    {(selectedRoleFilter === "ALL" ? ALL_ROLES : ALL_ROLES.filter((r) => r.key === selectedRoleFilter)).map(
                      (roleObj) => (
                        <th
                          key={roleObj.key}
                          className="p-3 font-bold text-center border-l border-slate-200 min-w-[150px] bg-slate-50"
                        >
                          <div className="font-extrabold text-[0.6875rem] text-slate-800">
                            {roleObj.label}
                          </div>
                          <div className="font-mono text-[0.5625rem] text-slate-400 uppercase">
                            {roleObj.key}
                          </div>
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCatalog.map((mod) => (
                    <tr key={mod.code} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{mod.name}</div>
                        <div className="flex items-center gap-2 text-[0.625rem] text-slate-400 font-mono">
                          <span>{mod.code}</span>
                          <span>•</span>
                          <span>{mod.section_title}</span>
                        </div>
                      </td>

                      {(selectedRoleFilter === "ALL" ? ALL_ROLES : ALL_ROLES.filter((r) => r.key === selectedRoleFilter)).map(
                        (roleObj) => {
                          const canView = getPermValue(roleObj.key, mod.code, "can_view");
                          const canCreate = getPermValue(roleObj.key, mod.code, "can_create");
                          const canEdit = getPermValue(roleObj.key, mod.code, "can_edit");
                          const canApprove = getPermValue(roleObj.key, mod.code, "can_approve");

                          return (
                            <td
                              key={roleObj.key}
                              className="p-2.5 border-l border-slate-200 text-center"
                            >
                              <div className="flex items-center justify-center gap-1">
                                {/* View Toggle */}
                                <button
                                  type="button"
                                  title={`Toggle View for ${roleObj.label}`}
                                  onClick={() => handleTogglePerm(roleObj.key, mod.code, "can_view")}
                                  className={`h-6 px-1.5 rounded text-[0.5625rem] font-bold font-mono transition-all ${
                                    canView
                                      ? "bg-teal-50 text-teal-700 border border-teal-200"
                                      : "bg-slate-100 text-slate-400 border border-slate-200 opacity-50"
                                  }`}
                                >
                                  VIEW
                                </button>

                                {/* Create Toggle */}
                                <button
                                  type="button"
                                  title={`Toggle Create for ${roleObj.label}`}
                                  onClick={() => handleTogglePerm(roleObj.key, mod.code, "can_create")}
                                  className={`h-6 px-1.5 rounded text-[0.5625rem] font-bold font-mono transition-all ${
                                    canCreate
                                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                      : "bg-slate-100 text-slate-400 border border-slate-200 opacity-50"
                                  }`}
                                >
                                  ADD
                                </button>

                                {/* Edit Toggle */}
                                <button
                                  type="button"
                                  title={`Toggle Edit for ${roleObj.label}`}
                                  onClick={() => handleTogglePerm(roleObj.key, mod.code, "can_edit")}
                                  className={`h-6 px-1.5 rounded text-[0.5625rem] font-bold font-mono transition-all ${
                                    canEdit
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-slate-100 text-slate-400 border border-slate-200 opacity-50"
                                  }`}
                                >
                                  EDIT
                                </button>

                                {/* Approve Toggle */}
                                <button
                                  type="button"
                                  title={`Toggle Approve for ${roleObj.label}`}
                                  onClick={() => handleTogglePerm(roleObj.key, mod.code, "can_approve")}
                                  className={`h-6 px-1.5 rounded text-[0.5625rem] font-bold font-mono transition-all ${
                                    canApprove
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-slate-100 text-slate-400 border border-slate-200 opacity-50"
                                  }`}
                                >
                                  AUTH
                                </button>
                              </div>
                            </td>
                          );
                        }
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* NEW MODULE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 font-display">
                Create Dynamic Module
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateModule} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Module Code (Unique ID)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DOC_VAULT"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 font-mono uppercase focus:border-teal-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Document Vault"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 focus:border-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Route Template (use &#123;tenant&#125; placeholder)
                </label>
                <input
                  type="text"
                  required
                  placeholder="/{tenant}/doc-vault"
                  value={newRoute}
                  onChange={(e) => setNewRoute(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 font-mono focus:border-teal-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Section</label>
                  <select
                    value={newSectionKey}
                    onChange={(e) => {
                      setNewSectionKey(e.target.value);
                      if (e.target.value === "PORTAL_NAV") setNewSectionTitle("Portal Navigation");
                      if (e.target.value === "OPERATIONS_SALES") setNewSectionTitle("Operations & Sales");
                      if (e.target.value === "PLATFORM_GOVERNANCE") setNewSectionTitle("Platform Oversight (Application Owners)");
                    }}
                    className="w-full h-9 rounded-lg border border-slate-200 px-2.5 focus:border-teal-500 focus:outline-hidden"
                  >
                    <option value="PORTAL_NAV">Portal Navigation</option>
                    <option value="OPERATIONS_SALES">Operations & Sales</option>
                    <option value="PLATFORM_GOVERNANCE">Platform Governance</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Icon Identifier</label>
                  <select
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 px-2.5 focus:border-teal-500 focus:outline-hidden"
                  >
                    <option value="FileText">FileText</option>
                    <option value="FolderLock">FolderLock</option>
                    <option value="LayoutDashboard">LayoutDashboard</option>
                    <option value="Users">Users</option>
                    <option value="BarChart3">BarChart3</option>
                    <option value="Sliders">Sliders</option>
                    <option value="GitPullRequest">GitPullRequest</option>
                    <option value="CheckCircle">CheckCircle</option>
                    <option value="CreditCard">CreditCard</option>
                    <option value="Activity">Activity</option>
                    <option value="ShieldAlert">ShieldAlert</option>
                    <option value="DollarSign">DollarSign</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Optional Badge</label>
                  <input
                    type="text"
                    placeholder="e.g. New / V2"
                    value={newBadge}
                    onChange={(e) => setNewBadge(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 focus:border-teal-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Badge Style</label>
                  <select
                    value={newBadgeType}
                    onChange={(e) => setNewBadgeType(e.target.value as any)}
                    className="w-full h-9 rounded-lg border border-slate-200 px-2.5 focus:border-teal-500 focus:outline-hidden"
                  >
                    <option value="brand">Teal (Brand)</option>
                    <option value="emerald">Emerald (Success)</option>
                    <option value="amber">Amber (Warning)</option>
                    <option value="rose">Rose (Danger)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of this module's purpose..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 focus:border-teal-500 focus:outline-hidden"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-700 shadow-sm"
                >
                  {isSaving ? "Saving..." : "Create Module"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
