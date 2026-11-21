import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { AvailabilityWindowDto } from './availability-window.dto.js';

// Usado no corpo do PUT e na resposta: a semana inteira de uma vez.
export class AvailabilityDto {
  @ApiProperty({
    type: [AvailabilityWindowDto],
    description:
      'Janelas de atendimento da semana. Salvar substitui a semana inteira, e uma lista vazia tira toda a disponibilidade',
  })
  @IsArray({ message: 'windows deve ser uma lista' })
  // Até 10 janelas por dia já sobra.
  @ArrayMaxSize(70, { message: 'Janelas demais na semana' })
  @ValidateNested({ each: true })
  @Type(() => AvailabilityWindowDto)
  windows: AvailabilityWindowDto[];
}
