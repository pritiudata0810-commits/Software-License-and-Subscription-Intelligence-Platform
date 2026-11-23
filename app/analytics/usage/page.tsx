'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Layers,
  RefreshCw,
  Info,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  Zap,
  Coins,
  Users,
  Sparkles,
  Calendar,
  ArrowUpRight,
  Activity,
  Clock,
  Search,
  UserCheck,
  UserX,
  UserMinus,
  FileSpreadsheet,
  Plus,
  X
} from 'lucide-react';
import { exportToCsv } from '@/lib/exportCsv';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

export default function UsageAnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [consumption, setConsumption] = useState<any>(null);
  const [consumptionView, setConsumptionView] = useState<'monthly' | 'yearly'>('yearly');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [consumptionLoading, setConsumptionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(70);
  const [seatFilter, setSeatFilter] = useState<'ALL' | 'OPTIMAL' | 'UNDERUTILIZED' | 'IDLE_60D' | 'UNASSIGNED'>('ALL');
  const [seatSearch, setSeatSearch] = useState('');

  // Telemetry Activity Ledger State (Phase 4)
  const [telemetryLogs, setTelemetryLogs] = useState<any[]>([]);
  const [telemetryTotal, setTelemetryTotal] = useState(0);
  const [telemetryPage, setTelemetryPage] = useState(1);
  const [telemetryTotalPages, setTelemetryTotalPages] = useState(1);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [telemetryTierFilter, setTelemetryTierFilter] = useState<'ALL' | 'OPTIMAL' | 'UNDERUTILIZED' | 'IDLE_60D'>('ALL');
  const [telemetrySearch, setTelemetrySearch] = useState('');
  const [telemetryCollapsed, setTelemetryCollapsed] = useState(false);

  // Quick Test Telemetry Modal State
  const [showLogModal, setShowLogModal] = useState(false);
  const [logFormData, setLogFormData] = useState({
    userEmail: '',
    softwareName: '',
    hoursUsed: 2.5,
    loginCount: 1,
    lastActiveDate: new Date().toISOString().split('T')[0],
    actionNote: 'User telemetry session logged via Admin Activity Ledger',
  });
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logError, setLogError] = useState('');
  const [logSuccess, setLogSuccess] = useState('');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      if (data.success) setAnalytics(data.analytics);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConsumption = async (yr: number = selectedYear) => {
    setConsumptionLoading(true);
    try {
      const res = await fetch(`/api/analytics/consumption?year=${yr}`);
      const data = await res.json();
      if (data.success) setConsumption(data);
    } catch (err) {
      console.error('Error loading consumption analytics:', err);
    } finally {
      setConsumptionLoading(false);
    }
  };

  const fetchTelemetryLogs = async (pageNum = 1) => {
    setTelemetryLoading(true);
    try {
      const url = new URL('/api/usage-logs', window.location.origin);
      url.searchParams.set('page', pageNum.toString());
      url.searchParams.set('limit', '25');
      if (telemetryTierFilter !== 'ALL') url.searchParams.set('tier', telemetryTierFilter);
      if (telemetrySearch.trim()) url.searchParams.set('search', telemetrySearch.trim());

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setTelemetryLogs(data.logs || []);
        setTelemetryTotal(data.total || 0);
        setTelemetryPage(data.page || 1);
        setTelemetryTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching telemetry logs:', err);
    } finally {
      setTelemetryLoading(false);
    }
  };

  const handleQuickLogTelemetry = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogError('');
    setLogSuccess('');
    setLogSubmitting(true);

    try {
      const res = await fetch('/api/usage-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logFormData),
      });
      const data = await res.json();
      if (data.success) {
        setLogSuccess(data.message || 'Telemetry event logged successfully.');
        setShowLogModal(false);
        fetchTelemetryLogs(1);
        fetchAnalytics(); // Refresh classification metrics as well
      } else {
        setLogError(data.error || 'Failed to record telemetry.');
      }
    } catch (err: any) {
      setLogError(err.message || 'Error communicating with telemetry API.');
    } finally {
      setLogSubmitting(false);
    }
  };

  const handleExportTelemetryCSV = () => {
    if (!telemetryLogs || telemetryLogs.length === 0) return;

    const headers = [
      'Timestamp (Last Active)',
      'Employee Name',
      'Employee Email',
      'Role',
      'Department',
      'Software Name',
      'Category',
      'Hours Used',
      'Login Count',
      'Days Inactive',
      'Classification Tier',
      'Recorded At',
    ];

    const rows = telemetryLogs.map((l: any) => [
      l.lastActiveDate,
      l.userName,
      l.userEmail,
      l.userRole,
      l.departmentName,
      l.softwareName,
      l.softwareCategory,
      l.hoursUsed,
      l.loginCount,
      l.daysInactive,
      l.classificationLabel,
      l.recordedAt,
    ]);

    exportToCsv(`Telemetry_Activity_Ledger_${new Date().toISOString().split('T')[0]}`, headers, rows);
  };

  const handleExportSeatClassificationCSV = () => {
    if (!filteredSeats || filteredSeats.length === 0) return;

    const headers = [
      'Seat ID',
      'Employee Name',
      'Employee Email',
      'Department',
      'Software Name',
      'Unit Cost (₹)',
      'Billing Frequency',
      'Last Active Date',
      'Days Inactive',
      'Hours Used',
      'Login Count',
      '4-Tier Classification',
      'Reclaimable Monthly Cost (₹)',
      'Reclaimable Annual Cost (₹)',
    ];

    const rows = filteredSeats.map((s: any) => [
      s.seatId,
      s.userName,
      s.userEmail,
      s.departmentName,
      s.softwareName,
      s.costPerLicense,
      s.billingFrequency,
      s.lastActiveDate || 'N/A',
      s.daysInactive,
      s.hoursUsed,
      s.loginCount,
      s.tier,
      s.reclaimableCostMonthly,
      s.reclaimableCostAnnual,
    ]);

    exportToCsv(`4Tier_Seat_Classification_Export_${new Date().toISOString().split('T')[0]}`, headers, rows);
  };

  useEffect(() => {
    fetchAnalytics();
    fetchConsumption(selectedYear);
    fetchTelemetryLogs(1);
  }, []);

  useEffect(() => {
    fetchTelemetryLogs(1);
  }, [telemetryTierFilter]);

  const handleYearChange = (yr: number) => {
    setSelectedYear(yr);
    fetchConsumption(yr);
  };

  if (loading && !analytics) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Computing software utilization metrics...</p>
      </div>
    );
  }

  const softwareBreakdown = analytics?.softwareBreakdown || [];

  // Group by classification
  const classificationCounts = {
    EXCELLENT: softwareBreakdown.filter((s: any) => s.utilizationRate >= 90).length,
    GOOD: softwareBreakdown.filter((s: any) => s.utilizationRate >= 75 && s.utilizationRate < 90).length,
    MODERATE: softwareBreakdown.filter((s: any) => s.utilizationRate >= 50 && s.utilizationRate < 75).length,
    LOW: softwareBreakdown.filter((s: any) => s.utilizationRate >= 25 && s.utilizationRate < 50).length,
    CRITICAL: softwareBreakdown.filter((s: any) => s.utilizationRate < 25).length,
  };

  const pieData = [
    { name: 'Excellent (≥90%)', value: classificationCounts.EXCELLENT, color: '#10B981' },
    { name: 'Good (75-89%)', value: classificationCounts.GOOD, color: '#3B82F6' },
    { name: 'Moderate (50-74%)', value: classificationCounts.MODERATE, color: '#F59E0B' },
    { name: 'Low (25-49%)', value: classificationCounts.LOW, color: '#F97316' },
    { name: 'Critical (<25%)', value: classificationCounts.CRITICAL, color: '#EF4444' },
  ].filter((d) => d.value > 0);

  const underutilizedAtThreshold = softwareBreakdown.filter((s: any) => s.utilizationRate < threshold);

  const formatINR = (val: number) => `₹${Math.round(val || 0).toLocaleString('en-IN')}`;

  const seatSummary = analytics?.seatClassificationSummary || {
    optimalSeats: 0,
    underutilizedSeats: 0,
    idleSeats60d: 0,
    unassignedSeats: 0,
    totalSeats: 0,
    idle60dMonthlyWaste: 0,
    idle60dAnnualWaste: 0,
    unassignedMonthlyWaste: 0,
    unassignedAnnualWaste: 0,
  };

  const seatClassifications: any[] = analytics?.seatClassifications || [];

  const filteredSeats = seatClassifications.filter((seat: any) => {
    if (seatFilter !== 'ALL' && seat.tier !== seatFilter) return false;
    if (!seatSearch.trim()) return true;
    const q = seatSearch.toLowerCase();
    return (
      seat.userName?.toLowerCase().includes(q) ||
      seat.userEmail?.toLowerCase().includes(q) ||
      seat.softwareName?.toLowerCase().includes(q) ||
      seat.departmentName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Usage & Utilization Analytics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Mathematical license utilization formulas, efficiency tiers, and idle seat diagnostics.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition self-start"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Recalculate</span>
        </button>
      </div>

      {/* Formula Documentation Card */}
      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900">
          <div className="font-bold">Utilization Formula:</div>
          <div className="font-mono text-[11px] mt-0.5 text-blue-800">
            Utilization (%) = (Active Licenses / Total Licenses) × 100
          </div>
          <div className="text-[10px] text-blue-700 mt-1">
            Classifications: Excellent (≥90%) • Good (75–89%) • Moderate (50–74%) • Low (25–49%) • Critical (&lt;25%)
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Overall Platform Utilization</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {analytics?.overallUtilization || 0}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {analytics?.activeLicenses || 0} active / {analytics?.totalLicenses || 0} total seats
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Available (Idle) Capacity</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {analytics?.availableLicenses || 0} Seats
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Ready for instant employee assignment
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Underutilized Products</span>
          <div className="text-2xl font-bold text-rose-600 mt-1">
            {underutilizedAtThreshold.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Below configured {threshold}% threshold
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Configurable Threshold</span>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="range"
              min="30"
              max="90"
              step="5"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <span className="text-sm font-bold text-blue-600">{threshold}%</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Drag slider to adjust low benchmark</div>
        </div>
      </div>

      {/* Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier Distribution Pie Chart */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Efficiency Tier Distribution</h2>
          <p className="text-[10px] text-slate-500 mb-4">Proportion of software portfolio by utilization tier</p>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: string) => [`${val} software product(s)`, name]}
                  contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #E2E8F0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-slate-600">{d.name}</span>
                </div>
                <span className="font-bold text-slate-900">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar Chart comparing Active vs Unused across catalog */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 mb-1">Active vs Unused Seat Allocation</h2>
            <p className="text-[10px] text-slate-500 mb-4">Detailed seat distribution across all managed software</p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={softwareBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="softwareName" tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #E2E8F0' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="activeLicenses" fill="#2563EB" name="Active Seats" stackId="a" />
                  <Bar dataKey="unusedLicenses" fill="#CBD5E1" name="Unused Seats" stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Software Utilization Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-900">Software Utilization Breakdown</h2>
          <span className="text-[11px] text-slate-500">{softwareBreakdown.length} software entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Software</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Active</th>
                <th className="py-3 px-4">Unused</th>
                <th className="py-3 px-4">Utilization Rate</th>
                <th className="py-3 px-4">Classification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {softwareBreakdown.map((sw: any) => (
                <tr key={sw.softwareId} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-bold text-slate-900">{sw.softwareName}</td>
                  <td className="py-3 px-4 text-slate-500">{sw.category}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{sw.totalLicenses}</td>
                  <td className="py-3 px-4 font-semibold text-blue-600">{sw.activeLicenses}</td>
                  <td className="py-3 px-4 font-semibold text-rose-500">{sw.unusedLicenses}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            sw.utilizationRate >= 75 ? 'bg-emerald-500' : sw.utilizationRate >= 50 ? 'bg-blue-600' : 'bg-rose-500'
                          }`}
                          style={{ width: `${sw.utilizationRate}%` }}
                        />
                      </div>
                      <span className="font-bold">{sw.utilizationRate}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        sw.classification === 'EXCELLENT'
                          ? 'bg-emerald-100 text-emerald-700'
                          : sw.classification === 'GOOD'
                          ? 'bg-blue-100 text-blue-700'
                          : sw.classification === 'MODERATE'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {sw.classification}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION: 4-TIER SEAT CLASSIFICATION & INACTIVITY TRACKING */}
      {/* ============================================================== */}
      <div id="seat-classification" className="space-y-6 pt-6 border-t border-slate-200/60">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>Seat-Level Intelligence</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                60-Day Inactivity Tracking
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1.5 flex items-center gap-2">
              <span>4-Tier Seat Classification &amp; Inactivity Tracking</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Individual employee seat diagnostics grounded in real usage records. Flags active licenses dormant for &gt;60 days for immediate cost reclamation.
            </p>
          </div>
        </div>

        {/* 4-Tier Summary Cards (Pastel Themed) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Optimal (Mint #D7EFEA) */}
          <div className="p-5 rounded-[28px] bg-[#D7EFEA] border border-teal-100/50 shadow-xs flex flex-col justify-between min-h-[150px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-slate-900" />
                <span>Optimal Seats</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 text-teal-900 shadow-2xs">
                Active ≤30d
              </span>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {seatSummary.optimalSeats}
                </span>
                <span className="text-xs font-bold text-teal-800">
                  {seatSummary.totalSeats > 0 ? Math.round((seatSummary.optimalSeats / seatSummary.totalSeats) * 100) : 0}% of total
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium mt-1 truncate">
                Healthy session engagement (≥10h / regular logins)
              </p>
            </div>
          </div>

          {/* Card 2: Underutilized (Lemon #FEF1C9) */}
          <div className="p-5 rounded-[28px] bg-[#FEF1C9] border border-amber-100/50 shadow-xs flex flex-col justify-between min-h-[150px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-slate-900" />
                <span>Underutilized</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 text-amber-900 shadow-2xs">
                31–60d / Low Hrs
              </span>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {seatSummary.underutilizedSeats}
                </span>
                <span className="text-xs font-bold text-amber-800">
                  {seatSummary.totalSeats > 0 ? Math.round((seatSummary.underutilizedSeats / seatSummary.totalSeats) * 100) : 0}% of total
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium mt-1 truncate">
                Infrequent usage or low engagement (&lt;10h)
              </p>
            </div>
          </div>

          {/* Card 3: Idle >60d (Rose #FDDCE5) */}
          <div className="p-5 rounded-[28px] bg-[#FDDCE5] border border-rose-100/50 shadow-xs flex flex-col justify-between min-h-[150px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <UserX className="w-3.5 h-3.5 text-rose-800" />
                <span>Idle (&gt;60d Dormant)</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-900 border border-rose-500/30">
                Action Required
              </span>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-2xl font-black text-rose-950 tracking-tight">
                  {seatSummary.idleSeats60d}
                </span>
                <span className="text-xs font-bold text-rose-800">
                  {formatINR(seatSummary.idle60dMonthlyWaste)}/mo
                </span>
              </div>
              <p className="text-[11px] text-rose-800 font-medium mt-1 truncate">
                Zero activity in &gt;60d • Reclaim ₹{Math.round(seatSummary.idle60dAnnualWaste).toLocaleString('en-IN')}/yr
              </p>
            </div>
          </div>

          {/* Card 4: Unassigned Pool Headroom (Lavender #E3DCFD) */}
          <div className="p-5 rounded-[28px] bg-[#E3DCFD] border border-purple-100/50 shadow-xs flex flex-col justify-between min-h-[150px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <UserMinus className="w-3.5 h-3.5 text-slate-900" />
                <span>Unassigned Seats</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 text-purple-900 shadow-2xs">
                Pool Headroom
              </span>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {seatSummary.unassignedSeats}
                </span>
                <span className="text-xs font-bold text-purple-800">
                  {formatINR(seatSummary.unassignedMonthlyWaste)}/mo
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium mt-1 truncate">
                Purchased pool capacity ready for instant assignment
              </p>
            </div>
          </div>

        </div>

        {/* Interactive Filterable Seat-Level Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          
          {/* Controls Bar: Search & Tier Filter Buttons */}
          <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Seat-Level Activity &amp; Inactivity Audit</h3>
              <p className="text-[11px] text-slate-500">Showing {filteredSeats.length} of {seatClassifications.length} total seats</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search employee, software, or dept..."
                  value={seatSearch}
                  onChange={(e) => setSeatSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 w-full sm:w-60"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSeatFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    seatFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({seatClassifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSeatFilter('IDLE_60D')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 ${
                    seatFilter === 'IDLE_60D'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-rose-700 hover:text-rose-900'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${seatFilter === 'IDLE_60D' ? 'bg-white' : 'bg-rose-500'}`} />
                  Idle &gt;60d ({seatSummary.idleSeats60d})
                </button>
                <button
                  type="button"
                  onClick={() => setSeatFilter('UNDERUTILIZED')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 ${
                    seatFilter === 'UNDERUTILIZED'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-amber-700 hover:text-amber-900'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${seatFilter === 'UNDERUTILIZED' ? 'bg-white' : 'bg-amber-500'}`} />
                  Underutilized ({seatSummary.underutilizedSeats})
                </button>
                <button
                  type="button"
                  onClick={() => setSeatFilter('OPTIMAL')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 ${
                    seatFilter === 'OPTIMAL'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-emerald-700 hover:text-emerald-900'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${seatFilter === 'OPTIMAL' ? 'bg-white' : 'bg-emerald-500'}`} />
                  Optimal ({seatSummary.optimalSeats})
                </button>
                <button
                  type="button"
                  onClick={() => setSeatFilter('UNASSIGNED')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 ${
                    seatFilter === 'UNASSIGNED'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'text-purple-700 hover:text-purple-900'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${seatFilter === 'UNASSIGNED' ? 'bg-white' : 'bg-purple-500'}`} />
                  Unassigned ({seatSummary.unassignedSeats})
                </button>
                <button
                  type="button"
                  onClick={handleExportSeatClassificationCSV}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition flex items-center gap-1 shadow-2xs ml-1"
                  title="Export 4-Tier Seat Classification to CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Seat Table */}
          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100 sticky top-0 z-10 shadow-2xs">
                <tr>
                  <th className="py-3 px-4">Employee / Seat</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Software &amp; License</th>
                  <th className="py-3 px-4">Last Active</th>
                  <th className="py-3 px-4">Days Inactive</th>
                  <th className="py-3 px-4">Usage Engagement</th>
                  <th className="py-3 px-4">4-Tier Status</th>
                  <th className="py-3 px-4">Reclaimable Waste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSeats.length > 0 ? (
                  filteredSeats.map((seat: any) => {
                    const isIdle60 = seat.tier === 'IDLE_60D';
                    const isUnder = seat.tier === 'UNDERUTILIZED';
                    const isOpt = seat.tier === 'OPTIMAL';
                    const isUnassigned = seat.tier === 'UNASSIGNED';

                    return (
                      <tr
                        key={seat.seatId}
                        className={`transition ${
                          isIdle60
                            ? 'bg-rose-50/40 hover:bg-rose-50/70'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                isIdle60
                                  ? 'bg-rose-100 text-rose-800'
                                  : isUnder
                                  ? 'bg-amber-100 text-amber-800'
                                  : isUnassigned
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isUnassigned
                                ? 'P'
                                : (seat.userName
                                    .split(' ')
                                    .map((n: string) => n[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase() || 'U')}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate">{seat.userName}</div>
                              <div className="text-[11px] text-slate-400 truncate">{seat.userEmail}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px]">
                            {seat.departmentName}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 truncate">{seat.softwareName}</div>
                          <div className="text-[10px] text-slate-400">
                            {formatINR(seat.costPerLicense)} / {seat.billingFrequency?.toLowerCase() || 'mo'}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          {seat.lastActiveDate ? (
                            new Date(seat.lastActiveDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          ) : (
                            <span className="text-slate-400 italic">No activity recorded</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {seat.daysInactive < 0 ? (
                            <span className="text-slate-400 font-medium">Unassigned</span>
                          ) : isIdle60 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-full text-[10px]">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              {seat.daysInactive}d inactive (&gt;60d)
                            </span>
                          ) : isUnder ? (
                            <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[10px]">
                              {seat.daysInactive}d inactive
                            </span>
                          ) : (
                            <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                              {seat.daysInactive}d inactive
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {isUnassigned ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <div>
                              <span className="font-bold text-slate-900">{seat.hoursUsed} hrs</span>
                              <span className="text-[11px] text-slate-400 ml-1">({seat.loginCount} logins)</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                              isOpt
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : isUnder
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : isIdle60
                                ? 'bg-rose-100 text-rose-800 border-rose-300 font-black'
                                : 'bg-purple-100 text-purple-800 border-purple-200'
                            }`}
                          >
                            {seat.tier === 'IDLE_60D'
                              ? 'Idle (>60d)'
                              : seat.tier === 'UNDERUTILIZED'
                              ? 'Underutilized'
                              : seat.tier === 'OPTIMAL'
                              ? 'Optimal'
                              : 'Unassigned'}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-bold">
                          {isIdle60 ? (
                            <span className="text-rose-700">
                              {formatINR(seat.reclaimableCostMonthly)}/mo
                            </span>
                          ) : isUnassigned ? (
                            <span className="text-purple-700 font-semibold">
                              {formatINR(seat.reclaimableCostMonthly)}/mo
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                      No seats match the selected filter or search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ============================================================== */}
      {/* SECTION: TELEMETRY ACTIVITY LEDGER (usage_logs) (PHASE 4)     */}
      {/* ============================================================== */}
      <div id="telemetry-ledger" className="space-y-6 pt-6 border-t border-slate-200/60">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-3 h-3" />
                <span>Real-time Telemetry Ingestion (usage_records)</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                PostgreSQL Grounded
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1.5 flex items-center gap-2">
              <span>Telemetry Activity Logs (<code className="text-sm font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">usage_logs</code>)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Auditable activity ledger capturing raw employee client telemetry, active sessions, engagement hours, and automated 4-tier classification.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setLogError('');
                setLogSuccess('');
                setShowLogModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Test Telemetry Event</span>
            </button>

            <button
              type="button"
              onClick={handleExportTelemetryCSV}
              disabled={telemetryLogs.length === 0}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              title="Export all telemetry records to RFC 4180 CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => fetchTelemetryLogs(telemetryPage)}
              className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-2xs"
              title="Refresh Telemetry Ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${telemetryLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setTelemetryCollapsed(!telemetryCollapsed)}
              className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-2xs"
              title={telemetryCollapsed ? 'Expand Ledger' : 'Collapse Ledger'}
            >
              {telemetryCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {!telemetryCollapsed && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Filter & Search Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
              <div className="relative w-full md:w-80">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search employee, email, software..."
                  value={telemetrySearch}
                  onChange={(e) => setTelemetrySearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') fetchTelemetryLogs(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition placeholder:text-slate-400"
                />
              </div>

              {/* 4-Tier Filter Badges */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
                <span className="text-slate-400 text-[11px] mr-1 hidden sm:inline">Tier:</span>
                <button
                  type="button"
                  onClick={() => setTelemetryTierFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    telemetryTierFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                  }`}
                >
                  All ({telemetryTotal})
                </button>
                <button
                  type="button"
                  onClick={() => setTelemetryTierFilter('OPTIMAL')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                    telemetryTierFilter === 'OPTIMAL'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-slate-200/80'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${telemetryTierFilter === 'OPTIMAL' ? 'bg-white' : 'bg-emerald-500'}`} />
                  Optimal
                </button>
                <button
                  type="button"
                  onClick={() => setTelemetryTierFilter('UNDERUTILIZED')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                    telemetryTierFilter === 'UNDERUTILIZED'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-white text-amber-700 hover:bg-amber-50 border border-slate-200/80'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${telemetryTierFilter === 'UNDERUTILIZED' ? 'bg-white' : 'bg-amber-500'}`} />
                  Underutilized
                </button>
                <button
                  type="button"
                  onClick={() => setTelemetryTierFilter('IDLE_60D')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                    telemetryTierFilter === 'IDLE_60D'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-white text-rose-700 hover:bg-rose-50 border border-slate-200/80'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${telemetryTierFilter === 'IDLE_60D' ? 'bg-white' : 'bg-rose-500'}`} />
                  Idle (&gt;60d)
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="py-3 px-4">Last Active Timestamp</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Software Application</th>
                    <th className="py-3 px-4">Engagement (Hours / Logins)</th>
                    <th className="py-3 px-4">Days Inactive</th>
                    <th className="py-3 px-4">4-Tier Classification</th>
                    <th className="py-3 px-4">Ingested At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {telemetryLoading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                          <span>Loading telemetry records...</span>
                        </div>
                      </td>
                    </tr>
                  ) : telemetryLogs.length > 0 ? (
                    telemetryLogs.map((log: any) => {
                      const isIdle60 = log.classificationTier === 'IDLE_60D';
                      const isUnder = log.classificationTier === 'UNDERUTILIZED';
                      const isOpt = log.classificationTier === 'OPTIMAL';

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{log.lastActiveDate ? new Date(log.lastActiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{log.userName || 'Unknown'}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1">
                              <span>{log.userEmail}</span>
                              {log.departmentName && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-500 font-medium">{log.departmentName}</span>
                                </>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{log.softwareName}</div>
                            {log.softwareCategory && (
                              <div className="text-[10px] text-slate-400">{log.softwareCategory}</div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900">{log.hoursUsed} hrs</span>
                            <span className="text-[11px] text-slate-400 ml-1.5">({log.loginCount} logins)</span>
                          </td>

                          <td className="py-3 px-4">
                            {isIdle60 ? (
                              <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-full text-[10px]">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                {log.daysInactive}d inactive (&gt;60d)
                              </span>
                            ) : isUnder ? (
                              <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[10px]">
                                {log.daysInactive}d inactive
                              </span>
                            ) : (
                              <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                                {log.daysInactive}d inactive
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                                isOpt
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : isUnder
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : isIdle60
                                  ? 'bg-rose-100 text-rose-800 border-rose-300 font-black'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {log.classificationLabel || log.classificationTier}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">
                            {log.recordedAt ? new Date(log.recordedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        No telemetry logs found. Click &quot;Log Test Telemetry Event&quot; to ingest test usage data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {telemetryTotalPages > 1 && (
              <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
                <span>
                  Showing page <span className="font-bold text-slate-900">{telemetryPage}</span> of <span className="font-bold text-slate-900">{telemetryTotalPages}</span> ({telemetryTotal} total logs)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={telemetryPage <= 1}
                    onClick={() => fetchTelemetryLogs(telemetryPage - 1)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition font-semibold"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={telemetryPage >= telemetryTotalPages}
                    onClick={() => fetchTelemetryLogs(telemetryPage + 1)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition font-semibold"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* SECTION: LICENSE & TOKEN CONSUMPTION INTELLIGENCE (NEW VISIBLE UI) */}
      {/* ============================================================== */}
      <div id="tokens" className="space-y-6 pt-6 border-t border-slate-200/60">
        
        {/* Section Header with Monthly / Yearly Toggle & Year Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                <span>AI & API Quota Intelligence</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                PostgreSQL Grounded
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1.5 flex items-center gap-2">
              <span>License & Token Consumption</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enterprise LLM quotas, consumed tokens, remaining headroom, financial impact, and employee consumption audit.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* Monthly / Yearly Toggle Switch */}
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center shadow-inner">
              <button
                type="button"
                onClick={() => setConsumptionView('monthly')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  consumptionView === 'monthly'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setConsumptionView('yearly')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  consumptionView === 'yearly'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yearly
              </button>
            </div>

            {/* Year Selector Pills (Visible when Yearly is active) */}
            {consumptionView === 'yearly' && (
              <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs">
                {[2024, 2025, 2026].map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => handleYearChange(yr)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                      selectedYear === yr
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => fetchConsumption(selectedYear)}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs shadow-2xs transition"
              title="Refresh Token Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${consumptionLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {consumptionLoading && (
          <div className="p-12 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500">Querying PostgreSQL token consumption and employee quotas...</p>
          </div>
        )}

        {/* Empty State when no token data exists for selected period */}
        {!consumptionLoading && (!consumption?.tokenBased || consumption.tokenBased.length === 0) && (
          <div className="p-10 rounded-3xl bg-white border border-dashed border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              No token-based software usage data available for {consumptionView === 'yearly' ? selectedYear : 'current month'}.
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Token tracking was provisioned for 2026. Select 2026 in the year picker to review active enterprise AI token consumption.
            </p>
            {consumptionView === 'yearly' && selectedYear !== 2026 && (
              <button
                type="button"
                onClick={() => handleYearChange(2026)}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
              >
                Switch to Active Year (2026)
              </button>
            )}
          </div>
        )}

        {/* Token Products Cards & Tables */}
        {!consumptionLoading && consumption?.tokenBased?.map((tk: any) => {
          // Select dataset according to Monthly vs Yearly view
          const activeData = consumptionView === 'monthly' && tk.monthly ? tk.monthly : (tk.yearly || tk);
          const allocated = activeData.allocatedTokens || tk.allocatedTokens;
          const used = activeData.usedTokens || tk.usedTokens;
          const remaining = Math.max(0, allocated - used);
          const utilRate = activeData.utilizationPercentage || tk.utilizationPercentage;
          const totalCost = activeData.totalCost || tk.totalCost;
          const usedCost = activeData.usedCost || tk.usedCost;
          const unusedCost = activeData.unusedCapacityCost || tk.unusedCapacityCost;
          const status = activeData.status || tk.status;
          const employees = activeData.employeeUsage || tk.employeeUsage || [];

          return (
            <div key={tk.softwareId} className="space-y-6">
              
              {/* Product Header Card with Pastel Tone & Status */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 border border-indigo-100/80 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-md">
                      <Sparkles className="w-6 h-6 text-indigo-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900 leading-tight">
                          {tk.softwareName}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase tracking-wider">
                          TOKEN_BASED
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {tk.vendorName} • {tk.category} • Unit Rate: ₹{tk.tokenUnitCost}/token
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <div className={`px-3 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-2xs ${
                      status === 'Near Limit'
                        ? 'bg-rose-100 text-rose-800'
                        : status === 'High Usage'
                        ? 'bg-amber-100 text-amber-800'
                        : status === 'Healthy'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      <Activity className="w-3.5 h-3.5" />
                      <span>{utilRate}% → {status}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      ({consumptionView === 'yearly' ? `${selectedYear} Annual Quota` : 'Current Month'})
                    </span>
                  </div>
                </div>

                {/* 4 Financial & Token KPI Blocks */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  
                  {/* Block 1: Allocated */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Allocated Tokens
                    </span>
                    <div className="text-xl md:text-2xl font-black text-slate-900 mt-1">
                      {allocated >= 1000000 ? `${(allocated / 1000000).toFixed(1)}M` : allocated.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {allocated.toLocaleString()} tokens
                    </div>
                  </div>

                  {/* Block 2: Used */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Used Tokens
                    </span>
                    <div className="text-xl md:text-2xl font-black text-indigo-600 mt-1">
                      {used >= 1000000 ? `${(used / 1000000).toFixed(1)}M` : used.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-indigo-700 font-medium mt-0.5">
                      {utilRate}% consumed
                    </div>
                  </div>

                  {/* Block 3: Remaining */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Remaining Tokens
                    </span>
                    <div className="text-xl md:text-2xl font-black text-emerald-600 mt-1">
                      {remaining >= 1000000 ? `${(remaining / 1000000).toFixed(1)}M` : remaining.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                      {remaining.toLocaleString()} reserve
                    </div>
                  </div>

                  {/* Block 4: Financial Cost */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Financial Impact
                    </span>
                    <div className="text-xl md:text-2xl font-black text-slate-900 mt-1">
                      ₹{usedCost.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Total: ₹{totalCost.toLocaleString('en-IN')} • Waste: <span className="text-amber-700 font-bold">₹{unusedCost.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                </div>

                {/* Visual Utilization Progress Bar */}
                <div className="mt-6 p-4 rounded-2xl bg-white/80 border border-indigo-100">
                  <div className="flex items-center justify-between text-xs font-semibold mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      <span className="text-slate-800">Used: {used.toLocaleString()} ({utilRate}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-slate-800">Remaining: {remaining.toLocaleString()} ({Math.max(0, 100 - utilRate).toFixed(1)}%)</span>
                    </div>
                  </div>

                  <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
                    <div
                      className="bg-indigo-600 h-full rounded-l-full transition-all duration-500"
                      style={{ width: `${Math.min(100, utilRate)}%` }}
                    />
                    <div
                      className="bg-emerald-500 h-full rounded-r-full transition-all duration-500"
                      style={{ width: `${Math.max(0, 100 - utilRate)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                    <span>0 Tokens</span>
                    <span className="font-semibold text-slate-600">{tk.statusExplanation}</span>
                    <span>{allocated.toLocaleString()} Tokens Max</span>
                  </div>
                </div>

              </div>

              {/* Employee Token Consumption Ledger Table */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Employee Token Consumption</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Direct individual consumption records extracted from PostgreSQL usage ledger
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                    {employees.length} Tracked Employees
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Allocated</th>
                        <th className="py-3 px-4">Used</th>
                        <th className="py-3 px-4">Remaining</th>
                        <th className="py-3 px-4">Utilization</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {employees.map((emp: any) => (
                        <tr key={emp.userId} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{emp.name}</div>
                            <div className="text-[11px] text-slate-400">{emp.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{emp.department}</div>
                            {emp.designation && (
                              <div className="text-[10px] text-slate-400">{emp.designation}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {emp.allocatedTokens >= 1000000
                              ? `${(emp.allocatedTokens / 1000000).toFixed(1)}M`
                              : emp.allocatedTokens.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-bold text-indigo-600">
                            {emp.usedTokens >= 1000000
                              ? `${(emp.usedTokens / 1000000).toFixed(1)}M`
                              : emp.usedTokens.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-semibold text-emerald-600">
                            {emp.remainingTokens >= 1000000
                              ? `${(emp.remainingTokens / 1000000).toFixed(1)}M`
                              : emp.remainingTokens.toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    emp.utilizationPercentage >= 96
                                      ? 'bg-rose-500'
                                      : emp.utilizationPercentage >= 81
                                      ? 'bg-amber-500'
                                      : emp.utilizationPercentage >= 41
                                      ? 'bg-emerald-500'
                                      : 'bg-slate-400'
                                  }`}
                                  style={{ width: `${Math.min(100, emp.utilizationPercentage)}%` }}
                                />
                              </div>
                              <span className="font-bold text-slate-900">{emp.utilizationPercentage}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              emp.status === 'Near Limit'
                                ? 'bg-rose-100 text-rose-800'
                                : emp.status === 'High Usage'
                                ? 'bg-amber-100 text-amber-800'
                                : emp.status === 'Healthy'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {emp.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          );
        })}

      </div>

      {/* Quick Test Telemetry Modal (Phase 4 Demo / Admin Tool) */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Log Test Telemetry Event</h3>
                  <p className="text-[11px] text-slate-500">Ingest employee client telemetry into <code className="font-mono">usage_records</code></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickLogTelemetry} className="p-5 space-y-4">
              {logError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{logError}</span>
                </div>
              )}
              {logSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{logSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Employee Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. employee@company.com"
                  value={logFormData.userEmail}
                  onChange={(e) => setLogFormData({ ...logFormData, userEmail: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Software Tool Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Figma Enterprise, Slack, Zoom"
                  value={logFormData.softwareName}
                  onChange={(e) => setLogFormData({ ...logFormData, softwareName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hours Used <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={logFormData.hoursUsed}
                    onChange={(e) => setLogFormData({ ...logFormData, hoursUsed: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Login Count <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={logFormData.loginCount}
                    onChange={(e) => setLogFormData({ ...logFormData, loginCount: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Activity Timestamp (Last Active Date) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={logFormData.lastActiveDate}
                  onChange={(e) => setLogFormData({ ...logFormData, lastActiveDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Action Note / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Simulated active telemetry session"
                  value={logFormData.actionNote}
                  onChange={(e) => setLogFormData({ ...logFormData, actionNote: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={logSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
                >
                  {logSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Ingesting Telemetry...</span>
                    </>
                  ) : (
                    <span>Record Telemetry Event</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
