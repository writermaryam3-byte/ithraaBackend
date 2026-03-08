import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from 'src/users/users.module';
import { ConfigService } from '@nestjs/config';
import { SessionModule } from 'src/session/session.module';
import { SignupStrategyFactory } from './factories/signup.factory';

@Module({
  providers: [AuthService, JwtStrategy, SignupStrategyFactory],
  controllers: [AuthController],
  imports: [
    SessionModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRESIN') },
      }),
    }),
    UsersModule,
  ],
})
export class AuthModule {}
