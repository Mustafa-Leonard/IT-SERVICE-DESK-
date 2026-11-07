import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(organizationId: string) {
    const now = new Date();
    const [
      ticketStatuses,
      assetStatuses,
      manualDeviceStatuses,
      overdueTickets,
      openIncidents,
      openNetworkIncidents,
    ] = await Promise.all([
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: { _all: true },
      }),
      this.prisma.asset.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: { _all: true },
      }),
      this.prisma.networkDevice.groupBy({
        by: ['status'],
        where: { organizationId, statusSource: 'MANUAL' },
        _count: { _all: true },
      }),
      this.prisma.ticket.count({
        where: {
          organizationId,
          status: { notIn: ['RESOLVED', 'CLOSED'] },
          OR: [
            { responseDueAt: { lt: now }, firstResponseAt: null },
            { resolutionDueAt: { lt: now } },
          ],
        },
      }),
      this.prisma.incident.count({
        where: { organizationId, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      }),
      this.prisma.networkIncident.count({
        where: { organizationId, status: { not: 'RESOLVED' } },
      }),
    ]);

    return {
      generatedAt: now.toISOString(),
      ticketStatuses: Object.fromEntries(
        ticketStatuses.map(({ status, _count }) => [status, _count._all]),
      ),
      overdueTickets,
      assetStatuses: Object.fromEntries(
        assetStatuses.map(({ status, _count }) => [status, _count._all]),
      ),
      manuallyRecordedNetworkDeviceStatuses: Object.fromEntries(
        manualDeviceStatuses.map(({ status, _count }) => [status, _count._all]),
      ),
      openIncidents,
      openNetworkIncidents,
    };
  }

  async sla(organizationId: string) {
    const [row] = await this.prisma.$queryRaw<
      Array<{
        responseEligible: bigint;
        responseMet: bigint;
        responseMissed: bigint;
        resolutionEligible: bigint;
        resolutionMet: bigint;
        resolutionMissed: bigint;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(*) FILTER (
          WHERE "responseDueAt" IS NOT NULL
            AND ("firstResponseAt" IS NOT NULL OR "responseDueAt" < NOW())
        ) AS "responseEligible",
        COUNT(*) FILTER (
          WHERE "responseDueAt" IS NOT NULL AND "firstResponseAt" <= "responseDueAt"
        ) AS "responseMet",
        COUNT(*) FILTER (
          WHERE "responseDueAt" IS NOT NULL
            AND ("firstResponseAt" > "responseDueAt"
              OR ("firstResponseAt" IS NULL AND "responseDueAt" < NOW()))
        ) AS "responseMissed",
        COUNT(*) FILTER (
          WHERE "resolutionDueAt" IS NOT NULL
            AND ("resolvedAt" IS NOT NULL OR "resolutionDueAt" < NOW())
        ) AS "resolutionEligible",
        COUNT(*) FILTER (
          WHERE "resolutionDueAt" IS NOT NULL AND "resolvedAt" <= "resolutionDueAt"
        ) AS "resolutionMet",
        COUNT(*) FILTER (
          WHERE "resolutionDueAt" IS NOT NULL
            AND ("resolvedAt" > "resolutionDueAt"
              OR ("resolvedAt" IS NULL AND "resolutionDueAt" < NOW()))
        ) AS "resolutionMissed"
      FROM "Ticket"
      WHERE "organizationId" = ${organizationId}::uuid
    `);
    const responseEligible = Number(row.responseEligible);
    const resolutionEligible = Number(row.resolutionEligible);
    return {
      generatedAt: new Date().toISOString(),
      measure: 'elapsed minutes from ticket creation; business-hours policies are not configured',
      response: {
        eligible: responseEligible,
        met: Number(row.responseMet),
        missed: Number(row.responseMissed),
        compliancePercent: this.percent(Number(row.responseMet), responseEligible),
      },
      resolution: {
        eligible: resolutionEligible,
        met: Number(row.resolutionMet),
        missed: Number(row.resolutionMissed),
        compliancePercent: this.percent(Number(row.resolutionMet), resolutionEligible),
      },
    };
  }

  private percent(numerator: number, denominator: number) {
    return denominator === 0
      ? null
      : Math.round((numerator / denominator) * 10_000) / 100;
  }
}
