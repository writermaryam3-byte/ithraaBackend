import { Module } from '@nestjs/common';
import { EnrichersService } from './enrichers.service';
import { EnrichersController } from './enrichers.controller';
import { Enricher } from './entities/enricher.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  controllers: [EnrichersController],
  providers: [EnrichersService],
  imports: [TypeOrmModule.forFeature([Enricher])],
  exports: [TypeOrmModule],
})
export class EnrichersModule {}
