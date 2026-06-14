import { Controller, All, GoneException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('tests (deprecated)')
@ApiBearerAuth()
@Controller('tests')
export class DeprecatedTestsController {
  private deprecated(): never {
    throw new GoneException(
      'The legacy tests module is deprecated. Use /api/evaluations instead.',
    );
  }

  @All()
  root() {
    return this.deprecated();
  }

  @All('*path')
  nested() {
    return this.deprecated();
  }
}
