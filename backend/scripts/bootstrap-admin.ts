import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import * as argon2 from 'argon2';
import { isBootstrapComplete } from '../src/auth/bootstrap-policy.js';

const projectEnv = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env');
if (existsSync(projectEnv)) loadEnv({ path: projectEnv });

const roleDefinitions = [
  {
    key: 'employee',
    name: 'Employee',
    description: 'Submit and view personal IT requests.',
    permissions: [
      'ticket.create',
      'ticket.read.own',
      'ticket.comment.public',
      'asset.read.own',
      'knowledge.read',
      'notification.read.own',
    ],
  },
  {
    key: 'it_technician',
    name: 'IT Technician',
    description: 'Work authorized support tickets and service operations.',
    permissions: [
      'ticket.read.assigned',
      'ticket.read.all',
      'ticket.assign',
      'ticket.update',
      'ticket.comment.public',
      'ticket.comment.internal',
      'incident.manage',
      'problem.manage',
      'change.manage',
      'maintenance.manage',
      'knowledge.manage',
      'asset.read',
    ],
  },
  {
    key: 'network_administrator',
    name: 'Network Administrator',
    description: 'Maintain network inventory and operational records.',
    permissions: [
      'network.read',
      'network.manage',
      'network.incident.manage',
      'network.maintenance.manage',
    ],
  },
  {
    key: 'it_asset_manager',
    name: 'IT Asset Manager',
    description: 'Manage the organizational asset lifecycle.',
    permissions: ['asset.read', 'asset.manage'],
  },
  {
    key: 'it_manager',
    name: 'IT Manager',
    description: 'Review operations, reports, and approvals.',
    permissions: [
      'ticket.read.all',
      'asset.read',
      'network.read',
      'report.read',
      'approval.manage',
      'user.read',
    ],
  },
];

const permissionDescriptions: Record<string, string> = {
  'ticket.create': 'Create support tickets.',
  'ticket.read.own': 'Read tickets requested by the current user.',
  'ticket.read.assigned': 'Read tickets assigned to the current technician.',
  'ticket.read.all': 'Read all organization tickets.',
  'ticket.assign': 'Assign or reassign organization tickets.',
  'ticket.assign.all': 'Reassign tickets owned by other technicians.',
  'ticket.update': 'Update ticket status, priority, and resolution.',
  'ticket.update.all': 'Update any ticket in the organization.',
  'ticket.comment.public': 'Add employee-visible ticket comments.',
  'ticket.comment.internal': 'Add internal-only ticket notes.',
  'incident.manage': 'Manage service incidents.',
  'problem.manage': 'Manage recurring problems and root causes.',
  'change.manage': 'Manage change requests and approvals.',
  'maintenance.manage': 'Manage service maintenance tasks.',
  'knowledge.read': 'Read published knowledge articles.',
  'knowledge.manage': 'Manage knowledge articles.',
  'asset.read.own': 'Read assets assigned to the current user.',
  'asset.read': 'Read organization assets.',
  'asset.manage': 'Manage the asset lifecycle.',
  'network.read': 'Read network inventory and documentation.',
  'network.manage': 'Manage network inventory and documentation.',
  'network.incident.manage': 'Manage network incidents.',
  'network.maintenance.manage': 'Manage network maintenance.',
  'report.read': 'Read management reports.',
  'approval.manage': 'Review and decide operational approvals.',
  'user.read': 'Read user accounts.',
  'user.manage': 'Create, update, and deactivate user accounts.',
  'role.manage': 'Manage organization roles and permissions.',
  'department.manage': 'Manage departments.',
  'location.manage': 'Manage locations.',
  'system.manage': 'Manage application settings.',
  'audit.read': 'Read audit and security events.',
  'notification.read.own': 'Read personal in-app notifications.',
};

