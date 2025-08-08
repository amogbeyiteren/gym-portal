import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ClientModule } from './client/client.module';
import { AdminModule } from './admin/admin.module';
import { MembershipModule } from './membership/membership.module';
import { StoreModule } from './store/store.module';
import { FileUploadModule } from './file-upload/file-upload.module';
import { EmailModule } from './email/email.module';
import { PaystackModule } from './paystack/paystack.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60,
      limit: 10,
    }]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
    DatabaseModule,
    AuthModule,
    ClientModule,
    AdminModule,
    MembershipModule,
    StoreModule,
    FileUploadModule,
    EmailModule,
    PaystackModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}