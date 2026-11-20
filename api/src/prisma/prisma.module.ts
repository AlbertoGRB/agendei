import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

// Global para os módulos não precisarem importar. Cada módulo continua
// usando só as próprias tabelas (regra da arquitetura).
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
