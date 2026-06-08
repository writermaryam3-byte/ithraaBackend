import { Module } from '@nestjs/common';
import { DeprecatedTestsController } from './deprecated-tests.controller';

@Module({
  controllers: [DeprecatedTestsController],
})
export class LegacyTestsModule {}
