import { Controller } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EnrichersService } from '../services/enrichers.service';

@ApiTags('enrichers (service provider)')
@ApiBearerAuth()
@Controller('enrichers')
export class EnrichersController {
  constructor(private readonly enrichersService: EnrichersService) {}
}
