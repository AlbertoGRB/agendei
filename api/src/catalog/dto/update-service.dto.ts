import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateServiceDto } from './create-service.dto.js';

// Todos os campos são opcionais: só muda o que vier no corpo.
export class UpdateServiceDto extends PartialType(CreateServiceDto) {
  @ApiPropertyOptional({
    description:
      'false desativa o serviço: ele some para novas reservas, e as já feitas continuam valendo',
  })
  @IsOptional()
  @IsBoolean({ message: 'O campo active deve ser true ou false' })
  active?: boolean;
}
