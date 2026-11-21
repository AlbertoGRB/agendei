import { api, post } from './client';

// Serviços do próprio prestador, ativos e desativados.
export type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  active: boolean;
};

export type ServiceInput = Pick<
  Service,
  'name' | 'durationMinutes' | 'priceCents'
>;

export function listMyServices(): Promise<Service[]> {
  return api('/services');
}

export function createService(input: ServiceInput): Promise<Service> {
  return api('/services', post(input));
}

// Só muda o que vier: os campos do serviço ou o active.
export function updateService(
  id: string,
  changes: Partial<ServiceInput & { active: boolean }>,
): Promise<Service> {
  return api(`/services/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}
