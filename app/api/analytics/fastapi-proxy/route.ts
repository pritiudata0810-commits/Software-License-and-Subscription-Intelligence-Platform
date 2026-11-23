import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { calculatePlatformAnalytics } from '@/lib/analytics';
import { calculateLicenseHealthScore } from '@/lib/recommendations';

const FASTAPI_BASE_URL = process.env.FASTAPI_SERVICE_URL || 'http://127.0.0.1:8000';
const PROBE_TIMEOUT_MS = 1800; // Fast timeout for responsiveness

export async function GET(req: NextRequest) {
  // Allow authenticated users to probe microservice health
  const { user, errorResponse } = requireAuth(req);
  if (errorResponse) return errorResponse;

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    const res = await fetch(`${FASTAPI_BASE_URL}/`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        success: true,
        connected: true,
        status: 'ONLINE',
        mode: 'MICROSERVICE_ACTIVE',
        engine: 'Python FastAPI + Pandas',
        endpoint: FASTAPI_BASE_URL,
        latencyMs,
        serviceInfo: data,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json({
        success: true,
        connected: false,
        status: 'DEGRADED',
        mode: 'TYPESCRIPT_FALLBACK',
        engine: 'TypeScript Native Fallback Engine',
        endpoint: FASTAPI_BASE_URL,
        latencyMs,
        httpStatus: res.status,
        hint: 'uvicorn main:app --reload --port 8000',
        fallbackReason: `FastAPI responded with HTTP ${res.status}. Falling back to native TypeScript analytics engine.`,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      connected: false,
      status: 'OFFLINE',
      mode: 'TYPESCRIPT_FALLBACK',
      engine: 'TypeScript Native Fallback Engine',
      endpoint: FASTAPI_BASE_URL,
      latencyMs: null,
      probeDurationMs: latencyMs,
      hint: 'uvicorn main:app --reload --port 8000',
      fallbackReason: 'Python FastAPI microservice is offline. All metrics are safely served via native TypeScript engine.',
      timestamp: new Date().toISOString(),
      error: error.message || 'Connection refused or timed out',
    });
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const targetEndpoint = body.endpoint || '/api/analytics/utilization';
    const payload = body.payload || {};

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

      const res = await fetch(`${FASTAPI_BASE_URL}${targetEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({
          success: true,
          source: 'FASTAPI_MICROSERVICE',
          latencyMs: Date.now() - startTime,
          data,
        });
      }
    } catch {
      // Fallback below
    }

    // Fallback: Compute with TypeScript engine
    let fallbackData: any = null;
    if (targetEndpoint.includes('health')) {
      fallbackData = await calculateLicenseHealthScore();
    } else {
      fallbackData = await calculatePlatformAnalytics();
    }

    return NextResponse.json({
      success: true,
      source: 'TYPESCRIPT_NATIVE_FALLBACK',
      latencyMs: Date.now() - startTime,
      fallbackNotice: 'Computed using native TypeScript vectorized parity rules because Python microservice was unreachable.',
      data: fallbackData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Proxy execution failed' },
      { status: 500 }
    );
  }
}
