import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Matches, Max, Min } from 'class-validator';

// Horas cheias ou meias, de 00:00 a 23:30: os horários de início saem de
// 30 em 30 minutos (RN04).
const TIME = /^([01]\d|2[0-3]):(00|30)$/;
const TIME_MESSAGE = 'Use o formato HH:mm, em hora cheia ou meia hora';

export class AvailabilityWindowDto {
  @ApiProperty({ example: 1, description: '0 = domingo, 6 = sábado' })
  @IsInt({ message: 'O dia da semana deve ser de 0 (domingo) a 6 (sábado)' })
  @Min(0, { message: 'O dia da semana deve ser de 0 (domingo) a 6 (sábado)' })
  @Max(6, { message: 'O dia da semana deve ser de 0 (domingo) a 6 (sábado)' })
  weekday: number;

  @ApiProperty({ example: '09:00', description: 'Hora local do prestador' })
  @Matches(TIME, { message: TIME_MESSAGE })
  startTime: string;

  @ApiProperty({ example: '12:00', description: 'Hora local do prestador' })
  @Matches(TIME, { message: TIME_MESSAGE })
  endTime: string;
}
