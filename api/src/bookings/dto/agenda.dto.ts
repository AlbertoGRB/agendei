import { ApiProperty } from '@nestjs/swagger';
import { BookingDto } from './booking.dto.js';

export class AgendaDto {
  @ApiProperty({ example: '2026-11-23' })
  date: string;

  @ApiProperty({
    example: 'America/Sao_Paulo',
    description: 'Fuso do prestador, em que o dia foi interpretado',
  })
  timezone: string;

  @ApiProperty({
    type: [BookingDto],
    description: 'Reservas confirmadas que começam no dia, em ordem de horário',
  })
  bookings: BookingDto[];
}
