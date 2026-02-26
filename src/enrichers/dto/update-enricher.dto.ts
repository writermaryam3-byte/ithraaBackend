import { PartialType } from '@nestjs/mapped-types';
import { CreateEnricherDto } from './create-enricher.dto';

export class UpdateEnricherDto extends PartialType(CreateEnricherDto) {}
