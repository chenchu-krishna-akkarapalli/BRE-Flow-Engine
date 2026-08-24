"use client";

import { use, useState } from "react";
import { Plus, Search, Shield, UserCheck, Users, X } from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "ACTIVE" | "INVITED" | "SUSPENDED";
  hierarchyTier: number;
}

const INITIAL_USERS: UserItem[] = [
  { id: "usr-01", name: "Rajesh Sharma", email: "rajesh.sharma@finsol.in", role: "CHANNEL_ADMIN", status: "ACTIVE", hierarchyTier: 5 },
  { id: "usr-02", name: "Arun Patel", email: "arun.patel@finsol.in", role: "SALES_MANAGER", status: "ACTIVE", hierarchyTier: 8 },
  { id: "usr-03", name: "Priya Nair", email: "priya.nair@finsol.in", role: "TEAM_LEADER", status: "ACTIVE", hierarchyTier: 7 },
  { id: "usr-04", name: "Vikram Joshi", email: "vikram.joshi@finsol.in", role: "TRANSACTIONAL_USER", status: "INVITED", hierarchyTier: 9 },
];

export default function TenantAssignmentsPage({
  params,
}: {
  params: Promise<{ tenantUuid: string }>;
}) {
  const { tenantUuid } = use(params);
  const [users, setUsers] = useState<UserItem[]>(INITIAL_USERS);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("SALES_MANAGER");

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName) return;

    const newUser: UserItem = {
      id: `usr-${Date.now().toString().slice(-4)}`,
      name: newName,
      email: newEmail,
      role: newRole,
      status: "INVITED",
      hierarchyTier: 8,
    };
    setUsers([...users, newUser]);
    setNewName("");
    setNewEmail("");
    setIsModalOpen(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-[var(--shell-max)] flex-1 flex-col gap-6 px-4 sm:px-6 py-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-ink font-display">
              User Management & Role Assignments
            </h1>
            <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-mono font-bold text-brand-600 border border-brand-500/20">
              {tenantUuid}
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">
            Manage channel team members, RBAC roles, and operational hierarchy.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-white shadow-glow hover:bg-brand-600 transition-all"
        >
          <Plus size={16} />
          <span>Invite Team Member</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-xs">
        <Search size={16} className="text-ink-subtle ml-2" />
        <input
          type="text"
          placeholder="Search by name, email, or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-subtle focus:outline-hidden"
        />
      </div>

      {/* User Table */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-line bg-slate-50 text-[0.6875rem] font-extrabold uppercase tracking-wider text-ink-subtle">
            <tr>
              <th className="px-5 py-3">Member</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Hierarchy Tier</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-3.5">
                  <p className="font-bold text-ink">{user.name}</p>
                  <p className="text-[0.6875rem] text-ink-subtle">{user.email}</p>
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-500/10 px-2 py-0.5 font-mono text-[0.6875rem] font-bold text-brand-600 border border-brand-500/20">
                    <Shield size={12} />
                    {user.role}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-mono text-ink-muted">Tier {user.hierarchyTier}</td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase ${
                      user.status === "ACTIVE"
                        ? "bg-success/10 text-success border border-success/20"
                        : "bg-warning/10 text-warning border border-warning/20"
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    type="button"
                    className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <h2 className="text-base font-extrabold text-ink font-display">Invite Team Member</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-ink-subtle hover:text-ink transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arun Patel"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border border-line px-3 py-2 text-xs text-ink focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. arun.patel@finsol.in"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-line px-3 py-2 text-xs text-ink focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Assigned Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full rounded-xl border border-line px-3 py-2 text-xs text-ink focus:border-brand-500 focus:outline-hidden"
                >
                  <option value="AREA_MANAGER">Area Manager (Tier 6)</option>
                  <option value="TEAM_LEADER">Team Leader (Tier 7)</option>
                  <option value="SALES_MANAGER">Sales Manager (Tier 8)</option>
                  <option value="TRANSACTIONAL_USER">Transactional User (Tier 9)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-muted hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-bold text-white shadow-glow hover:bg-brand-600 transition-all"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
