import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { ValidationError } from 'class-validator';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  const flattenValidationErrors = (
    errors: ValidationError[],
    parentPath = '',
    out: Record<string, string> = {},
  ) => {
    for (const err of errors) {
      const path = parentPath ? `${parentPath}.${err.property}` : err.property;

      const constraints = Object.values(err.constraints ?? {});
      if (constraints.length > 0) {
        // Keep the first message for each field (consistent with previous behavior)
        out[path] = constraints[0];
      }

      if (err.children && err.children.length > 0) {
        flattenValidationErrors(err.children, path, out);
      }
    }

    return out;
  };

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        return new BadRequestException(flattenValidationErrors(errors));
      },
    }),
  );

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Ithraa Backend')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth() // لو عندك JWT
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
