import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { EmailModule } from 'src/email/email.module';
import { ClientService } from './client.service';
import { ClientController } from './client.controller';
import { AuthModule } from '../auth/auth.module';
import { FileUploadModule } from '../file-upload/file-upload.module';

@Module({
  imports: [AuthModule, FileUploadModule, DatabaseModule, EmailModule],
  controllers: [ClientController],
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule {}