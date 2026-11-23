'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Copy,
  Sparkles,
  DollarSign,
  AlertTriangle,
  TrendingDown,
  Users,
  CheckCircle2,
  ArrowRight,
  FileSpreadsheet,
  RefreshCw,
  Building2,
  Check,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { exportToCsv } from '@/lib/exportCsv';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid
} from 'recharts';

interface DepartmentAdopt {
  name: string;
  code: string;
  count: number;
}

interface OverlappingTool {
  id: string;
  name: string;
  category: string;
  vendorName: string;
  version: string;
  licenseId: string;
  totalSeats: number;
  activeSeats: number;
  idleSeats: number;
  utilizationRate: number;
  costPerLicense: number;
  billingFrequency: string;
  monthlySpend: number;
  annualSpend: number;
  departments: DepartmentAdopt[];
  isPrimary: boolean;
}

interface DuplicateCluster {
  category: string;
  clusterTitle: string;
  totalTools: number;
  combinedTotalSeats: number;
  combinedActiveSeats: number;
  combinedMonthlySpend: number;
  combinedAnnualSpend: number;
  primaryTool: OverlappingTool;
  overlappingTools: OverlappingTool[];
  potentialMonthlySavings: number;
  potentialAnnualSavings: number;
  departmentsInvolved: string[];
  recommendationStatus?: string | null;
  existingRecommendationId?: string | null;
  consolidationStrategy: string;
}

interface DuplicateSummary {
  overlappingCategoriesCount: number;
  redundantToolsCount: number;
  totalOverlappingMonthlySpend: number;
  totalOverlappingAnnualSpend: number;
  potentialMonthlySavings: number;
  potentialAnnualSavings: number;
}

