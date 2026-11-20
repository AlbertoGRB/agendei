import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('responde que a API está de pé', () => {
    const controller = new HealthController();

    expect(controller.check()).toEqual({ status: 'ok' });
  });
});
