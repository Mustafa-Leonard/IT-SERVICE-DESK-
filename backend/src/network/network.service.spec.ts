import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DeviceStatus, StatusSource } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { NetworkService } from './network.service.js';

describe('NetworkService', () => {
  const actor: AuthPrincipal = {
    userId: '5bd7dd3e-c50c-4a3e-83c0-7ef06bd08c07',
    organizationId: '3c1b42a3-2b55-4ffb-922a-2d38524423b1',
    email: 'network@example.org',
    displayName: 'Network administrator',
    roles: ['network_administrator'],
    permissions: ['network.read', 'network.manage'],
  };

  it('records device status as manual and adds status history', async () => {
    const transaction = {
      networkDevice: {
        update: vi.fn().mockResolvedValue({ id: 'device-id', status: DeviceStatus.ONLINE }),
      },
      deviceStatusHistory: { create: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prismaMock = {
      networkDevice: {
        findFirst: vi.fn().mockResolvedValue({ id: 'device-id' }),
      },
      $transaction: vi.fn((work: (tx: typeof transaction) => Promise<unknown>) =>
        work(transaction),
      ),
    };
    const module = await Test.createTestingModule({
      providers: [
        NetworkService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    const service = module.get(NetworkService);

    await service.updateDeviceStatus(
      'device-id',
      { status: DeviceStatus.ONLINE },
      actor,
    );

    expect(transaction.networkDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statusSource: StatusSource.MANUAL }),
      }),
    );
    expect(transaction.deviceStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DeviceStatus.ONLINE,
          source: StatusSource.MANUAL,
        }),
      }),
    );
  });

  it('rejects IP addresses outside the selected subnet before writing', async () => {
    const prismaMock = {
      subnet: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'subnet-id',
          cidr: '192.0.2.0/24',
        }),
      },
      ipAddress: { create: vi.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        NetworkService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    const service = module.get(NetworkService);

    await expect(
      service.createIpAddress(
        {
          address: '198.51.100.10',
          assignmentType: 'STATIC',
          subnetId: 'subnet-id',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.ipAddress.create).not.toHaveBeenCalled();
  });
});
