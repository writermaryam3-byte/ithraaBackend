import { Injectable } from '@nestjs/common';
import { CreateEnricherDto } from './dto/create-enricher.dto';
import { UpdateEnricherDto } from './dto/update-enricher.dto';

@Injectable()
export class EnrichersService {
  create(createEnricherDto: CreateEnricherDto) {
    return 'This action adds a new enricher';
  }

  findAll() {
    return `This action returns all enrichers`;
  }

  findOne(id: number) {
    return `This action returns a #${id} enricher`;
  }

  update(id: number, updateEnricherDto: UpdateEnricherDto) {
    return `This action updates a #${id} enricher`;
  }

  remove(id: number) {
    return `This action removes a #${id} enricher`;
  }
}
