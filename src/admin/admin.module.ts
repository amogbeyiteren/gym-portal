import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}