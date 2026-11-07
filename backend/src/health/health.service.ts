import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<{
    status: 'ok';
    database: 'ok';
    checkedAt: string;
  }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(
        'Database readiness check failed',
        error instanceof Error ? error.name : 'UnknownError',
      );
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unavailable',
      });
    }

    return {
      status: 'ok',
      database: 'ok',
      checkedAt: new Date().toISOString(),
    };
  }
}
