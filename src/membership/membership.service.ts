import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PaystackService } from '../paystack/paystack.service';
import { MembershipStatus } from '@prisma/client';

@Injectable()
export class MembershipService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly paystackService: PaystackService,
  ) {}

  async initializeMembershipPayment(clientId: string, amount: number) {
    // Get client details
    const client = await this.databaseService.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Check if client already has active membership
    if (client.membershipStatus === MembershipStatus.ACTIVE) {
      throw new BadRequestException('Client already has an active membership');
    }

    // Generate reference
    const reference = this.paystackService.generateReference('membership');

    // Initialize payment with Paystack
    const paymentData = await this.paystackService.initializeTransaction(
      client.email,
      this.paystackService.convertToKobo(amount),
      reference,
      {
        client_id: clientId,
        payment_type: 'membership',
        amount_naira: amount,
      },
    );

    // Update client with payment reference (for tracking)
    await this.databaseService.client.update({
      where: { id: clientId },
      data: {
        membershipPaymentRef: reference,
      },
    });

    return {
      authorization_url: paymentData.data.authorization_url,
      access_code: paymentData.data.access_code,
      reference: paymentData.data.reference,
    };
  }

  async verifyMembershipPayment(reference: string) {
    // Verify payment with Paystack
    const verificationData = await this.paystackService.verifyTransaction(reference);

    if (!verificationData.status || verificationData.data.status !== 'success') {
      throw new BadRequestException('Payment verification failed');
    }

    // Get client from metadata
    const clientId = verificationData.data.metadata?.client_id;
    if (!clientId) {
      throw new BadRequestException('Invalid payment metadata');
    }

    // Update client membership status
    const membershipDuration = 30; // 30 days membership
    const membershipDueDate = new Date();
    membershipDueDate.setDate(membershipDueDate.getDate() + membershipDuration);

    const updatedClient = await this.databaseService.client.update({
      where: { id: clientId },
      data: {
        membershipStatus: MembershipStatus.ACTIVE,
        membershipPaidDate: new Date(),
        membershipDueDate,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        membershipStatus: true,
        membershipPaidDate: true,
        membershipDueDate: true,
      },
    });

    return {
      message: 'Membership payment verified successfully',
      client: updatedClient,
      payment: {
        reference: verificationData.data.reference,
        amount: this.paystackService.convertFromKobo(verificationData.data.amount),
        paid_at: verificationData.data.paid_at,
      },
    };
  }

  async getMembershipStatus(clientId: string) {
    const client = await this.databaseService.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        membershipStatus: true,
        membershipPaidDate: true,
        membershipDueDate: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Check if membership has expired
    const now = new Date();
    const isExpired = client.membershipDueDate && client.membershipDueDate < now;

    if (isExpired && client.membershipStatus === MembershipStatus.ACTIVE) {
      // Update membership status to expired
      await this.databaseService.client.update({
        where: { id: clientId },
        data: {
          membershipStatus: MembershipStatus.EXPIRED,
        },
      });

      client.membershipStatus = MembershipStatus.EXPIRED;
    }

    return {
      status: client.membershipStatus,
      paidDate: client.membershipPaidDate,
      dueDate: client.membershipDueDate,
      isExpired,
      daysRemaining: client.membershipDueDate
        ? Math.ceil((client.membershipDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0,
    };
  }

  async handleWebhook(payload: any) {
    // Handle Paystack webhook for membership payments
    if (payload.event === 'charge.success') {
      const { reference, metadata } = payload.data;
      
      if (metadata?.payment_type === 'membership') {
        try {
          await this.verifyMembershipPayment(reference);
          console.log(`Membership payment verified for reference: ${reference}`);
        } catch (error) {
          console.error(`Webhook verification failed for reference ${reference}:`, error);
        }
      }
    }
  }
}