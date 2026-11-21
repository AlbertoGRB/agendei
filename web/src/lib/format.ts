// Textos de preço, duração, data e hora, em português.

const price = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

// 5000 → "R$ 50,00". O preço vem em centavos (RN02).
export function formatPrice(cents: number): string {
  return price.format(cents / 100);
}

// 30 → "30 min", 60 → "1 h", 90 → "1 h 30 min".
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// Hora de um instante no fuso do prestador: "09:00".
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

// Dia e hora no fuso do prestador: "segunda-feira, 7 de janeiro, às 09:00".
export function formatWhen(iso: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(new Date(iso));
  return `${day}, às ${formatTime(iso, timeZone)}`;
}

// Nome do fuso: "Horário Padrão de Brasília".
export function timeZoneName(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    timeZoneName: 'longGeneric',
  }).formatToParts(new Date());
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? timeZone;
}

// Os próximos `count` dias, a partir de hoje, no formato AAAA-MM-DD da API.
export function nextDays(count: number, today = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + i,
    );
    const month = String(day.getMonth() + 1).padStart(2, '0');
    const date = String(day.getDate()).padStart(2, '0');
    return `${day.getFullYear()}-${month}-${date}`;
  });
}

// "2030-01-07" → { weekday: "seg.", date: "07/01", full: "segunda-feira,
// 7 de janeiro" }. Lê a data ao meio-dia local, para o fuso não mudar o dia.
export function dayLabel(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  const noon = new Date(year, month - 1, date, 12);
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('pt-BR', options).format(noon);
  return {
    weekday: format({ weekday: 'short' }),
    date: format({ day: '2-digit', month: '2-digit' }),
    full: format({ weekday: 'long', day: 'numeric', month: 'long' }),
  };
}
