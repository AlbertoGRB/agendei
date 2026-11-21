import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../../generated/prisma/client.js';

export class BookingPersonDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Ana Souza' })
  name: string;
}

export class BookingServiceDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Corte de cabelo' })
  name: string;

  @ApiProperty({ example: 60 })
  durationMinutes: number;

  @ApiProperty({ example: 5000, description: 'Em centavos' })
  priceCents: number;
}

// Mostra só o nome das pessoas, nunca o e-mail.
export class BookingDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiProperty({ example: '2026-11-23T12:00:00.000Z' })
  startsAt: string;

  @ApiProperty({ example: '2026-11-23T13:00:00.000Z' })
  endsAt: string;

  @ApiProperty({ type: String, nullable: true })
  cancelledAt: string | null;

  @ApiProperty({
    example: 'America/Sao_Paulo',
    description: 'Fuso do prestador, em que o horário da reserva vale',
  })
  timezone: string;

  @ApiProperty({ type: BookingServiceDto })
  service: BookingServiceDto;

  @ApiProperty({ type: BookingPersonDto })
  provider: BookingPersonDto;

  @ApiProperty({ type: BookingPersonDto })
  client: BookingPersonDto;
}
