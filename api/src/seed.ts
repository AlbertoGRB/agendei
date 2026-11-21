import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { seedDemo } from './seed/seed-demo.js';

// Só a configuração e o banco: o seed não sobe rotas nem fila.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
})
class SeedModule {}

// Cria ou refaz as contas de demonstração (npm run db:seed).
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn'],
  });
  try {
    const summary = await seedDemo(app.get(PrismaService));
    console.log(
      `Demonstração pronta: ${summary.services} serviços, ${summary.windows} horários na semana e ${summary.bookings} reservas.`,
    );
  } finally {
    await app.close();
  }
}
await bootstrap();
