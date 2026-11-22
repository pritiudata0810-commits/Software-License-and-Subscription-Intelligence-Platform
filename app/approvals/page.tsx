'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  AlertCircle,
  X,
  RefreshCw,
  Layers,
  ShieldCheck,
} from 'lucide-react';

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/requests');
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Error fetching requests for approval:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const handleDecision = async (
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    action?: 'ALLOCATE_EXISTING' | 'RECLAIM_AND_ASSIGN' | 'PURCHASE_NEW',
    targetAssignmentId?: string,
    customComments?: string
  ) => {
    setActionLoadingId(id);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          action,
          targetAssignmentId,
          comments:
            customComments ||
            (decision === 'REJECTED'
              ? 'Rejected due to current allocation limits or policy.'
              : action === 'RECLAIM_AND_ASSIGN'
              ? 'Approved via dormant seat reclamation and reassignment.'
              : action === 'ALLOCATE_EXISTING'
              ? 'Approved using existing unassigned inventory.'
              : 'Approved for new license procurement.'),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message || `Request ${decision.toLowerCase()} successfully.`);
        fetchPendingRequests();
      } else {
        setError(data.error || 'Failed to process decision');
      }
    } catch (err: any) {
      setError(err.message || 'Error processing request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');
  const pastDecisions = requests.filter((r) => r.status !== 'PENDING');

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Software Approvals & Provisioning</h1>
          <p className="text-xs text-slate-500 mt-1">
            Review personnel software license requests, review pool availability recommendations, and authorize allocation.
          </p>
        </div>

        <button
          onClick={fetchPendingRequests}
          className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition self-start"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Section 1: Pending Approvals Queue */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>Pending Requests Awaiting Review ({pendingRequests.length})</span>
          </h2>
        </div>

        {pendingRequests.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {pendingRequests.map((req) => {
              const isDormantReclaimable = req.preCheck?.type === 'IDLE_SEAT_RECLAIMABLE';
              const isUnassignedAvailable = req.preCheck?.type === 'UNASSIGNED_AVAILABLE' || req.hasAvailableUnused;
              const topIdle = req.preCheck?.topIdleSeat;

              return (
                <div
                  key={req.id}
                  className={`p-6 rounded-3xl bg-white border transition-shadow shadow-sm hover:shadow-md flex flex-col justify-between ${
                    isDormantReclaimable
                      ? 'border-rose-200'
                      : isUnassignedAvailable
                      ? 'border-emerald-200'
                      : 'border-slate-200/80'
                  }`}
                >
                  <div>
                    {/* Header row */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                            isDormantReclaimable
                              ? 'bg-rose-50 text-rose-600'
                              : isUnassignedAvailable
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-blue-50 text-blue-600'
                          }`}
                        >
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-slate-900">{req.softwareName}</h3>
                          <p className="text-[11px] text-slate-500">
                            {req.category} • Requested by <span className="font-semibold text-slate-700">{req.user?.name}</span>
                            {req.user?.department?.name && ` (${req.user.department.name})`}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                          req.priority === 'URGENT' || req.priority === 'HIGH'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {req.priority}
                      </span>
                    </div>

                    {/* Justification & Comments */}
                    <div className="my-4 space-y-2 text-xs">
                      <div>
                        <span className="font-semibold text-slate-700">Reason: </span>
                        <span className="text-slate-600">{req.reason}</span>
                      </div>
                      {req.comments && (
                        <div>
                          <span className="font-semibold text-slate-700">Notes: </span>
                          <span className="text-slate-500">{req.comments}</span>
                        </div>
                      )}
                      {req.requiredDate && (
                        <div className="text-[11px] text-slate-400">
                          Needed by: {new Date(req.requiredDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {/* Intelligence Pre-Check Recommendation Banner */}
                    {isDormantReclaimable ? (
                      <div className="p-4 rounded-2xl bg-[#FDDCE5]/80 border border-[#F7B8C8] text-slate-900 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-rose-950">
                            <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                            <span>Pre-Check: Dormant Seat Detected (&gt;60d Idle)</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200/80 text-rose-900">
                            Saves ₹{req.preCheck?.annualSavings ? req.preCheck.annualSavings.toLocaleString('en-IN') : '0'}/yr
                          </span>
                        </div>

                        <div className="text-[11px] bg-white/70 p-2.5 rounded-xl border border-rose-200 space-y-1">
                          <div className="flex items-center justify-between text-slate-800">
                            <span>Dormant User:</span>
                            <span className="font-bold text-rose-900">
                              {topIdle?.userName || 'Assigned User'} ({topIdle?.departmentName || 'General'})
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-800">
                            <span>Inactivity Period:</span>
                            <span className="font-bold text-rose-700">{topIdle?.daysInactive} days inactive</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-800">
                            <span>Reclamation Impact:</span>
                            <span className="font-bold text-emerald-800">
                              ₹0 new procurement cost (Reallocate existing seat)
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-rose-900 leading-relaxed font-medium">
                          💡 {req.intelligenceRecommendation || req.preCheck?.message}
                        </p>

                        {req.preCheck?.idleSeatsCount > 1 && (
                          <p className="text-[10px] text-rose-700 italic">
                            +{req.preCheck.idleSeatsCount - 1} other dormant seat(s) also available in this software pool.
                          </p>
                        )}
                      </div>
                    ) : isUnassignedAvailable ? (
                      <div className="p-4 rounded-2xl bg-[#D7EFEA]/80 border border-[#A8DDD5] text-slate-900 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-950">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Pre-Check: Unassigned Pool Seat Available</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900">
                            ₹0 New Cost
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-emerald-950 font-medium">
                          {req.intelligenceRecommendation || req.preCheck?.message || `Allocate existing unassigned seat (${req.availableUnusedSeats} available in pool).`}
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-950 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900">
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                          <span>Pre-Check: Procurement Required</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-700">
                          {req.intelligenceRecommendation || req.preCheck?.message || 'No unassigned or >60d idle seats available in software pool. Approving will authorize new license procurement.'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Decision Actions */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                    <button
                      disabled={actionLoadingId === req.id}
                      onClick={() => handleDecision(req.id, 'REJECTED')}
                      className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs transition disabled:opacity-50"
                    >
                      Reject
                    </button>

                    {isDormantReclaimable ? (
                      <>
                        <button
                          disabled={actionLoadingId === req.id}
                          onClick={() => handleDecision(req.id, 'APPROVED', 'PURCHASE_NEW')}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition disabled:opacity-50"
                          title="Skip reclamation and authorize purchasing a new seat"
                        >
                          Authorize Purchase Instead
                        </button>
                        <button
                          disabled={actionLoadingId === req.id}
                          onClick={() =>
                            handleDecision(
                              req.id,
                              'APPROVED',
                              'RECLAIM_AND_ASSIGN',
                              topIdle?.assignmentId
                            )
                          }
                          className="px-4 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-md shadow-rose-700/20 transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Reclaim Idle Seat &amp; Approve</span>
                        </button>
                      </>
                    ) : isUnassignedAvailable ? (
                      <button
                        disabled={actionLoadingId === req.id}
                        onClick={() => handleDecision(req.id, 'APPROVED', 'ALLOCATE_EXISTING')}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Approve &amp; Allocate Existing Seat</span>
                      </button>
                    ) : (
                      <button
                        disabled={actionLoadingId === req.id}
                        onClick={() => handleDecision(req.id, 'APPROVED', 'PURCHASE_NEW')}
                        className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Approve Procurement</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 bg-white rounded-3xl border border-slate-200/80 text-center shadow-sm">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-slate-800">All caught up!</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">No pending software requests awaiting review.</p>
          </div>
        )}
      </div>

      {/* Section 2: Historical Approvals */}
      <div className="space-y-3 pt-6">
        <h2 className="text-sm font-bold text-slate-900">Decision History ({pastDecisions.length})</h2>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Software</th>
                  <th className="py-3 px-4">Requester</th>
                  <th className="py-3 px-4">Decision</th>
                  <th className="py-3 px-4">Action Taken</th>
                  <th className="py-3 px-4">Reviewed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pastDecisions.map((r) => {
                  const firstApproval = r.approvals?.[0];
                  const isFulfilledReuse = r.status === 'FULFILLED_EXISTING';
                  const actionLabel = firstApproval?.actionTaken
                    ? firstApproval.actionTaken === 'ASSIGNED_EXISTING'
                      ? 'Reallocated / Pool Assigned'
                      : firstApproval.actionTaken.replace('_', ' ')
                    : 'Processed';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{r.softwareName}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{r.user?.name}</div>
                        <div className="text-[10px] text-slate-400">{r.user?.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            r.status === 'APPROVED' || r.status === 'FULFILLED_EXISTING'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {isFulfilledReuse ? 'Fulfilled (Reuse)' : r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        <div>{actionLabel}</div>
                        {firstApproval?.comments && (
                          <div className="text-[10px] text-slate-400 truncate max-w-xs" title={firstApproval.comments}>
                            {firstApproval.comments}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {firstApproval?.approvedBy?.name || 'Authorized Manager'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
