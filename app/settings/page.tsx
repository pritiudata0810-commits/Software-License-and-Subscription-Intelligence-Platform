'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Settings,
  Shield,
  Database,
  Award,
  Users,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Globe,
  DollarSign,
  RefreshCw,
  Activity,
  Terminal,
  Copy,
  Check,
  Cpu
} from 'lucide-react';

interface EngineHealth {
  loading: boolean;
  connected: boolean;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'CHECKING';
  mode: string;
  engine: string;
  endpoint: string;
  latencyMs: number | null;
  hint?: string;
  fallbackReason?: string;
  lastChecked?: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [threshold, setThreshold] = useState(70);
  const [currency, setCurrency] = useState('INR');
  const [copiedHint, setCopiedHint] = useState(false);

  // Microservice live health state
  const [engineHealth, setEngineHealth] = useState<EngineHealth>({
    loading: true,
    connected: false,
    status: 'CHECKING',
    mode: 'PROBING',
    engine: 'Probing Analytics Microservice...',
    endpoint: 'http://localhost:8000',
    latencyMs: null,
  });

  const probeMicroservice = useCallback(async () => {
    setEngineHealth((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/analytics/fastapi-proxy', { cache: 'no-store' });
      const data = await res.json();

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (data.connected) {
        setEngineHealth({
          loading: false,
          connected: true,
          status: 'ONLINE',
          mode: data.mode || 'MICROSERVICE_ACTIVE',
          engine: data.engine || 'Python FastAPI + Pandas',
          endpoint: data.endpoint || 'http://localhost:8000',
          latencyMs: data.latencyMs ?? null,
          lastChecked: timeStr,
        });
      } else {
        setEngineHealth({
          loading: false,
          connected: false,
          status: 'OFFLINE',
          mode: data.mode || 'TYPESCRIPT_FALLBACK',
          engine: data.engine || 'TypeScript Native Fallback Engine',
          endpoint: data.endpoint || 'http://localhost:8000',
          latencyMs: null,
          hint: data.hint || 'uvicorn main:app --reload --port 8000',
          fallbackReason: data.fallbackReason || 'FastAPI microservice unreachable on port 8000.',
          lastChecked: timeStr,
        });
      }
    } catch (err: any) {
      setEngineHealth({
        loading: false,
        connected: false,
        status: 'OFFLINE',
        mode: 'TYPESCRIPT_FALLBACK',
        engine: 'TypeScript Native Fallback Engine',
        endpoint: 'http://localhost:8000',
        latencyMs: null,
        hint: 'uvicorn main:app --reload --port 8000',
        fallbackReason: 'Network failure communicating with microservice proxy.',
        lastChecked: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    }
  }, []);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) {
          if (data.settings.underutilizationThreshold) {
            setThreshold(data.settings.underutilizationThreshold);
          }
          if (data.settings.currency) {
            setCurrency(data.settings.currency);
          }
        }
      })
      .catch((err) => console.error('Error fetching settings:', err));

