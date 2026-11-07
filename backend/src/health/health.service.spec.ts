import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  let healthService: HealthService;
  const prismaMock = {
    $queryRaw: vi.fn(),
  };

  beforeEach(async () => {
    prismaMock.$queryRaw.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    healthService = module.get(HealthService);
  });

  it('reports the API and database as ready after a successful query', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(healthService.check()).resolves.toMatchObject({
      status: 'ok',
      database: 'ok',
      checkedAt: expect.any(String),
    });
  });

  it('reports database failure as service unavailable', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('database unavailable'));

    await expect(healthService.check()).rejects.toMatchObject({
      status: 503,
      response: { status: 'error', database: 'unavailable' },
    });
  });
});
