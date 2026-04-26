import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { getEnv } from '@regirl/config';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { StylesModule } from './styles/styles.module';
import { SessionsModule } from './sessions/sessions.module';
import { AdminModule } from './admin/admin.module';

const env = getEnv();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: env.JWT_EXPIRES_IN }
    }),
    AuthModule,
    HealthModule,
    StylesModule,
    SessionsModule,
    AdminModule
  ]
})
export class AppModule {}
