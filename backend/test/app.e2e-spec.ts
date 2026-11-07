import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from './../src/database/prisma.service.js';
import { HealthController } from './../src/health/health.controller.js';
import { HealthService } from './../src/health/health.service.js';

describe('Health endpoint (e2e)', () => {
  let app: INestApplication<App>;
  const prismaMock = {
    $queryRaw: vi.fn(),
  };

  beforeEach(async () => {
    prismaMock.$queryRaw.mockReset();
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('reports readiness when the database query succeeds', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'ok',
          database: 'ok',
        });
        expect(new Date(body.checkedAt).toString()).not.toBe('Invalid Date');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
