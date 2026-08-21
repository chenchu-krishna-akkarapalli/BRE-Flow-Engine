"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Filter,
  Layers,
  Plus,
  Search,
  User,
  XCircle,
} from "lucide-react";

interface PipelineCase {
  id: string;
  applicantName: string;
  entityType: "Individual" | "Company";
  amount: string;
  stage: "Draft" | "Evaluating" | "Bank Match" | "Underwriting" | "Disbursed" | "Terminated";
  selectedBank?: string;
  cibil: number;
  timeInStage: string;
  agent: string;
}

const INITIAL_CASES: PipelineCase[] = [
  {
    id: "APP-8921",
    applicantName: "Aakash Verma",
    entityType: "Individual",
    amount: "₹ 35,00,000",
    stage: "Evaluating",
    selectedBank: "HDFC",
    cibil: 780,
    timeInStage: "18 mins ago",
    agent: "Rohit Sharma",
  },
  {
    id: "APP-8919",
    applicantName: "Apex Logistics Ltd",
    entityType: "Company",
    amount: "₹ 1,20,00,000",
    stage: "Underwriting",
    selectedBank: "BOB",
    cibil: 765,
    timeInStage: "2 hours ago",
    agent: "Priya Nair",
  },
  {
    id: "APP-8915",
    applicantName: "Meera Krishnan",
    entityType: "Individual",
    amount: "₹ 18,50,000",
    stage: "Bank Match",
    selectedBank: "AXIS",
    cibil: 742,
    timeInStage: "4 hours ago",
    agent: "Amit Patel",
  },
  {
    id: "APP-8912",
    applicantName: "Vikram Malhotra",
    entityType: "Individual",
    amount: "₹ 50,00,000",
    stage: "Disbursed",
    selectedBank: "BOI",
    cibil: 810,
    timeInStage: "1 day ago",
    agent: "Sneha Sen",
  },
  {
    id: "APP-8908",
    applicantName: "Sanjay Singhania",
    entityType: "Individual",
    amount: "₹ 25,00,000",
    stage: "Draft",
    cibil: 710,
    timeInStage: "5 hours ago",
    agent: "Rohit Sharma",
  },
  {
    id: "APP-8899",
    applicantName: "NexGen Pharma LLP",
    entityType: "Company",
    amount: "₹ 85,00,000",
    stage: "Terminated",
    cibil: 620,
    timeInStage: "2 days ago",
    agent: "Amit Patel",
  },
  {
    id: "APP-8894",
    applicantName: "Ananya Deshmukh",
    entityType: "Individual",
    amount: "₹ 42,00,000",
    stage: "Underwriting",
    selectedBank: "KOTAK",
    cibil: 795,
    timeInStage: "3 hours ago",
    agent: "Priya Nair",
  },
];

const STAGES: PipelineCase["stage"][] = [
  "Draft",
  "Evaluating",
  "Bank Match",
  "Underwriting",
  "Disbursed",
  "Terminated",
];

export default function PipelinePage() {
  const [cases, setCases] = useState<PipelineCase[]>(INITIAL_CASES);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("ALL");
  const [activeModalCase, setActiveModalCase] = useState<PipelineCase | null>(null);

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.agent.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = selectedStage === "ALL" || c.stage === selectedStage;
    return matchesSearch && matchesStage;
  });

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      {/* Top Controls Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink font-display">Case Pipeline</h1>
          <p className="text-xs text-ink-subtle">
            Active credit pipeline stage tracking across 8 partner banks
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px]">
            <input
              type="text"
              placeholder="Search by ID, applicant, agent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input w-full rounded-xl py-2 pl-9 pr-4 text-xs font-medium"
            />
            <Search size={14} className="absolute left-3 top-2.5 text-ink-subtle" />
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-indigo px-4 py-2 text-xs font-bold text-white shadow-glow transition-all hover:scale-[1.02]"
          >
            <Plus size={16} />
            <span>New Application</span>
          </Link>
        </div>
      </div>

      {/* Stage KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((stg) => {
          const count = cases.filter((c) => c.stage === stg).length;
          const isSelected = selectedStage === stg;
          return (
            <button
              key={stg}
              type="button"
              onClick={() => setSelectedStage(isSelected ? "ALL" : stg)}
              className={`rounded-2xl border p-3.5 text-left transition-all ${
                isSelected
                  ? "border-brand-500 bg-brand-500/10 shadow-xs"
                  : "border-line bg-white hover:border-line-strong"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-ink-subtle">
                <span>{stg}</span>
                <span className="font-mono font-bold text-ink">{count}</span>
              </div>
              <p className="mt-1 font-mono text-lg font-extrabold text-ink">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Pipeline Kanban / List View */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCases.map((item) => (
          <div
            key={item.id}
            onClick={() => setActiveModalCase(item)}
            className="glass-card cursor-pointer rounded-2xl p-5 border border-line bg-white transition-all hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-extrabold text-brand-600">
                {item.id}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[0.6875rem] font-bold border ${
                  item.stage === "Disbursed"
                    ? "bg-success/10 text-success border-success/20"
                    : item.stage === "Terminated"
                    ? "bg-danger/10 text-danger border-danger/20"
                    : item.stage === "Underwriting"
                    ? "bg-warning/10 text-warning border-warning/20"
                    : "bg-brand-500/10 text-brand-600 border-brand-500/20"
                }`}
              >
                {item.stage}
              </span>
            </div>

            <div className="mt-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-1.5">
                {item.entityType === "Individual" ? <User size={16} className="text-ink-subtle" /> : <Building2 size={16} className="text-ink-subtle" />}
                {item.applicantName}
              </h3>
              <p className="font-mono text-xs text-ink-muted mt-0.5">
                Loan Amount: <span className="font-bold text-ink">{item.amount}</span>
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-xs">
              <div className="flex items-center gap-1.5 text-ink-subtle">
                <span>CIBIL:</span>
                <span className="font-mono font-bold text-ink">{item.cibil}</span>
              </div>
              {item.selectedBank && (
                <span className="rounded bg-bg-raised px-2 py-0.5 font-mono text-[0.6875rem] font-bold text-ink">
                  Bank: {item.selectedBank}
                </span>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between text-[0.6875rem] text-ink-subtle">
              <span>Agent: {item.agent}</span>
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {item.timeInStage}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Case Details Drawer Modal */}
      {activeModalCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <span className="font-mono text-xs font-bold text-brand-600">{activeModalCase.id}</span>
                <h2 className="text-lg font-bold text-ink">{activeModalCase.applicantName}</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalCase(null)}
                className="rounded-lg p-1.5 text-ink-subtle hover:bg-bg-raised"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-bg-raised p-3">
                  <span className="text-ink-subtle block">Stage</span>
                  <span className="font-bold text-ink">{activeModalCase.stage}</span>
                </div>
                <div className="rounded-xl bg-bg-raised p-3">
                  <span className="text-ink-subtle block">Requested Amount</span>
                  <span className="font-mono font-bold text-ink">{activeModalCase.amount}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-bg-raised p-3">
                  <span className="text-ink-subtle block">CIBIL Bureau Score</span>
                  <span className="font-mono font-bold text-ink">{activeModalCase.cibil}</span>
                </div>
                <div className="rounded-xl bg-bg-raised p-3">
                  <span className="text-ink-subtle block">Assigned Staff</span>
                  <span className="font-bold text-ink">{activeModalCase.agent}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveModalCase(null)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink hover:bg-bg-raised"
              >
                Close
              </button>
              <Link
                href="/"
                className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-bold text-white shadow-glow hover:bg-brand-600"
              >
                Open in Wizard
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
