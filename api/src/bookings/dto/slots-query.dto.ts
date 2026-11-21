import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { DateQueryDto } from './date-query.dto.js';

export class SlotsQueryDto extends DateQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o serviço' })
  serviceId: string;
}
