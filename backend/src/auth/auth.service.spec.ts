import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service.js';
import { EmailService } from './email.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  it('rejects malformed refresh session identifiers before querying the database', async () => {
    const prismaMock = {
      refreshSession: { findUnique: vi.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: {
        getOrThrow: vi.fn().mockReturnValue('a'.repeat(32)),
        get: vi.fn().mockReturnValue(undefined),
          },
        },
        { provide: EmailService, useValue: {} },
      ],
    }).compile();
    const service = module.get(AuthService);

    await expect(service.refresh('not-a-uuid.secret')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prismaMock.refreshSession.findUnique).not.toHaveBeenCalled();
  });
});
