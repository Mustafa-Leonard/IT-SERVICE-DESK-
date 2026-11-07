import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';
import { SlaPoliciesController } from './sla-policies.controller.js';
import { SlaPoliciesService } from './sla-policies.service.js';

@Module({
  controllers: [TicketsController, SlaPoliciesController],
  providers: [TicketsService, SlaPoliciesService],
})
export class TicketsModule {}
