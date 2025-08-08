import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Headers,
  RawBody,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { MembershipService } from './membership.service';
import { InitializeMembershipPaymentDto, VerifyMembershipPaymentDto } from './dto/membership.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientGuard } from '../auth/guards/client.guard';
import { PaystackService } from '../paystack/paystack.service';
import { StoreService } from '../store/store.service';

@ApiTags('Membership')
@Controller('membership')
export class MembershipController {
  constructor(
    private readonly membershipService: MembershipService,
    private readonly paystackService: PaystackService,
    private readonly storeService: StoreService,
  ) {}

  @Post('initialize-payment')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, ClientGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initialize membership payment' })
  @ApiResponse({ status: 200, description: 'Payment initialized successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  initializePayment(
    @Body() initializeMembershipPaymentDto: InitializeMembershipPaymentDto,
    @Request() req,
  ) {
    return this.membershipService.initializeMembershipPayment(
      req.user.id,
      initializeMembershipPaymentDto.amount,
    );
  }

  @Post('verify-payment')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, ClientGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify membership payment' })
  @ApiResponse({ status: 200, description: 'Payment verified successfully' })
  @ApiResponse({ status: 400, description: 'Payment verification failed' })
  verifyPayment(@Body() verifyMembershipPaymentDto: VerifyMembershipPaymentDto) {
    return this.membershipService.verifyMembershipPayment(
      verifyMembershipPaymentDto.reference,
    );
  }

  @Get('status')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, ClientGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get membership status' })
  @ApiResponse({ status: 200, description: 'Membership status retrieved' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  getMembershipStatus(@Request() req) {
    return this.membershipService.getMembershipStatus(req.user.id);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paystack webhook for membership payments' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleWebhook(
    @RawBody() body: Buffer,
    @Headers('x-paystack-signature') signature: string,
  ) {
    // Verify webhook signature
    const payload = body.toString();
    const isValidSignature = this.paystackService.verifyWebhookSignature(payload, signature);

    if (!isValidSignature) {
      return { message: 'Invalid signature' };
    }

    const webhookData = JSON.parse(payload);
    if (webhookData.metadata?.payment_type === 'membership') {
      await this.membershipService.handleWebhook(webhookData);
    }
    else if (webhookData.metadata?.payment_type === 'subscription') {
      await this.storeService.handleWebhook(webhookData);
    }

    return { message: 'Webhook processed successfully' };
  }
}