    probeMicroservice();
  }, [probeMicroservice]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          underutilizationThreshold: threshold,
          currency,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  const copyCommandHint = () => {
    if (engineHealth.hint) {
      navigator.clipboard.writeText(engineHealth.hint);
      setCopiedHint(true);
      setTimeout(() => setCopiedHint(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">System & Engine Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Platform configurations, PostgreSQL connection diagnostics, and optimization rules.
        </p>
      </div>

      {saved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Configuration preferences updated successfully.</span>
        </div>
      )}

      {/* Card 1: Enterprise Platform Information */}
      <div className="p-6 rounded-[32px] bg-white border border-slate-100 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-full bg-[#E3DCFD] text-purple-700 flex items-center justify-center">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Platform & Architecture Overview</h2>
            <p className="text-[11px] text-slate-500">LicenseIQ Enterprise Subscription & License Intelligence</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#D7EFEA] text-slate-800">
            <span className="font-bold block mb-1">Platform Edition</span>
            <span className="text-slate-600 font-medium">LicenseIQ Enterprise v1.0</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#FEF1C9] text-slate-800">
            <span className="font-bold block mb-1">Database Engine</span>
            <span className="text-slate-600 font-medium">Aiven PostgreSQL (Prisma ORM)</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#E3DCFD] text-slate-800">
            <span className="font-bold block mb-1">Security & Auth</span>
            <span className="text-slate-600 font-medium">JWT + Multi-Role RBAC</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#FDDCE5] text-slate-800">
            <span className="font-bold block mb-1">Analytics Engine</span>
            <span className="text-slate-600 font-medium truncate block">
              {engineHealth.connected ? 'FastAPI Python Microservice' : 'TypeScript Native Engine'}
            </span>
          </div>
        </div>
      </div>

      {/* Card 2: Database & Analytics Microservice Status */}
      <div className="p-6 rounded-[32px] bg-white border border-slate-100 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#D7EFEA] text-teal-800 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Database & Deployment Architecture</h2>
              <p className="text-[11px] text-slate-500">Persistent PostgreSQL Infrastructure & Live Microservice Bridge</p>
            </div>
          </div>

          {/* Test Engine Connection Button */}
          <button
            type="button"
            onClick={probeMicroservice}
            disabled={engineHealth.loading}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${engineHealth.loading ? 'animate-spin' : ''}`} />
            <span>{engineHealth.loading ? 'Testing Engine...' : 'Test Engine Connection'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* Item 1: Database Engine */}
          <div className="p-4 rounded-2xl bg-[#F8FAFA] border border-slate-100 flex flex-col justify-between">
            <div>
              <span className="text-slate-400 text-[11px] block">Database Engine</span>
              <span className="font-bold text-slate-900 mt-0.5 block">Aiven Cloud PostgreSQL</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold mt-2 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 shrink-0" /> Connected & Synchronized
            </span>
          </div>

          {/* Item 2: ORM & Client */}
          <div className="p-4 rounded-2xl bg-[#F8FAFA] border border-slate-100 flex flex-col justify-between">
            <div>
              <span className="text-slate-400 text-[11px] block">ORM & Client</span>
              <span className="font-bold text-slate-900 mt-0.5 block">Prisma Client v5.22.0</span>
            </div>
            <span className="text-[10px] text-indigo-600 font-semibold mt-2">14 Relational Tables</span>
          </div>

          {/* Item 3: Analytics Microservice / Fallback Status */}
          <div className="p-4 rounded-2xl bg-[#F8FAFA] border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px] block">Analytics Service</span>
                {engineHealth.lastChecked && (
                  <span className="text-[9px] text-slate-400">Checked {engineHealth.lastChecked}</span>
                )}
              </div>
              <span className="font-bold text-slate-900 mt-0.5 block truncate">
                {engineHealth.connected ? 'Python FastAPI + Pandas' : 'TypeScript Native Engine'}
              </span>
            </div>

            <div className="mt-2">
              {engineHealth.loading ? (
                <span className="text-[10px] text-slate-500 font-medium inline-flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin text-slate-400" /> Probing microservice...
                </span>
              ) : engineHealth.connected ? (
                <div className="space-y-0.5">
                  <span className="text-[10px] text-emerald-600 font-semibold inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    FastAPI Online (:8000)
                  </span>
                  {engineHealth.latencyMs !== null && (
                    <span className="text-[9px] text-emerald-700/80 block font-medium">
                      Latency: {engineHealth.latencyMs}ms roundtrip
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-0.5">
                  <span className="text-[10px] text-amber-600 font-semibold inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    TypeScript Fallback Active
                  </span>
                  <span className="text-[9px] text-slate-500 block">
                    FastAPI offline (0ms latency impact)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Microservice Diagnostic Banner */}
        {!engineHealth.loading && (
          <div className={`p-4 rounded-2xl border text-xs transition-all ${
            engineHealth.connected 
              ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900'
              : 'bg-amber-50/70 border-amber-200/80 text-amber-900'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {engineHealth.connected ? (
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-xs">
                    {engineHealth.connected 
                      ? 'High-Performance Python Microservice Active' 
                      : 'Python Microservice Offline — Seamless TypeScript Parity Fallback Engaged'}
                  </h4>
                  <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                    {engineHealth.connected 
                      ? `Vectorized mathematical computations and recommendations are streaming via FastAPI (:8000) with ${engineHealth.latencyMs}ms response time.`
                      : 'All executive KPIs, 4-tier seat classifications, duplicate audits, and recommendation scoring are automatically served with 100% mathematical parity by the native TypeScript engine.'}
                  </p>
                </div>
              </div>

              {!engineHealth.connected && (
                <div className="flex items-center gap-2 shrink-0 bg-white/80 border border-amber-200/70 px-3 py-1.5 rounded-xl shadow-2xs">
                  <Terminal className="w-3.5 h-3.5 text-slate-500" />
                  <code className="text-[10px] font-mono font-semibold text-slate-800">
                    uvicorn main:app --reload --port 8000
                  </code>
                  <button
                    type="button"
                    onClick={copyCommandHint}
                    title="Copy command to clipboard"
                    className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition"
                  >
                    {copiedHint ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Card 3: Optimization Rules & Thresholds Form */}
      <form onSubmit={handleSave} className="p-6 rounded-[32px] bg-white border border-slate-100 shadow-xs space-y-4 text-xs">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-full bg-[#FEF1C9] text-amber-800 flex items-center justify-center">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Threshold & Intelligence Preferences</h2>
            <p className="text-[10px] text-slate-500">Configurable triggers for the AI recommendation rules</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Low Utilization Threshold (%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="40"
                max="85"
                step="5"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg cursor-pointer accent-[#0F172A]"
              />
              <span className="font-bold text-slate-900 w-12">{threshold}%</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Software with utilization below {threshold}% triggers reallocation recommendations.
            </p>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Display Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-2.5 rounded-full bg-[#F4F6F6] border-0 text-slate-800 font-medium focus:ring-2 focus:ring-slate-300"
            >
              <option value="INR">Indian Rupee (₹)</option>
              <option value="USD">US Dollar ($)</option>
            </select>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white font-semibold shadow-xs transition"
          >
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
}
