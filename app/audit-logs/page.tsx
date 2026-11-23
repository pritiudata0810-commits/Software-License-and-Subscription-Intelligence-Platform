'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  History,
  Search,
  Filter,
  User,
  Clock,
  Shield,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  UserX,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Activity,
  Layers,
  ChevronDown
} from 'lucide-react';
import { exportToCsv } from '@/lib/exportCsv';

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [actionCounts, setActionCounts] = useState<Record<string, number>>({});

  const fetchLogs = async (pageNum = 1, actionFilter = selectedAction, querySearch = search) => {
    setLoading(true);
    try {
      const url = new URL('/api/audit-logs', window.location.origin);
      url.searchParams.set('page', pageNum.toString());
      url.searchParams.set('limit', '50');
      if (actionFilter && actionFilter !== 'ALL') {
        url.searchParams.set('action', actionFilter);
      }
      if (querySearch.trim()) {
        url.searchParams.set('search', querySearch.trim());
      }

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
        if (data.actionCounts) {
          setActionCounts(data.actionCounts);
        }
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page, selectedAction, search);
  }, [page, selectedAction]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1, selectedAction, search);
  };

  const handleActionFilterChange = (action: string) => {
    setSelectedAction(action);
    setPage(1);
  };

  const handleExportCSV = () => {
    if (!logs || logs.length === 0) return;

    const headers = [
      'Timestamp',
      'Actor Name',
      'Actor Email',
      'Actor Role',
      'Action',
      'Entity Affected',
      'Entity ID',
      'IP Address',
      'Transaction Details',
    ];

    const rows = logs.map((log: any) => [
      new Date(log.createdAt).toISOString(),
      log.user?.name || 'System Process',
      log.user?.email || 'N/A',
      log.user?.role || 'SYSTEM',
      log.action,
      log.entity,
      log.entityId || 'N/A',
      log.ipAddress || '127.0.0.1',
      JSON.stringify(log.details || {}),
    ]);

    exportToCsv(`Audit_Logs_Governance_Export_${new Date().toISOString().split('T')[0]}`, headers, rows);
  };

  const renderActionBadge = (action: string) => {
    switch (action) {
      case 'REVOKE_LICENSE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
            <UserX className="w-3 h-3 text-rose-600" />
            <span>REVOKE LICENSE</span>
          </span>
        );
      case 'ASSIGN_LICENSE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
            <UserCheck className="w-3 h-3 text-emerald-600" />
            <span>ASSIGN LICENSE</span>
          </span>
        );
      case 'APPROVE_REQUEST':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-300">
            <CheckCircle2 className="w-3 h-3 text-indigo-600" />
            <span>APPROVE REQUEST</span>
          </span>
        );
      case 'REJECT_REQUEST':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>REJECT REQUEST</span>
          </span>
        );
      case 'GENERATE_RECOMMENDATION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-300">
            <Sparkles className="w-3 h-3 text-purple-600" />
            <span>RECOMMENDATION</span>
          </span>
        );
      case 'UPDATE':
      case 'CREATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
            <Activity className="w-3 h-3 text-blue-600" />
            <span>{action}</span>
          </span>
        );
      case 'LOGIN':
      case 'LOGOUT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            <Shield className="w-3 h-3 text-slate-500" />
            <span>{action}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            <span>{action.replace(/_/g, ' ')}</span>
          </span>
        );
    }
  };

  const renderTransactionDetails = (log: any) => {
    const details = log.details || {};

    if (log.action === 'REVOKE_LICENSE') {
      return (
        <div className="space-y-0.5">
          <div className="text-slate-800 font-semibold flex items-center gap-1">
            <span>Revoked from:</span>
            <span className="font-bold text-rose-700">{details.revokedFromUserName || details.revokedFromUserEmail || 'Dormant User'}</span>
            <span className="text-slate-400">({details.softwareName || 'Software'})</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {details.reason} {details.reallocatedToUserName && `— Reallocated to ${details.reallocatedToUserName}`}
          </div>
        </div>
      );
    }

    if (log.action === 'ASSIGN_LICENSE') {
      return (
        <div className="space-y-0.5">
          <div className="text-slate-800 font-semibold flex items-center gap-1">
            <span>Assigned to:</span>
            <span className="font-bold text-emerald-700">{details.assignedToUserName || details.assignedToUserEmail || 'Employee'}</span>
            <span className="text-slate-400">({details.softwareName || 'Software'})</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {details.reason} {details.reallocatedFromUserName && `(from ${details.reallocatedFromUserName})`}
          </div>
        </div>
      );
    }

    if (log.action === 'APPROVE_REQUEST') {
      return (
        <div className="space-y-0.5">
          <div className="text-slate-800 font-semibold flex items-center gap-1">
            <span>Approved:</span>
            <span className="font-bold text-indigo-700">{details.requestedBy || 'Requester'}</span>
            <span className="text-slate-400">for {details.softwareName || 'Software'}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {details.actionType === 'RECLAIM_AND_ASSIGN' && details.reclaimedFrom
              ? `Reclaimed idle seat from ${details.reclaimedFrom} (₹0 procurement cost)`
              : details.actionTaken}
          </div>
        </div>
      );
    }

    if (details.type === 'TELEMETRY_LOG') {
      return (
        <div className="space-y-0.5">
          <div className="text-slate-800 font-semibold">
            Telemetry logged for {details.targetUserName || 'User'} on {details.softwareName}
          </div>
          <div className="text-[11px] text-slate-500">
            +{details.hoursLogged} hrs used, +{details.loginsLogged} logins (Total: {details.totalHours} hrs)
          </div>
        </div>
      );
    }

    if (details.type === 'DUPLICATE_CONSOLIDATION') {
      return (
        <div className="space-y-0.5">
          <div className="text-slate-800 font-semibold">
            Consolidation recommendation flagged for {details.category}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold">
            Primary: {details.primarySoftwareName} • Est. Recoverable: ₹{details.potentialAnnualSavings?.toLocaleString('en-IN')}/yr
          </div>
        </div>
      );
    }

    // Default fallback
    return (
      <div className="font-mono text-[11px] text-slate-600 max-w-lg truncate">
        {JSON.stringify(details)}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <History className="w-3 h-3" />
              <span>Immutable Governance Ledger</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
              PostgreSQL Grounded
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Audit Trail &amp; Governance
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Immutable log of all user authentications, license revocations, seat allocations, approvals, and contract recommendations.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <button
            type="button"
            onClick={() => fetchLogs(page, selectedAction, search)}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Action Filter Pills Bar (Phase 3 Audit Log Completion) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => handleActionFilterChange('ALL')}
          className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
            selectedAction === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All Actions ({total})
        </button>

        <button
          type="button"
          onClick={() => handleActionFilterChange('REVOKE_LICENSE')}
          className={`px-3 py-1.5 rounded-xl transition shrink-0 flex items-center gap-1.5 ${
            selectedAction === 'REVOKE_LICENSE'
              ? 'bg-rose-700 text-white shadow-xs'
              : 'bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100'
          }`}
        >
          <UserX className="w-3.5 h-3.5" />
          <span>Revoke License ({actionCounts['REVOKE_LICENSE'] || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => handleActionFilterChange('ASSIGN_LICENSE')}
          className={`px-3 py-1.5 rounded-xl transition shrink-0 flex items-center gap-1.5 ${
            selectedAction === 'ASSIGN_LICENSE'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Assign License ({actionCounts['ASSIGN_LICENSE'] || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => handleActionFilterChange('APPROVE_REQUEST')}
          className={`px-3 py-1.5 rounded-xl transition shrink-0 flex items-center gap-1.5 ${
            selectedAction === 'APPROVE_REQUEST'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'bg-indigo-50 border border-indigo-200 text-indigo-800 hover:bg-indigo-100'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Approve Request ({actionCounts['APPROVE_REQUEST'] || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => handleActionFilterChange('REJECT_REQUEST')}
          className={`px-3 py-1.5 rounded-xl transition shrink-0 flex items-center gap-1.5 ${
            selectedAction === 'REJECT_REQUEST'
              ? 'bg-amber-700 text-white shadow-xs'
              : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Reject Request ({actionCounts['REJECT_REQUEST'] || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => handleActionFilterChange('GENERATE_RECOMMENDATION')}
          className={`px-3 py-1.5 rounded-xl transition shrink-0 flex items-center gap-1.5 ${
            selectedAction === 'GENERATE_RECOMMENDATION'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'bg-purple-50 border border-purple-200 text-purple-800 hover:bg-purple-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Recommendations ({actionCounts['GENERATE_RECOMMENDATION'] || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => handleActionFilterChange('UPDATE')}
          className={`px-3 py-1.5 rounded-xl transition shrink-0 flex items-center gap-1.5 ${
            selectedAction === 'UPDATE'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Updates &amp; Telemetry ({actionCounts['UPDATE'] || 0})</span>
        </button>
      </div>

      {/* Search Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, actor, email, entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-slate-900"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-2xs"
          >
            Search
          </button>
          <span className="text-xs text-slate-500 font-medium">
            Showing {logs.length} of {total} records
          </span>
        </div>
      </form>

      {/* Logs Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold uppercase tracking-wider text-[10px] sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Transaction Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Loading audit trail...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {log.user ? (
                        <div>
                          <div className="text-slate-900 font-bold">{log.user.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {log.user.email} • {log.user.role}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">System Process</span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderActionBadge(log.action)}
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-800">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-mono">
                        {log.entity}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {renderTransactionDetails(log)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No audit records match the selected filter or query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50/50">
            <span className="text-slate-500">
              Page <span className="font-bold text-slate-900">{page}</span> of{' '}
              <span className="font-bold text-slate-900">{totalPages}</span> ({total} total entries)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition font-semibold"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition font-semibold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
