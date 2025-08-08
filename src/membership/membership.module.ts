import { Module } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { MembershipController } from './membership.controller';
import { PaystackModule } from '../paystack/paystack.module';
import { StoreModule } from '../store/store.module';

@Module({
  imports: [PaystackModule, StoreModule],
  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}