const adminPermissions = Object.keys(permissionDescriptions);
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const displayName = process.env.ADMIN_DISPLAY_NAME?.trim();
const organizationName = process.env.ORGANIZATION_NAME?.trim();
const organizationSlug = process.env.ORGANIZATION_SLUG?.trim().toLowerCase();
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || !email || !password || !displayName || !organizationName || !organizationSlug) {
  throw new Error(
    'Set DATABASE_URL, ORGANIZATION_NAME, ORGANIZATION_SLUG, ADMIN_EMAIL, ADMIN_DISPLAY_NAME, and ADMIN_PASSWORD for this one-time command.',
  );
}
if (password.length < 16) {
  throw new Error('ADMIN_PASSWORD must contain at least 16 characters.');
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('ADMIN_EMAIL must be a valid email address.');
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organizationSlug)) {
  throw new Error('ORGANIZATION_SLUG must be lowercase alphanumeric words separated by hyphens.');
}

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5_000,
  max: 2,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const created = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw(
      Prisma.sql`DO $$ BEGIN PERFORM pg_advisory_xact_lock(hashtext('it-service-desk-bootstrap')); END $$`,
    );

    const organizationCount = await transaction.organization.count();
    const existingOrganization = await transaction.organization.findUnique({
      where: { slug: organizationSlug },
    });
    if (organizationCount > 0) {
      if (existingOrganization) {
        const existingAdmin = await transaction.user.findUnique({
          where: {
            organizationId_email: {
              organizationId: existingOrganization.id,
              email,
            },
          },
          include: { roles: { include: { role: true } } },
        });
        const alreadyInitialized = isBootstrapComplete({
          organizationCount,
          organizationName: existingOrganization.name,
          expectedOrganizationName: organizationName,
          admin: existingAdmin
            ? {
                isActive: existingAdmin.isActive,
                emailVerified: Boolean(existingAdmin.emailVerifiedAt),
                displayName: existingAdmin.displayName,
                roleKeys: existingAdmin.roles.map(({ role }) => role.key),
              }
            : undefined,
          expectedDisplayName: displayName,
        });
        if (alreadyInitialized) return false;
      }

      throw new Error('Bootstrap refused: an organization is already initialized.');
    }

    const organization = await transaction.organization.create({
      data: { name: organizationName, slug: organizationSlug },
    });
    await transaction.permission.createMany({
      data: adminPermissions.map((key) => ({
        key,
        description: permissionDescriptions[key],
      })),
    });

    const permissionRecords = await transaction.permission.findMany();
    const permissionIds = new Map(
      permissionRecords.map((permission) => [permission.key, permission.id]),
    );
    for (const definition of roleDefinitions) {
      await transaction.role.create({
        data: {
          organizationId: organization.id,
          key: definition.key,
          name: definition.name,
          description: definition.description,
          isSystem: true,
          permissions: {
            create: definition.permissions.map((key) => {
              const permissionId = permissionIds.get(key);
              if (!permissionId) throw new Error(`Missing seeded permission: ${key}`);
              return { permission: { connect: { id: permissionId } } };
            }),
          },
        },
      });
    }
    const superAdmin = await transaction.role.create({
      data: {
        organizationId: organization.id,
        key: 'super_admin',
        name: 'Super Administrator',
        description: 'Full administrative control of this organization.',
        isSystem: true,
        permissions: {
          create: [...permissionIds.values()].map((id) => ({
            permission: { connect: { id } },
          })),
        },
      },
    });
    await transaction.user.create({
      data: {
        organizationId: organization.id,
        email,
        displayName,
        passwordHash,
        isActive: true,
        emailVerifiedAt: new Date(),
        roles: {
          create: [{ roleId: superAdmin.id }],
        },
      },
    });
    return true;
  });
  console.info(
    created
      ? 'Initial organization and Super Administrator created.'
      : 'Initial organization and Super Administrator already exist; no changes made.',
  );
} finally {
  await prisma.$disconnect();
  await pool.end();
}
