import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AvailabilityWindowDto } from './dto/availability-window.dto.js';

export type Window = { weekday: number; startTime: string; endTime: string };

const WEEKDAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

// Ordena por dia e por início. Horas no formato HH:mm comparam certo como texto.
function byDayAndStart(a: Window, b: Window): number {
  return a.weekday - b.weekday || a.startTime.localeCompare(b.startTime);
}

// RN03: início antes do fim e nenhuma janela sobreposta no mesmo dia.
// Encostar (12:00 a 14:00 depois de 09:00 a 12:00) não é sobrepor.
function findProblem(windows: Window[]): string | null {
  for (const window of windows) {
    if (window.startTime >= window.endTime) {
      return `Em ${WEEKDAYS[window.weekday]}, o início ${window.startTime} deve ser antes do fim ${window.endTime}`;
    }
  }
  const sorted = [...windows].sort(byDayAndStart);
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (
      current.weekday === previous.weekday &&
      current.startTime < previous.endTime
    ) {
      return `Em ${WEEKDAYS[current.weekday]}, as janelas ${previous.startTime}-${previous.endTime} e ${current.startTime}-${current.endTime} se sobrepõem`;
    }
  }
  return null;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async list(providerId: string, weekday?: number): Promise<Window[]> {
    const rows = await this.prisma.availability.findMany({
      where: { providerId, weekday },
    });
    return rows
      .map(({ weekday, startTime, endTime }) => ({
        weekday,
        startTime,
        endTime,
      }))
      .sort(byDayAndStart);
  }

  // Salvar substitui a semana inteira (RN03). Com erro, nada muda.
  async replace(
    providerId: string,
    windows: AvailabilityWindowDto[],
  ): Promise<Window[]> {
    const problem = findProblem(windows);
    if (problem) {
      throw new BadRequestException(problem);
    }
    await this.prisma.$transaction([
      this.prisma.availability.deleteMany({ where: { providerId } }),
      this.prisma.availability.createMany({
        data: windows.map((window) => ({ ...window, providerId })),
      }),
    ]);
    return this.list(providerId);
  }

  // Janelas de um dia da semana, para calcular os horários livres.
  forWeekday(providerId: string, weekday: number): Promise<Window[]> {
    return this.list(providerId, weekday);
  }
}