export default function DuplicateDetectionPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DuplicateSummary | null>(null);
  const [clusters, setClusters] = useState<DuplicateCluster[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('yearly');
  const [flaggingCategory, setFlaggingCategory] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string>('');

  const fetchDuplicateData = async () => {
    setLoading(true);
    setActionError('');
    try {
      const res = await fetch('/api/analytics/duplicates');
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setClusters(data.clusters || []);
      } else {
        setActionError(data.error || 'Failed to load duplicate detection data.');
      }
    } catch (err: any) {
      console.error('Error loading duplicates:', err);
      setActionError(err.message || 'Error communicating with server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuplicateData();
  }, []);

  const formatINR = (val: number) => `₹${Math.round(val || 0).toLocaleString('en-IN')}`;

  const handleFlagConsolidation = async (cluster: DuplicateCluster) => {
    setFlaggingCategory(cluster.category);
    setActionError('');

    try {
      const res = await fetch('/api/analytics/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: cluster.category,
          primarySoftwareId: cluster.primaryTool.id,
          overlappingSoftwareIds: cluster.overlappingTools.map((t) => t.id),
          notes: `Consolidation recommendation triggered from Duplicate Detection screen for ${cluster.category}`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionSuccess((prev) => ({
          ...prev,
          [cluster.category]: 'Consolidation Flagged (Recommendation Active)',
        }));
        // Refresh data to update status badges
        fetchDuplicateData();
      } else {
        setActionError(data.error || 'Failed to flag consolidation recommendation.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error communicating with server.');
    } finally {
      setFlaggingCategory(null);
    }
  };

  const handleExportCSV = () => {
    if (!clusters || clusters.length === 0) return;

    const headers = [
      'Functional Category',
      'Role in Cluster',
      'Software Name',
      'Vendor Name',
      'Version',
      'Active Seats',
      'Total Seats',
      'Seat Utilization (%)',
      'Cost Per License (₹/mo)',
      'Billing Frequency',
      'Monthly Spend (₹)',
      'Annual Spend (₹)',
      'Departments Using Tool',
      'Category Potential Annual Savings (₹)',
      'Recommended Consolidation Action',
    ];

    const rows: (string | number)[][] = [];

    for (const c of clusters) {
      const allTools = [c.primaryTool, ...c.overlappingTools];
      for (const t of allTools) {
        rows.push([
          c.category,
          t.isPrimary ? 'Primary Standard (Recommended)' : 'Redundant / Overlap Target',
          t.name,
          t.vendorName,
          t.version,
          t.activeSeats,
          t.totalSeats,
          t.utilizationRate,
          t.costPerLicense,
          t.billingFrequency,
          t.monthlySpend,
          t.annualSpend,
          t.departments.map((d) => `${d.name} (${d.count})`).join('; ') || 'None',
          c.potentialAnnualSavings,
          t.isPrimary
            ? `Retain and standardize enterprise tier for ${c.category}`
            : `Deprecate and migrate seats to ${c.primaryTool.name}`,
        ]);
      }
    }

    exportToCsv(
      `Duplicate_Subscription_Overlap_Audit_${new Date().toISOString().split('T')[0]}`,
      headers,
      rows
    );
  };

  const filteredClusters =
    selectedCategory === 'ALL'
      ? clusters
      : clusters.filter((c) => c.category === selectedCategory);

  // Chart data comparing spend in overlapping categories
  const chartData = clusters.map((c) => ({
    name: c.category,
    primarySpend: viewMode === 'yearly' ? c.primaryTool.annualSpend : c.primaryTool.monthlySpend,
    redundantSpend:
      viewMode === 'yearly' ? c.potentialAnnualSavings : c.potentialMonthlySavings,
  }));

  if (loading && !summary) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">
          Analyzing functional categories and detecting overlapping subscriptions...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ============================================================== */}
      {/* 1. HEADER SECTION                                             */}
      {/* ============================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Copy className="w-3 h-3" />
              <span>Multi-Category Overlap Detector</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
              PostgreSQL Grounded
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Duplicate Subscription Detection &amp; Consolidation
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Identify redundant software tools serving identical functional categories across departments, compare competing seat licenses side-by-side, and recover capital through license standardization.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Monthly / Yearly Toggle */}
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center shadow-inner">
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'monthly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setViewMode('yearly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'yearly'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Yearly
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Export all duplicate detection metrics to RFC 4180 CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchDuplicateData}
            className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-2xs"
            title="Refresh Analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. TOP-LEVEL SUMMARY KPI CARDS (PASTEL PALETTE)               */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Overlapping Categories (Lavender #E3DCFD) */}
        <div className="p-5 rounded-[28px] bg-[#E3DCFD]/40 border border-[#E3DCFD] shadow-xs flex flex-col justify-between transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
              Overlapping Categories
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {summary?.overlappingCategoriesCount || 0}
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              Functional silos with &ge;2 concurrent software tools
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-indigo-200/50 flex items-center gap-1.5 text-[10px] font-semibold text-indigo-800">
            <Copy className="w-3 h-3" />
            <span>Multi-vendor departmental overlap</span>
          </div>
        </div>

        {/* Card 2: Redundant Subscriptions (Rose #FDDCE5) */}
        <div className="p-5 rounded-[28px] bg-[#FDDCE5]/40 border border-[#FDDCE5] shadow-xs flex flex-col justify-between transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider">
              Redundant Subscriptions
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {summary?.redundantToolsCount || 0}
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              Secondary tools identified for migration / retirement
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-rose-200/50 flex items-center gap-1.5 text-[10px] font-semibold text-rose-800">
            <AlertTriangle className="w-3 h-3" />
            <span>Overlapping functional capabilities</span>
          </div>
        </div>

        {/* Card 3: Overlapping Spend (Lemon #FEF1C9) */}
        <div className="p-5 rounded-[28px] bg-[#FEF1C9]/40 border border-[#FEF1C9] shadow-xs flex flex-col justify-between transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
              {viewMode === 'yearly' ? 'Annual Overlap Spend' : 'Monthly Overlap Spend'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatINR(
                viewMode === 'yearly'
                  ? summary?.totalOverlappingAnnualSpend || 0
                  : summary?.totalOverlappingMonthlySpend || 0
              )}
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              Combined spend committed across competing tools
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-amber-200/50 flex items-center gap-1.5 text-[10px] font-semibold text-amber-800">
            <DollarSign className="w-3 h-3" />
            <span>{viewMode === 'yearly' ? 'Full 12-month budget' : 'Monthly recurring run-rate'}</span>
          </div>
        </div>

        {/* Card 4: Potential Consolidation Savings (Mint #D7EFEA) */}
        <div className="p-5 rounded-[28px] bg-[#D7EFEA]/40 border border-[#D7EFEA] shadow-xs flex flex-col justify-between transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
              Estimated Recoverable
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-emerald-800 tracking-tight">
              {formatINR(
                viewMode === 'yearly'
                  ? summary?.potentialAnnualSavings || 0
                  : summary?.potentialMonthlySavings || 0
              )}
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              Annual savings recovered via platform standardization
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-emerald-200/50 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-800">
            <TrendingDown className="w-3 h-3" />
            <span>Immediate procurement right-sizing</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. VISUAL EXPENDITURE COMPARISON CHART                         */}
      {/* ============================================================== */}
      {clusters.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Overlapping Category Spend &amp; Consolidation Opportunity</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Comparison of Primary Platform investment vs. Redundant Overlapping tool expenditure across categories.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-blue-600 inline-block" />
                <span className="text-slate-600 font-medium">Primary Platform</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-rose-500 inline-block" />
                <span className="text-slate-600 font-medium">Recoverable Secondary Spend</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="name"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: any) => [formatINR(val), '']}
                  contentStyle={{
                    borderRadius: '16px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="primarySpend" name="Primary Platform Spend" fill="#2563EB" radius={[6, 6, 0, 0]} />
                <Bar dataKey="redundantSpend" name="Recoverable Secondary Spend" fill="#F43F5E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. CATEGORY FILTER TABS                                        */}
      {/* ============================================================== */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
            selectedCategory === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All Overlapping Categories ({clusters.length})
        </button>

        {clusters.map((c) => (
          <button
            key={c.category}
            type="button"
            onClick={() => setSelectedCategory(c.category)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 ${
              selectedCategory === c.category
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>{c.category}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedCategory === c.category
                  ? 'bg-blue-800 text-blue-100'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {c.totalTools}
            </span>
          </button>
        ))}
      </div>

      {/* ============================================================== */}
      {/* 5. CATEGORY-BY-CATEGORY OVERLAP COMPARISON CARDS / MATRIX       */}
      {/* ============================================================== */}
      <div className="space-y-6">
        {filteredClusters.length > 0 ? (
          filteredClusters.map((cluster) => {
            const isFlagged =
              actionSuccess[cluster.category] ||
              cluster.recommendationStatus === 'NEW' ||
              cluster.recommendationStatus === 'ACCEPTED';
            const isSubmitting = flaggingCategory === cluster.category;

            return (
              <div
                key={cluster.category}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden"
              >
                {/* Cluster Header */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                        {cluster.category}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-semibold">
                        {cluster.totalTools} Active Subscriptions
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                        {cluster.overlappingTools.length} Redundant Tool{cluster.overlappingTools.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight mt-1.5">
                      {cluster.clusterTitle}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Combined Annual Spend
                      </div>
                      <div className="text-sm font-black text-slate-900">
                        {formatINR(cluster.combinedAnnualSpend)}
                      </div>
                    </div>
                    <div className="h-8 w-px bg-slate-200" />
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                        Consolidation Savings
                      </div>
                      <div className="text-sm font-black text-emerald-700">
                        +{formatINR(cluster.potentialAnnualSavings)}/yr
                      </div>
                    </div>
                  </div>
                </div>

                {/* Side-by-side Tool Comparison Matrix */}
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Primary Tool Card */}
                    <div className="p-4 rounded-2xl border-2 border-emerald-400/80 bg-emerald-50/20 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Recommended Primary Standard</span>
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {cluster.primaryTool.version}
                          </span>
                        </div>

                        <h4 className="text-base font-bold text-slate-900">
                          {cluster.primaryTool.name}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Vendor: <span className="font-semibold text-slate-700">{cluster.primaryTool.vendorName}</span>
                        </p>

                        {/* Utilization Bar */}
                        <div className="mt-4 space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-slate-600">Seat Utilization</span>
                            <span className="text-emerald-700 font-bold">
                              {cluster.primaryTool.utilizationRate}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, cluster.primaryTool.utilizationRate)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>
                              <strong className="text-slate-800">{cluster.primaryTool.activeSeats}</strong> active / {cluster.primaryTool.totalSeats} seats
                            </span>
                            <span>{cluster.primaryTool.idleSeats} unassigned</span>
                          </div>
                        </div>

                        {/* Financial Metrics */}
                        <div className="mt-4 pt-3 border-t border-emerald-100 grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold">Unit Cost</span>
                            <div className="font-bold text-slate-800">
                              {formatINR(cluster.primaryTool.costPerLicense)}/seat/mo
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold">Total Annual Spend</span>
                            <div className="font-black text-slate-900">
                              {formatINR(cluster.primaryTool.annualSpend)}
                            </div>
                          </div>
                        </div>

                        {/* Departments Using Primary Tool */}
                        <div className="mt-3 pt-3 border-t border-emerald-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Active Department Footprint
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {cluster.primaryTool.departments.map((d) => (
                              <span
                                key={d.code}
                                className="px-2 py-0.5 rounded-lg bg-emerald-100/70 text-emerald-900 text-[11px] font-semibold"
                              >
                                {d.name} ({d.count})
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Overlapping Secondary Tool(s) Card */}
                    <div className="space-y-4">
                      {cluster.overlappingTools.map((tool) => (
                        <div
                          key={tool.id}
                          className="p-4 rounded-2xl border-2 border-rose-300/80 bg-rose-50/20 shadow-xs flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>Redundant Subscription (Consolidation Target)</span>
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">{tool.version}</span>
                            </div>

                            <h4 className="text-base font-bold text-slate-900">{tool.name}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Vendor: <span className="font-semibold text-slate-700">{tool.vendorName}</span>
                            </p>

                            {/* Utilization Bar */}
                            <div className="mt-4 space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="text-slate-600">Seat Utilization</span>
                                <span className="text-rose-700 font-bold">{tool.utilizationRate}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-rose-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, tool.utilizationRate)}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span>
                                  <strong className="text-slate-800">{tool.activeSeats}</strong> active / {tool.totalSeats} seats
                                </span>
                                <span>{tool.idleSeats} unassigned</span>
                              </div>
                            </div>

                            {/* Financial Metrics */}
                            <div className="mt-4 pt-3 border-t border-rose-100 grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="text-slate-400 text-[10px] uppercase font-bold">Unit Cost</span>
                                <div className="font-bold text-slate-800">
                                  {formatINR(tool.costPerLicense)}/seat/mo
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-400 text-[10px] uppercase font-bold">Recoverable Secondary Spend</span>
                                <div className="font-black text-rose-700">
                                  {formatINR(tool.annualSpend)}/yr
                                </div>
                              </div>
                            </div>

                            {/* Departments Using Redundant Tool */}
                            <div className="mt-3 pt-3 border-t border-rose-100">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                Overlapping Departments
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {tool.departments.map((d) => (
                                  <span
                                    key={d.code}
                                    className="px-2 py-0.5 rounded-lg bg-rose-100/70 text-rose-900 text-[11px] font-semibold"
                                  >
                                    {d.name} ({d.count})
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Department Cross-Adoption Breakdown Table */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Departmental Cross-Adoption Matrix</span>
                    </h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-100">
                          <tr>
                            <th className="py-2 px-3">Department</th>
                            <th className="py-2 px-3">{cluster.primaryTool.name} (Primary)</th>
                            {cluster.overlappingTools.map((t) => (
                              <th key={t.id} className="py-2 px-3">
                                {t.name} (Overlap)
                              </th>
                            ))}
                            <th className="py-2 px-3">Overlap Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {cluster.departmentsInvolved.map((deptName) => {
                            const primaryCount =
                              cluster.primaryTool.departments.find((d) => d.name === deptName)
                                ?.count || 0;
                            const overlapCounts = cluster.overlappingTools.map(
                              (t) => t.departments.find((d) => d.name === deptName)?.count || 0
                            );
                            const hasDual =
                              primaryCount > 0 && overlapCounts.some((c) => c > 0);

                            return (
                              <tr key={deptName} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {deptName}
                                </td>
                                <td className="py-2 px-3">
                                  {primaryCount > 0 ? (
                                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                      {primaryCount} seats
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                {overlapCounts.map((count, idx) => (
                                  <td key={idx} className="py-2 px-3">
                                    {count > 0 ? (
                                      <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                                        {count} seats
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                ))}
                                <td className="py-2 px-3">
                                  {hasDual ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                      <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                      Dual Subscribed (Silo Overlap)
                                    </span>
                                  ) : primaryCount > 0 ? (
                                    <span className="text-[10px] font-semibold text-emerald-700">
                                      Standardized on Primary
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-slate-500">
                                      Isolated on Secondary
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Strategic Action Box & Button */}
                  <div className="mt-4 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Recommended Consolidation Strategy</span>
                      </div>
                      <p className="text-xs text-slate-600 max-w-2xl">
                        {cluster.consolidationStrategy}
                      </p>
                    </div>

                    <div>
                      {isFlagged ? (
                        <div className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                          <Check className="w-4 h-4 text-emerald-700" />
                          <span>Recommendation Active</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleFlagConsolidation(cluster)}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Flagging...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Flag for Consolidation</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">
              No Duplicate Subscriptions Found
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Every active functional category in your organization currently operates on a single consolidated software tool.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
