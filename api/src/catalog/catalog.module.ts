import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { CatalogService } from './catalog.service.js';
import { ProvidersController } from './providers.controller.js';
import { ServicesController } from './services.controller.js';

@Module({
  imports: [UsersModule],
  controllers: [ServicesController, ProvidersController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
