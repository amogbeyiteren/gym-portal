import { Module } from '@nestjs/common';
import { StoreService } from './store.service';
import { StoreController } from './store.controller';
import { PaystackModule } from '../paystack/paystack.module';
import { EmailModule } from '../email/email.module';
import { FileUploadModule } from '../file-upload/file-upload.module';

@Module({
  imports: [PaystackModule, EmailModule, FileUploadModule],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}