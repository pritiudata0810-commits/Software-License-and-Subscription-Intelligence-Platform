import prisma from './prisma';

export interface SoftwareUtilization {
  softwareId: string;
  softwareName: string;
  category: string;
  vendorName: string;
  totalLicenses: number;
  activeLicenses: number;
  availableLicenses: number;
  unusedLicenses: number;
  utilizationRate: number; // 0 to 100
  classification: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'LOW' | 'CRITICAL';
  costPerLicense: number;
  billingFrequency: string;
  monthlyCost: number;
  annualCost: number;
  oneTimeCost: number;
  unusedMonthlyCost: number;
  potentialAnnualSaving: number;
  assignedUsers?: { id: string; name: string; email: string; initials: string }[];
}

export interface DepartmentSpend {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  monthlyBudget: number;
  actualMonthlySpend: number;
  actualAnnualSpend: number;
  activeLicenseCount: number;
  budgetUtilizationRate: number;
}

export type SeatTier = 'OPTIMAL' | 'UNDERUTILIZED' | 'IDLE_60D' | 'UNASSIGNED';

export interface SeatClassification {
  seatId: string;
  userId?: string;
  userName: string;
  userEmail: string;
  departmentName: string;
  softwareId: string;
  softwareName: string;
  licenseId: string;
  costPerLicense: number;
  billingFrequency: string;
  lastActiveDate: string | null;
  daysInactive: number;
  hoursUsed: number;
  loginCount: number;
  tier: SeatTier;
  reclaimableCostMonthly: number;
  reclaimableCostAnnual: number;
}

export interface SeatClassificationSummary {
  optimalSeats: number;
  underutilizedSeats: number;
  idleSeats60d: number;
  unassignedSeats: number;
  totalSeats: number;
  idle60dMonthlyWaste: number;
  idle60dAnnualWaste: number;
  unassignedMonthlyWaste: number;
  unassignedAnnualWaste: number;
}

export interface PlatformAnalyticsSummary {
  totalSoftware: number;
  totalVendors: number;
  totalLicenses: number;
  activeLicenses: number;
  availableLicenses: number;
  overallUtilization: number;
  monthlyExpenditure: number;
  annualExpenditure: number;
  potentialMonthlySavings: number;
  potentialAnnualSavings: number;
  oneTimeExpenditure: number;
  // Dashboard backward-compatibility aliases
  totalMonthlyCost: number;
  totalAnnualCost: number;
  unusedMonthlyCost: number;
  unusedAnnualCost: number;
  underutilizedCount: number;
  softwareBreakdown: SoftwareUtilization[];
  departmentBreakdown: DepartmentSpend[];
  // Phase 2: 4-Tier Seat Classification
  seatClassificationSummary: SeatClassificationSummary;
  seatClassifications: SeatClassification[];
}

export function classifyUtilization(rate: number): 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'LOW' | 'CRITICAL' {
  if (rate >= 90) return 'EXCELLENT';
  if (rate >= 75) return 'GOOD';
  if (rate >= 50) return 'MODERATE';
  if (rate >= 25) return 'LOW';
  return 'CRITICAL';
}

export async function calculatePlatformAnalytics(): Promise<PlatformAnalyticsSummary> {
  const [softwareList, vendorsCount, departments, usageRecords] = await Promise.all([
    prisma.software.findMany({
      include: {
        vendor: true,
        licenses: {
          include: {
            assignments: {
              where: { status: 'ACTIVE' },
              include: { user: true, department: true },
            },
          },
        },
      },
    }),
    prisma.vendor.count(),
    prisma.department.findMany({
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          include: { license: true },
        },
      },
    }),
    prisma.usageRecord.findMany({
      orderBy: { lastActiveDate: 'desc' },
    }),
  ]);

  const latestUsageMap = new Map<string, typeof usageRecords[0]>();
  for (const u of usageRecords) {
    const key = `${u.userId}:${u.softwareId}`;
    if (!latestUsageMap.has(key)) {
      latestUsageMap.set(key, u);
    }
  }

  const now = new Date();
  const seatClassifications: SeatClassification[] = [];

  let totalLicenses = 0;
  let totalActiveLicenses = 0;
  let totalMonthlyExpenditure = 0;
  let totalAnnualExpenditure = 0;
  let totalPotentialMonthlySavings = 0;
  let totalPotentialAnnualSavings = 0;
  let totalOneTimeExpenditure = 0;
  let underutilizedCount = 0;

  const softwareBreakdown: SoftwareUtilization[] = [];

  for (const sw of softwareList) {
    let swTotal = 0;
    let swActive = 0;
    let swMonthlyCost = 0;
    let swAnnualCost = 0;
    let swOneTimeCost = 0;
    let swUnusedMonthlyCost = 0;
    let swUnusedAnnualCost = 0;
    let avgCostPerLicense = 0;
    let primaryBillingFreq = 'MONTHLY';
    const assignedUsersMap = new Map<string, { id: string; name: string; email: string; initials: string }>();

    for (const lic of sw.licenses) {
      const licTotal = lic.totalQuantity;
      const licActive = lic.assignments.length;
      const licCost = lic.costPerLicense;
      const isToken = lic.consumptionType === 'TOKEN_BASED';
      const freq = lic.billingFrequency || 'MONTHLY';
      primaryBillingFreq = freq;

      for (const assign of lic.assignments) {
        if (assign.user && !assignedUsersMap.has(assign.user.id)) {
          const names = assign.user.name.trim().split(/\s+/);
          const initials = names.length >= 2
            ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
            : assign.user.name.slice(0, 2).toUpperCase();
          assignedUsersMap.set(assign.user.id, {
            id: assign.user.id,
            name: assign.user.name,
            email: assign.user.email,
            initials,
          });
        }

        // 4-Tier Seat Classification for assigned seat
        const usage = latestUsageMap.get(`${assign.userId}:${sw.id}`);
        let daysInactive = 999;
        let lastActiveStr: string | null = null;
        let hours = 0;
        let logins = 0;

        if (usage && usage.lastActiveDate) {
          const lastActiveTime = new Date(usage.lastActiveDate).getTime();
          daysInactive = Math.max(0, Math.floor((now.getTime() - lastActiveTime) / (1000 * 60 * 60 * 24)));
          lastActiveStr = usage.lastActiveDate.toISOString();
          hours = usage.hoursUsed || 0;
          logins = usage.loginCount || 0;
        } else if (assign.assignedDate) {
          daysInactive = Math.max(0, Math.floor((now.getTime() - new Date(assign.assignedDate).getTime()) / (1000 * 60 * 60 * 24)));
        }

        let tier: SeatTier = 'OPTIMAL';
        if (daysInactive > 60 || (!usage && daysInactive > 30)) {
          tier = 'IDLE_60D';
        } else if (daysInactive > 30 || hours < 10 || logins < 5) {
          tier = 'UNDERUTILIZED';
        } else {
          tier = 'OPTIMAL';
        }

        let reclaimableMonthly = 0;
        let reclaimableAnnual = 0;
        if (tier === 'IDLE_60D') {
          if (freq === 'ANNUAL') {
            reclaimableAnnual = lic.costPerLicense;
            reclaimableMonthly = lic.costPerLicense / 12;
          } else if (freq === 'MONTHLY') {
            reclaimableMonthly = lic.costPerLicense;
            reclaimableAnnual = lic.costPerLicense * 12;
          }
        }

        seatClassifications.push({
          seatId: assign.id,
          userId: assign.userId,
          userName: assign.user?.name || 'Assigned User',
          userEmail: assign.user?.email || 'N/A',
          departmentName: assign.department?.name || 'General',
          softwareId: sw.id,
          softwareName: sw.name,
          licenseId: lic.id,
          costPerLicense: lic.costPerLicense,
          billingFrequency: freq,
          lastActiveDate: lastActiveStr,
          daysInactive,
          hoursUsed: Number(hours.toFixed(1)),
          loginCount: logins,
          tier,
          reclaimableCostMonthly: Math.round(reclaimableMonthly),
          reclaimableCostAnnual: Math.round(reclaimableAnnual),
        });
      }

      // Add unassigned seats for this license pool
      const unassignedPoolCount = Math.max(0, licTotal - licActive);
      let licUnassignedMonthly = 0;
      let licUnassignedAnnual = 0;
      if (freq === 'ANNUAL') {
        licUnassignedAnnual = lic.costPerLicense;
        licUnassignedMonthly = lic.costPerLicense / 12;
      } else if (freq === 'MONTHLY') {
        licUnassignedMonthly = lic.costPerLicense;
        licUnassignedAnnual = lic.costPerLicense * 12;
      }

      for (let s = 1; s <= unassignedPoolCount; s++) {
        seatClassifications.push({
          seatId: `${lic.id}-unassigned-${s}`,
          userName: `Unassigned Seat #${s}`,
          userEmail: `pool@${sw.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.license`,
          departmentName: 'Unallocated Pool',
          softwareId: sw.id,
          softwareName: sw.name,
          licenseId: lic.id,
          costPerLicense: lic.costPerLicense,
          billingFrequency: freq,
          lastActiveDate: null,
          daysInactive: -1,
          hoursUsed: 0,
          loginCount: 0,
          tier: 'UNASSIGNED',
          reclaimableCostMonthly: Math.round(licUnassignedMonthly),
          reclaimableCostAnnual: Math.round(licUnassignedAnnual),
        });
      }

      swTotal += licTotal;
      swActive += licActive;
      avgCostPerLicense = licCost;
      const unusedCount = Math.max(0, licTotal - licActive);

      let licAnnual = 0;
      let licMonthly = 0;
      let licUnusedAnnual = 0;
      let licUnusedMonthly = 0;

      if (isToken && (lic.allocatedTokens || 0) > 0 && (lic.tokenUnitCost || 0) > 0) {
        const poolCost = (lic.allocatedTokens || 0) * (lic.tokenUnitCost || 0);
        const remainingTokens = Math.max(0, (lic.allocatedTokens || 0) - (lic.usedTokens || 0));
        const remainingCost = remainingTokens * (lic.tokenUnitCost || 0);

        if (freq === 'ANNUAL') {
          licAnnual = poolCost;
          licMonthly = poolCost / 12;
          licUnusedAnnual = remainingCost;
          licUnusedMonthly = remainingCost / 12;
        } else {
          licMonthly = poolCost;
          licAnnual = poolCost * 12;
          licUnusedMonthly = remainingCost;
          licUnusedAnnual = remainingCost * 12;
        }
      } else if (freq === 'ANNUAL') {
        licAnnual = licTotal * licCost;
        licMonthly = (licTotal * licCost) / 12;
        licUnusedAnnual = unusedCount * licCost;
        licUnusedMonthly = (unusedCount * licCost) / 12;
      } else if (freq === 'MONTHLY') {
        licMonthly = licTotal * licCost;
        licAnnual = licTotal * licCost * 12;
        licUnusedMonthly = unusedCount * licCost;
        licUnusedAnnual = unusedCount * licCost * 12;
      } else if (freq === 'ONE_TIME') {
        swOneTimeCost += licTotal * licCost;
        licAnnual = 0;
        licMonthly = 0;
        licUnusedAnnual = 0;
        licUnusedMonthly = 0;
      }

      swMonthlyCost += licMonthly;
      swAnnualCost += licAnnual;
      swUnusedMonthlyCost += licUnusedMonthly;
      swUnusedAnnualCost += licUnusedAnnual;
    }

    const swAvailable = Math.max(0, swTotal - swActive);
    const swUnused = swAvailable;
    const utilizationRate = swTotal > 0 ? Number(((swActive / swTotal) * 100).toFixed(1)) : 0;
    const classification = classifyUtilization(utilizationRate);

    if (utilizationRate < 70 && swTotal > 0) {
      underutilizedCount++;
    }

    totalLicenses += swTotal;
    totalActiveLicenses += swActive;
    totalMonthlyExpenditure += swMonthlyCost;
    totalAnnualExpenditure += swAnnualCost;
    totalPotentialMonthlySavings += swUnusedMonthlyCost;
    totalPotentialAnnualSavings += swUnusedAnnualCost;
    totalOneTimeExpenditure += swOneTimeCost;

    softwareBreakdown.push({
      softwareId: sw.id,
      softwareName: sw.name,
      category: sw.category,
      vendorName: sw.vendor?.name || 'N/A',
      totalLicenses: swTotal,
      activeLicenses: swActive,
      availableLicenses: swAvailable,
      unusedLicenses: swUnused,
      utilizationRate,
      classification,
      costPerLicense: avgCostPerLicense,
      billingFrequency: primaryBillingFreq,
      monthlyCost: Math.round(swMonthlyCost),
      annualCost: Math.round(swAnnualCost),
      oneTimeCost: Math.round(swOneTimeCost),
      unusedMonthlyCost: Math.round(swUnusedMonthlyCost),
      potentialAnnualSaving: Math.round(swUnusedAnnualCost),
      assignedUsers: Array.from(assignedUsersMap.values()),
    });
  }

  const overallUtilization = totalLicenses > 0 
    ? Number(((totalActiveLicenses / totalLicenses) * 100).toFixed(1)) 
    : 0;

  const departmentBreakdown: DepartmentSpend[] = departments.map((dept) => {
    let deptMonthlySpend = 0;
    let deptAnnualSpend = 0;
    for (const assign of dept.assignments) {
      const lic = assign.license;
      const freq = lic.billingFrequency || 'MONTHLY';
      if (freq === 'ANNUAL') {
        deptAnnualSpend += lic.costPerLicense;
        deptMonthlySpend += lic.costPerLicense / 12;
      } else if (freq === 'MONTHLY') {
        deptMonthlySpend += lic.costPerLicense;
        deptAnnualSpend += lic.costPerLicense * 12;
      }
    }
    const budgetUtilization = dept.budgetMonthly > 0 
      ? Number(((deptMonthlySpend / dept.budgetMonthly) * 100).toFixed(1)) 
      : 0;

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      departmentCode: dept.code,
      monthlyBudget: dept.budgetMonthly,
      actualMonthlySpend: Math.round(deptMonthlySpend),
      actualAnnualSpend: Math.round(deptAnnualSpend),
      activeLicenseCount: dept.assignments.length,
      budgetUtilizationRate: budgetUtilization,
    };
  });

  const optimalSeats = seatClassifications.filter(s => s.tier === 'OPTIMAL').length;
  const underutilizedSeats = seatClassifications.filter(s => s.tier === 'UNDERUTILIZED').length;
  const idleSeats60d = seatClassifications.filter(s => s.tier === 'IDLE_60D').length;
  const unassignedSeats = seatClassifications.filter(s => s.tier === 'UNASSIGNED').length;

  const idle60dMonthlyWaste = seatClassifications
    .filter(s => s.tier === 'IDLE_60D')
    .reduce((sum, s) => sum + s.reclaimableCostMonthly, 0);
  const idle60dAnnualWaste = seatClassifications
    .filter(s => s.tier === 'IDLE_60D')
    .reduce((sum, s) => sum + s.reclaimableCostAnnual, 0);

  const unassignedMonthlyWaste = seatClassifications
    .filter(s => s.tier === 'UNASSIGNED')
    .reduce((sum, s) => sum + s.reclaimableCostMonthly, 0);
  const unassignedAnnualWaste = seatClassifications
    .filter(s => s.tier === 'UNASSIGNED')
    .reduce((sum, s) => sum + s.reclaimableCostAnnual, 0);

  const seatClassificationSummary: SeatClassificationSummary = {
    optimalSeats,
    underutilizedSeats,
    idleSeats60d,
    unassignedSeats,
    totalSeats: seatClassifications.length,
    idle60dMonthlyWaste: Math.round(idle60dMonthlyWaste),
    idle60dAnnualWaste: Math.round(idle60dAnnualWaste),
    unassignedMonthlyWaste: Math.round(unassignedMonthlyWaste),
    unassignedAnnualWaste: Math.round(unassignedAnnualWaste),
  };

  const tierPriority: Record<SeatTier, number> = {
    IDLE_60D: 1,
    UNDERUTILIZED: 2,
    UNASSIGNED: 3,
    OPTIMAL: 4,
  };
  seatClassifications.sort((a, b) => {
    const pA = tierPriority[a.tier] || 99;
    const pB = tierPriority[b.tier] || 99;
    if (pA !== pB) return pA - pB;
    return b.daysInactive - a.daysInactive;
  });

  return {
    totalSoftware: softwareList.length,
    totalVendors: vendorsCount,
    totalLicenses,
    activeLicenses: totalActiveLicenses,
    availableLicenses: Math.max(0, totalLicenses - totalActiveLicenses),
    overallUtilization,
    monthlyExpenditure: Math.round(totalMonthlyExpenditure),
    annualExpenditure: Math.round(totalAnnualExpenditure),
    potentialMonthlySavings: Math.round(totalPotentialMonthlySavings),
    potentialAnnualSavings: Math.round(totalPotentialAnnualSavings),
    oneTimeExpenditure: Math.round(totalOneTimeExpenditure),
    totalMonthlyCost: Math.round(totalMonthlyExpenditure),
    totalAnnualCost: Math.round(totalAnnualExpenditure),
    unusedMonthlyCost: Math.round(totalPotentialMonthlySavings),
    unusedAnnualCost: Math.round(totalPotentialAnnualSavings),
    underutilizedCount,
    softwareBreakdown,
    departmentBreakdown,
    seatClassificationSummary,
    seatClassifications,
  };
}
