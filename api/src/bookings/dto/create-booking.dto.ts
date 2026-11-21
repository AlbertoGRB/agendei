import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsString } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o serviço' })
  serviceId: string;

  @ApiProperty({
    example: '2026-11-23T12:00:00.000Z',
    description:
      'Início da reserva, um dos horários livres devolvidos por /slots',
  })
  @IsISO8601({ strict: true }, { message: 'Informe o início em ISO 8601' })
  startsAt: string;
}
