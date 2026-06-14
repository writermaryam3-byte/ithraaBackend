import { GoneException } from '@nestjs/common';
import { DeprecatedTestsController } from './deprecated-tests.controller';

describe('DeprecatedTestsController', () => {
  const controller = new DeprecatedTestsController();

  it('returns 410 Gone for legacy tests endpoints', () => {
    expect(() => controller.root()).toThrow(GoneException);
    expect(() => controller.nested()).toThrow(GoneException);
  });
});
