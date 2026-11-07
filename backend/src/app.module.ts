import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment.js';
import { PrismaModule } from './database/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { OrganizationModule } from './organizations/organization.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AssetsModule } from './assets/assets.module.js';
import { NetworkModule } from './network/network.module.js';
import { KnowledgeModule } from './knowledge/knowledge.module.js';
import { AttachmentsModule } from './attachments/attachments.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { OperationsModule } from './operations/operations.module.js';
import { AdminModule } from './admin/admin.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
      validate: validateEnvironment,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrganizationModule,
    TicketsModule,
    NotificationsModule,
    AssetsModule,
    NetworkModule,
    KnowledgeModule,
    AttachmentsModule,
    ReportsModule,
    OperationsModule,
    AdminModule,
  ],
})
export class AppModule {}
