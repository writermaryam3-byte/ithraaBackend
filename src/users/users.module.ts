import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/user-roles.entity';
import { TeachersProvider } from './services/teachers.provider';
import { Teacher } from './entities/teacher.entity';
import { AuthProvider } from './services/auth.provider';
import { SignupStrategyFactory } from './factories/signup.factory';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './controllers/auth.controller';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailerModule } from 'src/mailer/mailer.module';
import { SessionModule } from 'src/session/session.module';
import { UsersService } from './services/users.service';
import { TeachersController } from './controllers/teachers.controller';

@Module({
  controllers: [UsersController, AuthController, TeachersController],
  providers: [
    UsersService,
    TeachersProvider,
    AuthProvider,
    JwtStrategy,
    SignupStrategyFactory,
  ],
  imports: [
    TypeOrmModule.forFeature([User, Role, Teacher]),
    MailerModule,
    SessionModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRESIN') },
      }),
    }),
  ],
  exports: [TypeOrmModule, UsersService, AuthProvider],
})
export class UsersModule {}
