import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import {
  Role,
  RecommendationType,
  RecommendationSeverity,
  RecommendationStatus,
  AuditAction,
} from '@prisma/client';

export interface OverlappingToolDetail {
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
  costPerLicense: number; // INR / month
  billingFrequency: string;
  monthlySpend: number; // INR
  annualSpend: number; // INR
  departments: {
    name: string;
    code: string;
    count: number;
  }[];
  isPrimary: boolean;
}

export interface DuplicateCategoryCluster {
  category: string;
  clusterTitle: string;
  totalTools: number;
  combinedTotalSeats: number;
  combinedActiveSeats: number;
  combinedMonthlySpend: number;
  combinedAnnualSpend: number;
  primaryTool: OverlappingToolDetail;
  overlappingTools: OverlappingToolDetail[];
  potentialMonthlySavings: number;
  potentialAnnualSavings: number;
  departmentsInvolved: string[];
  recommendationStatus?: RecommendationStatus | null;
  existingRecommendationId?: string | null;
  consolidationStrategy: string;
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req, [Role.ADMIN, Role.MANAGER]);
    if (auth.errorResponse) return auth.errorResponse;

    // 1. Fetch all active software with licenses, assignments, and departments
    const softwareList = await prisma.software.findMany({
      where: { status: 'ACTIVE' },
      include: {
        vendor: true,
        licenses: {
          where: { status: { in: ['ACTIVE', 'EXPIRING_SOON'] } },
          include: {
            assignments: {
              where: { status: 'ACTIVE' },
              include: {
                user: {
                  include: { department: true },
                },
              },
            },
          },
        },
        recommendations: {
          where: {
            type: RecommendationType.DUPLICATE_CONSOLIDATION,
            status: { in: [RecommendationStatus.NEW, RecommendationStatus.REVIEWED, RecommendationStatus.ACCEPTED] },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // 2. Group tools by functional category
    const categoryMap = new Map<string, typeof softwareList>();
    for (const sw of softwareList) {
      const list = categoryMap.get(sw.category) || [];
      list.push(sw);
      categoryMap.set(sw.category, list);
    }

    const clusters: DuplicateCategoryCluster[] = [];
    let redundantToolsCount = 0;
    let totalOverlappingMonthlySpend = 0;
    let totalOverlappingAnnualSpend = 0;
    let totalPotentialMonthlySavings = 0;
    let totalPotentialAnnualSavings = 0;

    categoryMap.forEach((tools, category) => {
      // Only process categories with 2 or more active tools
      if (tools.length >= 2) {
        // Build tool details
        const toolDetails: OverlappingToolDetail[] = tools.map((sw) => {
          let totalSeats = 0;
          let activeSeats = 0;
          let costPerLicense = 0;
          let billingFrequency = 'MONTHLY';
          let primaryLicenseId = '';
          const deptMap = new Map<string, { name: string; code: string; count: number }>();

          for (const lic of sw.licenses) {
            if (!primaryLicenseId) primaryLicenseId = lic.id;
            totalSeats += lic.totalQuantity;
            costPerLicense = lic.costPerLicense;
            billingFrequency = lic.billingFrequency || 'MONTHLY';

            for (const asgn of lic.assignments) {
              activeSeats++;
              const d = asgn.user.department;
              if (d) {
                const existing = deptMap.get(d.id) || { name: d.name, code: d.code, count: 0 };
                existing.count++;
                deptMap.set(d.id, existing);
              }
            }
          }

          const monthlySpend =
            billingFrequency === 'ANNUAL'
              ? (totalSeats * costPerLicense) / 12
              : totalSeats * costPerLicense;
          const annualSpend = monthlySpend * 12;
          const utilizationRate =
            totalSeats > 0 ? Number(((activeSeats / totalSeats) * 100).toFixed(1)) : 0;
          const idleSeats = Math.max(0, totalSeats - activeSeats);

          return {
            id: sw.id,
            name: sw.name,
            category: sw.category,
            vendorName: sw.vendor?.name || 'Enterprise Vendor',
            version: sw.version || 'Latest',
            licenseId: primaryLicenseId,
            totalSeats,
            activeSeats,
            idleSeats,
            utilizationRate,
            costPerLicense,
            billingFrequency,
            monthlySpend: Math.round(monthlySpend),
            annualSpend: Math.round(annualSpend),
            departments: Array.from(deptMap.values()).sort((a, b) => b.count - a.count),
            isPrimary: false,
          };
        });

        // Determine primary tool: highest active seats, then highest utilization
        toolDetails.sort((a, b) => {
          if (b.activeSeats !== a.activeSeats) return b.activeSeats - a.activeSeats;
          return b.utilizationRate - a.utilizationRate;
        });

        toolDetails[0].isPrimary = true;
        const primaryTool = toolDetails[0];
        const overlappingTools = toolDetails.slice(1);

        redundantToolsCount += overlappingTools.length;

        const combinedTotalSeats = toolDetails.reduce((s, t) => s + t.totalSeats, 0);
        const combinedActiveSeats = toolDetails.reduce((s, t) => s + t.activeSeats, 0);
        const combinedMonthlySpend = toolDetails.reduce((s, t) => s + t.monthlySpend, 0);
        const combinedAnnualSpend = toolDetails.reduce((s, t) => s + t.annualSpend, 0);

        // Potential savings from standardizing on the primary tool:
        const potentialMonthlySavings = overlappingTools.reduce((s, t) => s + t.monthlySpend, 0);
        const potentialAnnualSavings = overlappingTools.reduce((s, t) => s + t.annualSpend, 0);

        totalOverlappingMonthlySpend += combinedMonthlySpend;
        totalOverlappingAnnualSpend += combinedAnnualSpend;
        totalPotentialMonthlySavings += potentialMonthlySavings;
        totalPotentialAnnualSavings += potentialAnnualSavings;

        // Union of departments
        const deptsSet = new Set<string>();
        toolDetails.forEach((t) => t.departments.forEach((d) => deptsSet.add(d.name)));
        const departmentsInvolved = Array.from(deptsSet);

        // Check existing recommendation
        let existingRecommendationId: string | null = null;
        let recommendationStatus: RecommendationStatus | null = null;
        for (const sw of tools) {
          if (sw.recommendations.length > 0) {
            existingRecommendationId = sw.recommendations[0].id;
            recommendationStatus = sw.recommendations[0].status;
            break;
          }
        }

        const overlappingNames = overlappingTools.map((t) => t.name).join(', ');
        const consolidationStrategy = `Standardize on ${primaryTool.name} across ${departmentsInvolved.join(', ')}. Migrate ${overlappingNames} users to leverage enterprise tier discounts and recover ₹${potentialAnnualSavings.toLocaleString('en-IN')}/year.`;

        clusters.push({
          category,
          clusterTitle: `Overlapping ${category} Toolset`,
          totalTools: toolDetails.length,
          combinedTotalSeats,
          combinedActiveSeats,
          combinedMonthlySpend,
          combinedAnnualSpend,
          primaryTool,
          overlappingTools,
          potentialMonthlySavings,
          potentialAnnualSavings,
          departmentsInvolved,
          recommendationStatus,
          existingRecommendationId,
          consolidationStrategy,
        });
      }
    });

    // Sort clusters by potential annual savings descending
    clusters.sort((a, b) => b.potentialAnnualSavings - a.potentialAnnualSavings);

    return NextResponse.json({
      success: true,
      summary: {
        overlappingCategoriesCount: clusters.length,
        redundantToolsCount,
        totalOverlappingMonthlySpend: Math.round(totalOverlappingMonthlySpend),
        totalOverlappingAnnualSpend: Math.round(totalOverlappingAnnualSpend),
        potentialMonthlySavings: Math.round(totalPotentialMonthlySavings),
        potentialAnnualSavings: Math.round(totalPotentialAnnualSavings),
      },
      clusters,
      allCategories: Array.from(categoryMap.keys()),
    });
  } catch (error: any) {
    console.error('Error fetching duplicate analytics:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to detect duplicates' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req, [Role.ADMIN, Role.MANAGER]);
    if (auth.errorResponse) return auth.errorResponse;
    const { user } = auth;

    const body = await req.json();
    const { category, primarySoftwareId, overlappingSoftwareIds, notes } = body;

    if (!category || !primarySoftwareId || !Array.isArray(overlappingSoftwareIds) || overlappingSoftwareIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'category, primarySoftwareId, and overlappingSoftwareIds are required.' },
        { status: 400 }
      );
    }

    // 1. Fetch Primary and Overlapping Software
    const primarySoftware = await prisma.software.findUnique({
      where: { id: primarySoftwareId },
      include: {
        licenses: true,
      },
    });

    if (!primarySoftware) {
      return NextResponse.json(
        { success: false, error: `Primary software with id ${primarySoftwareId} not found.` },
        { status: 404 }
      );
    }

    const overlappingSoftware = await prisma.software.findMany({
      where: { id: { in: overlappingSoftwareIds } },
      include: {
        licenses: true,
      },
    });

    // Calculate recoverable annual savings from secondary tools
    let redundantAnnualSpend = 0;
    for (const sw of overlappingSoftware) {
      for (const lic of sw.licenses) {
        const freq = lic.billingFrequency || 'MONTHLY';
        if (freq === 'ANNUAL') {
          redundantAnnualSpend += lic.totalQuantity * lic.costPerLicense;
        } else {
          redundantAnnualSpend += lic.totalQuantity * lic.costPerLicense * 12;
        }
      }
    }
    const redundantMonthlySpend = Math.round(redundantAnnualSpend / 12);

    const overlappingToolNames = overlappingSoftware.map((s) => s.name);
    const allToolNames = [primarySoftware.name, ...overlappingToolNames];

    // 2. Check if an active recommendation already exists
    const existingRec = await prisma.recommendation.findFirst({
      where: {
        softwareId: primarySoftwareId,
        type: RecommendationType.DUPLICATE_CONSOLIDATION,
        status: { in: [RecommendationStatus.NEW, RecommendationStatus.REVIEWED, RecommendationStatus.ACCEPTED] },
      },
    });

    let recommendation;
    let isNew = false;

    if (existingRec) {
      recommendation = await prisma.recommendation.update({
        where: { id: existingRec.id },
        data: {
          estimatedMonthlySavings: redundantMonthlySpend,
          estimatedAnnualSavings: Math.round(redundantAnnualSpend),
          reason: `Multiple concurrent tools active under ${category}: ${allToolNames.join(' & ')}. Redundant tool subscriptions represent recoverable annual expenditure.`,
          supportingMetrics: {
            category,
            primarySoftwareName: primarySoftware.name,
            overlappingTools: overlappingToolNames,
            potentialAnnualSavings: Math.round(redundantAnnualSpend),
            potentialMonthlySavings: redundantMonthlySpend,
            updatedAt: new Date().toISOString(),
            notes: notes || 'Flagged via Duplicate & Overlap Detection UI',
          },
          status: RecommendationStatus.NEW,
        },
      });
    } else {
      isNew = true;
      recommendation = await prisma.recommendation.create({
        data: {
          softwareId: primarySoftwareId,
          type: RecommendationType.DUPLICATE_CONSOLIDATION,
          severity: RecommendationSeverity.WARNING,
          title: `Consolidate Overlapping ${category} Subscriptions`,
          reason: `Multiple concurrent tools active under ${category}: ${allToolNames.join(' & ')}. Redundant tool subscriptions represent recoverable annual expenditure.`,
          supportingMetrics: {
            category,
            primarySoftwareName: primarySoftware.name,
            overlappingTools: overlappingToolNames,
            potentialAnnualSavings: Math.round(redundantAnnualSpend),
            potentialMonthlySavings: redundantMonthlySpend,
            notes: notes || 'Flagged via Duplicate & Overlap Detection UI',
          },
          estimatedMonthlySavings: redundantMonthlySpend,
          estimatedAnnualSavings: Math.round(redundantAnnualSpend),
          suggestedAction: `Standardize enterprise licenses onto ${primarySoftware.name}. Deprecate secondary tools (${overlappingToolNames.join(', ')}) to recover ₹${Math.round(redundantAnnualSpend).toLocaleString('en-IN')}/year.`,
          status: RecommendationStatus.NEW,
        },
      });
    }

    // 3. Record immutable entry to audit_logs
    await recordAuditLog({
      actorId: user.userId,
      userId: user.userId,
      action: AuditAction.GENERATE_RECOMMENDATION,
      entityType: 'Recommendation',
      entity: 'Recommendation',
      entityId: recommendation.id,
      details: {
        type: 'DUPLICATE_CONSOLIDATION',
        category,
        primarySoftwareId: primarySoftware.id,
        primarySoftwareName: primarySoftware.name,
        overlappingTools: overlappingToolNames,
        potentialAnnualSavings: Math.round(redundantAnnualSpend),
        potentialMonthlySavings: redundantMonthlySpend,
        isNew,
        notes: notes || 'Flagged for consolidation from Duplicate & Overlap Detection Matrix',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Consolidation recommendation successfully ${isNew ? 'generated' : 'updated'} for ${category}.`,
      recommendation,
    });
  } catch (error: any) {
    console.error('Error recording duplicate consolidation recommendation:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record consolidation recommendation' },
      { status: 500 }
    );
  }
}
