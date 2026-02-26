import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EnrichersService } from './enrichers.service';
import { CreateEnricherDto } from './dto/create-enricher.dto';
import { UpdateEnricherDto } from './dto/update-enricher.dto';

@Controller('enrichers')
export class EnrichersController {
  constructor(private readonly enrichersService: EnrichersService) {}

  @Post()
  create(@Body() createEnricherDto: CreateEnricherDto) {
    return this.enrichersService.create(createEnricherDto);
  }

  @Get()
  findAll() {
    return this.enrichersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.enrichersService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEnricherDto: UpdateEnricherDto) {
    return this.enrichersService.update(+id, updateEnricherDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.enrichersService.remove(+id);
  }
}
