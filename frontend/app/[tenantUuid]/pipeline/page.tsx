"use client";

import { use, useState } from "react";
import { ArrowRight, CheckCircle2, Clock, Filter, GitPullRequest, Search, ShieldAlert, User } from "lucide-react";

interface LeadItem {
  id: string;
  applicantName: string;
  loanType: string;
  requestedAmount: number;
  stage: "SOURCING" | "DATA_ENRICHMENT" | "UNDERWRITING" | "SANCTIONED" | "DISBURSED";
  priority: "HIGH" | "MEDIUM" | "LOW";
  assignedTo: string;
  cibilScore: number;
}

const INITIAL_LEADS: LeadItem[] = [
  { id: "LD-9821", applicantName: "Ananya Deshmukh", loanType: "Auto Loan", requestedAmount: 1250000, stage: "UNDERWRITING", priority: "HIGH", assignedTo: "Rajesh Sharma", cibilScore: 785 },
  { id: "LD-9822", applicantName: "Apex Logistics LLP", loanType: "Commercial Vehicle", requestedAmount: 4500000, stage: "DATA_ENRICHMENT", priority: "HIGH", assignedTo: "Arun Patel", cibilScore: 742 },
  { id: "LD-9823", applicantName: "Rohan Verma", loanType: "Personal Loan", requestedAmount: 500000, stage: "SOURCING", priority: "MEDIUM", assignedTo: "Priya Nair", cibilScore: 690 },
  { id: "LD-9824", applicantName: "Sunil Kumar", loanType: "Home Loan", requestedAmount: 6500000, stage: "SANCTIONED", priority: "MEDIUM", assignedTo: "Rajesh Sharma", cibilScore: 810 },
  { id: "LD-9825", applicantName: "Kavita Reddy", loanType: "Auto Loan", requestedAmount: 850000, stage: "DISBURSED", priority: "LOW", assignedTo: "Arun Patel", cibilScore: 765 },
];

export default function TenantPipelinePage({
  params,
}: {
  params: Promise<{ tenantUuid: string }>;
}) {
  const { tenantUuid } = use(params);
  const [leads, setLeads] = useState<LeadItem[]>(INITIAL_LEADS);
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("ALL");

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.loanType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === "ALL" || lead.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-ink font-display">
              Sales & Origination Pipeline
            </h1>
            <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-mono font-bold text-brand-600 border border-brand-500/20">
              {tenantUuid}
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">
            Track real-time lead progressions, bureau enrichment, and underwriting handoffs.
          </p>
        </div>
      </div>

      {/* Stage Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["SOURCING", "DATA_ENRICHMENT", "UNDERWRITING", "SANCTIONED", "DISBURSED"] as const).map((stg) => {
          const count = leads.filter((l) => l.stage === stg).length;
          return (
            <button
              type="button"
              key={stg}
              onClick={() => setStageFilter(stageFilter === stg ? "ALL" : stg)}
              className={`rounded-xl border p-3 text-left transition-all ${
                stageFilter === stg
                  ? "border-brand-500 bg-brand-500/5 shadow-xs"
                  : "border-line bg-white hover:border-slate-300"
              }`}
            >
              <span className="text-[0.625rem] font-bold uppercase text-ink-subtle">{stg.replace("_", " ")}</span>
              <p className="font-mono text-lg font-extrabold text-ink">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-xs">
        <Search size={16} className="text-ink-subtle ml-2" />
        <input
          type="text"
          placeholder="Search by applicant name, lead ID, or loan type..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-subtle focus:outline-hidden"
        />
      </div>

      {/* Pipeline Table */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-line bg-slate-50 text-[0.6875rem] font-extrabold uppercase tracking-wider text-ink-subtle">
            <tr>
              <th className="px-5 py-3">Lead ID</th>
              <th className="px-5 py-3">Applicant</th>
              <th className="px-5 py-3">Loan Type</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">CIBIL</th>
              <th className="px-5 py-3">Stage</th>
              <th className="px-5 py-3">Assigned To</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredLeads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-3.5 font-mono font-bold text-brand-600">{lead.id}</td>
                <td className="px-5 py-3.5 font-bold text-ink">{lead.applicantName}</td>
                <td className="px-5 py-3.5 text-ink-muted">{lead.loanType}</td>
                <td className="px-5 py-3.5 font-mono text-ink">₹{lead.requestedAmount.toLocaleString("en-IN")}</td>
                <td className="px-5 py-3.5">
                  <span className="font-mono font-bold text-emerald-600">{lead.cibilScore}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[0.625rem] font-bold text-ink uppercase border border-slate-200">
                    {lead.stage.replace("_", " ")}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-ink-muted flex items-center gap-1.5">
                  <User size={12} className="text-ink-subtle" />
                  {lead.assignedTo}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
