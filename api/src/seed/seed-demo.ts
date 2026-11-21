import bcrypt from 'bcrypt';
import { localDateOf, localToUtc, weekdayOf } from '../bookings/local-time.js';
import { Role, type PrismaClient } from '../generated/prisma/client.js';

// Contas de demonstração, com dados fictícios. A senha é pública: está no
// README para quem quiser testar sem se cadastrar.
export const DEMO_PASSWORD = 'agendei-demo';
export const DEMO_PROVIDER = {
  name: 'Ana Souza',
  email: 'ana@example.com',
  role: Role.PROVIDER,
};
export const DEMO_CLIENT = {
  name: 'Carla Dias',
  email: 'carla@example.com',
  role: Role.CLIENT,
};
const TIMEZONE = 'America/Sao_Paulo';

const SERVICES = [
  { name: 'Corte', durationMinutes: 60, priceCents: 5000 },
  { name: 'Barba', durationMinutes: 30, priceCents: 3000 },
  { name: 'Corte e barba', durationMinutes: 90, priceCents: 7500 },
];

// Segunda a sexta, das 9h às 12h e das 14h às 18h. Sábado, das 9h às 13h.
const WEEK = [
  ...[1, 2, 3, 4, 5].flatMap((weekday) => [
    { weekday, startTime: '09:00', endTime: '12:00' },
    { weekday, startTime: '14:00', endTime: '18:00' },
  ]),
  { weekday: 6, startTime: '09:00', endTime: '13:00' },
];

export type DemoSummary = {
  services: number;
  windows: number;
  bookings: number;
};

function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount))
    .toISOString()
    .slice(0, 10);
}

// O dia útil (segunda a sexta) mais próximo de `date`, para frente ou para trás.
function workday(date: string, step: 1 | -1): string {
  let day = addDays(date, step);
  while (weekdayOf(day) === 0 || weekdayOf(day) === 6) {
    day = addDays(day, step);
  }
  return day;
}

// Cria as duas contas de demonstração ou volta elas ao estado inicial. Pode
// rodar quantas vezes for preciso: refaz os serviços, os horários e a agenda
// da prestadora, e as reservas da cliente, sem tocar em outras contas além
// das reservas feitas com a prestadora de demonstração.
//
// Fica fora dos módulos da API porque escreve em todas as tabelas de uma vez.
export async function seedDemo(
  prisma: PrismaClient,
  now = new Date(),
): Promise<DemoSummary> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  return prisma.$transaction(async (tx) => {
    const upsert = (user: typeof DEMO_PROVIDER | typeof DEMO_CLIENT) =>
      tx.user.upsert({
        where: { email: user.email },
        create: { ...user, passwordHash, timezone: TIMEZONE },
        update: {
          name: user.name,
          role: user.role,
          passwordHash,
          timezone: TIMEZONE,
        },
      });
    const ana = await upsert(DEMO_PROVIDER);
    const carla = await upsert(DEMO_CLIENT);

    const old = { OR: [{ providerId: ana.id }, { clientId: carla.id }] };
    await tx.notification.deleteMany({ where: { booking: old } });
    await tx.booking.deleteMany({ where: old });
    await tx.service.deleteMany({ where: { providerId: ana.id } });
    await tx.availability.deleteMany({ where: { providerId: ana.id } });

    const services = new Map<string, { id: string; durationMinutes: number }>();
    for (const service of SERVICES) {
      const created = await tx.service.create({
        data: { ...service, providerId: ana.id },
      });
      services.set(service.name, created);
    }
    await tx.availability.createMany({
      data: WEEK.map((window) => ({ ...window, providerId: ana.id })),
    });

    // As reservas ficam em volta do dia de hoje, para a agenda e "Minhas
    // reservas" nunca abrirem vazias: uma no último dia útil e quatro nos dois
    // próximos, uma delas cancelada.
    const today = localDateOf(now, TIMEZONE);
    const before = workday(today, -1);
    const next = workday(today, 1);
    const after = workday(next, 1);
    const bookings = [
      { service: 'Corte', date: before, time: '10:00', cancelled: false },
      { service: 'Corte', date: next, time: '10:00', cancelled: false },
      { service: 'Barba', date: next, time: '15:00', cancelled: false },
      {
        service: 'Corte e barba',
        date: after,
        time: '14:00',
        cancelled: false,
      },
      { service: 'Barba', date: after, time: '09:00', cancelled: true },
    ];
    for (const booking of bookings) {
      const service = services.get(booking.service)!;
      const startsAt = localToUtc(booking.date, booking.time, TIMEZONE);
      await tx.booking.create({
        data: {
          serviceId: service.id,
          providerId: ana.id,
          clientId: carla.id,
          startsAt,
          endsAt: new Date(
            startsAt.getTime() + service.durationMinutes * 60_000,
          ),
          status: booking.cancelled ? 'CANCELLED' : 'CONFIRMED',
          cancelledAt: booking.cancelled ? now : null,
        },
      });
    }

    return {
      services: SERVICES.length,
      windows: WEEK.length,
      bookings: bookings.length,
    };
  });
}
