import { ApiProperty } from '@nestjs/swagger';

export class SlotsDto {
  @ApiProperty({ example: '2026-11-23' })
  date: string;

  @ApiProperty({
    example: 'America/Sao_Paulo',
    description: 'Fuso do prestador, em que o dia foi interpretado',
  })
  timezone: string;

  @ApiProperty({
    type: [String],
    example: ['2026-11-23T12:00:00.000Z', '2026-11-23T12:30:00.000Z'],
    description:
      'Horários de início livres, em UTC. Lista vazia = sem horários',
  })
  slots: string[];
}
