import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message: null | string;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: any;
    log: any;
    fees: number;
    fees_split: null | any;
    authorization: any;
    customer: any;
    plan: any;
    split: any;
    order_id: null | string;
    paidAt: string;
    createdAt: string;
    requested_amount: number;
    pos_transaction_data: null | any;
    source: any;
    fees_breakdown: null | any;
  };
}

@Injectable()
export class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!this.secretKey) {
      throw new Error('PAYSTACK_SECRET_KEY environment variable is required');
    }
  }

  async initializeTransaction(
    email: string,
    amount: number, // Amount in kobo (smallest currency unit)
    reference: string,
    metadata?: any,
  ): Promise<PaystackInitializeResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email,
          amount,
          reference,
          metadata,
          callback_url: process.env.PAYSTACK_CALLBACK_URL,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('Paystack initialization error:', error.response?.data || error.message);
      throw new BadRequestException('Failed to initialize payment');
    }
  }

  async verifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('Paystack verification error:', error.response?.data || error.message);
      throw new BadRequestException('Failed to verify payment');
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(payload, 'utf-8')
      .digest('hex');

    return hash === signature;
  }

  generateReference(prefix: string = 'gym'): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    return `${prefix}_${timestamp}_${randomString}`;
  }

  convertToKobo(amount: number): number {
    return Math.round(amount * 100);
  }

  convertFromKobo(amount: number): number {
    return amount / 100;
  }
}