import { api } from './client';

export type ProviderService = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
};

// O que o cliente vê de um prestador: o nome e os serviços ativos.
export type Provider = {
  id: string;
  name: string;
  services: ProviderService[];
};

// Horários de início livres, em UTC, e o fuso do prestador, em que o dia foi
// interpretado (ADR 0005).
export type Slots = {
  date: string;
  timezone: string;
  slots: string[];
};

export function listProviders(): Promise<Provider[]> {
  return api('/providers');
}

export function getProvider(id: string): Promise<Provider> {
  return api(`/providers/${encodeURIComponent(id)}`);
}

export function getSlots(
  providerId: string,
  serviceId: string,
  date: string,
): Promise<Slots> {
  const query = new URLSearchParams({ serviceId, date });
  return api(`/providers/${encodeURIComponent(providerId)}/slots?${query}`);
}
