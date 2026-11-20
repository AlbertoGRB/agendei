import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  // Usada pelo Railway para saber se a API está de pé.
  @Get()
  @ApiOkResponse({
    description: 'A API está respondendo',
    schema: { example: { status: 'ok' } },
  })
  check(): { status: string } {
    return { status: 'ok' };
  }
}
