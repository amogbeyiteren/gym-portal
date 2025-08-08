import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PaystackService } from '../paystack/paystack.service';
import { EmailService } from '../email/email.service';
import { CreateStoreItemDto, UpdateStoreItemDto } from './dto/store-item.dto';
import { CreatePurchaseDto, VerifyPurchaseDto } from './dto/purchase.dto';
import { PurchaseStatus, DeliveryOption, MembershipStatus } from '@prisma/client';
import { FileUploadService } from 'src/file-upload/file-upload.service';

@Injectable()
export class StoreService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly paystackService: PaystackService,
    private readonly emailService: EmailService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  // Store Item Management (Admin only)
  async createStoreItem(createStoreItemDto: CreateStoreItemDto, image: Express.Multer.File) {
    const storeItem = await this.databaseService.storeItem.create({
      data: {
        ...createStoreItemDto,
        imageUrl: image ? await this.fileUploadService.uploadFile(image.buffer, image.originalname, image.mimetype) : null,
      },
    });

    return storeItem;
  }

  async findAllStoreItems(includeInactive: boolean = false) {
    const storeItems = await this.databaseService.storeItem.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return storeItems;
  }

  async findOneStoreItem(id: string) {
    const storeItem = await this.databaseService.storeItem.findUnique({
      where: { id },
    });

    if (!storeItem) {
      throw new NotFoundException('Store item not found');
    }

    return storeItem;
  }

  async updateStoreItem(id: string, updateStoreItemDto: UpdateStoreItemDto, image: Express.Multer.File) {
    const existingItem = await this.findOneStoreItem(id);

    const updatedItem = await this.databaseService.storeItem.update({
      where: { id },
      data: {
        ...updateStoreItemDto,
        imageUrl: image ? await this.fileUploadService.uploadFile(image.buffer, image.originalname, image.mimetype) : null,
      },
    });

    return updatedItem;
  }

  async removeStoreItem(id: string) {
    const existingItem = await this.findOneStoreItem(id);

    await this.databaseService.storeItem.delete({
      where: { id },
    });

    return { message: 'Store item deleted successfully' };
  }

  // Purchase Management
  async createPurchase(clientId: string, createPurchaseDto: CreatePurchaseDto) {
    // Check if client has active membership
    const client = await this.databaseService.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (client.membershipStatus !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('Active membership required to make purchases');
    }

    // Validate delivery address for delivery option
    if (createPurchaseDto.deliveryOption === DeliveryOption.DELIVERY && !createPurchaseDto.deliveryAddress) {
      throw new BadRequestException('Delivery address is required for delivery option');
    }

    // Validate items and calculate total
    let totalAmount = 0;
    const purchaseItems = [];

    for (const item of createPurchaseDto.items) {
      const storeItem = await this.databaseService.storeItem.findUnique({
        where: { id: item.storeItemId },
      });

      if (!storeItem) {
        throw new NotFoundException(`Store item with ID ${item.storeItemId} not found`);
      }

      if (!storeItem.isActive) {
        throw new BadRequestException(`Store item ${storeItem.name} is not available`);
      }

      if (storeItem.quantity < item.quantity) {
        throw new BadRequestException(`Insufficient quantity for ${storeItem.name}. Available: ${storeItem.quantity}`);
      }

      const itemTotal = parseFloat(storeItem.price.toString()) * item.quantity;
      totalAmount += itemTotal;

      purchaseItems.push({
        storeItemId: item.storeItemId,
        quantity: item.quantity,
        unitPrice: storeItem.price,
        totalPrice: itemTotal,
      });
    }

    // Generate payment reference
    const reference = this.paystackService.generateReference('purchase');

    // Create purchase record
    const purchase = await this.databaseService.purchase.create({
      data: {
        clientId,
        totalAmount,
        deliveryOption: createPurchaseDto.deliveryOption,
        deliveryAddress: createPurchaseDto.deliveryAddress,
        paymentReference: reference,
        purchaseItems: {
          create: purchaseItems,
        },
      },
      include: {
        purchaseItems: {
          include: {
            storeItem: true,
          },
        },
      },
    });

    // Initialize payment with Paystack
    const paymentData = await this.paystackService.initializeTransaction(
      client.email,
      this.paystackService.convertToKobo(totalAmount),
      reference,
      {
        client_id: clientId,
        purchase_id: purchase.id,
        payment_type: 'store_purchase',
        delivery_option: createPurchaseDto.deliveryOption,
      },
    );

    return {
      purchase,
      payment: {
        authorization_url: paymentData.data.authorization_url,
        access_code: paymentData.data.access_code,
        reference: paymentData.data.reference,
      },
    };
  }

  async verifyPurchase(verifyPurchaseDto: VerifyPurchaseDto) {
    // Verify payment with Paystack
    const verificationData = await this.paystackService.verifyTransaction(verifyPurchaseDto.reference);

    if (!verificationData.status || verificationData.data.status !== 'success') {
      throw new BadRequestException('Payment verification failed');
    }

    // Get purchase from metadata
    const purchaseId = verificationData.data.metadata?.purchase_id;
    if (!purchaseId) {
      throw new BadRequestException('Invalid payment metadata');
    }

    // Update purchase status and reduce inventory
    const purchase = await this.databaseService.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        client: true,
        purchaseItems: {
          include: {
            storeItem: true,
          },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    if (purchase.paymentVerified) {
      throw new BadRequestException('Purchase already verified');
    }

    // Update purchase status
    const updatedPurchase = await this.databaseService.purchase.update({
      where: { id: purchaseId },
      data: {
        status: PurchaseStatus.COMPLETED,
        paymentVerified: true,
      },
      include: {
        client: true,
        purchaseItems: {
          include: {
            storeItem: true,
          },
        },
      },
    });

    // Reduce inventory for each item
    for (const item of updatedPurchase.purchaseItems) {
      await this.databaseService.storeItem.update({
        where: { id: item.storeItemId },
        data: {
          quantity: {
            decrement: item.quantity,
          },
        },
      });
    }

    // Send confirmation emails
    try {
      await this.emailService.sendPurchaseConfirmationToClient(updatedPurchase);
      await this.emailService.sendPurchaseNotificationToAdmin(updatedPurchase);
    } catch (error) {
      console.error('Failed to send email notifications:', error);
      // Don't fail the verification if email fails
    }

    return {
      message: 'Purchase verified successfully',
      purchase: updatedPurchase,
      payment: {
        reference: verificationData.data.reference,
        amount: this.paystackService.convertFromKobo(verificationData.data.amount),
        paid_at: verificationData.data.paid_at,
      },
    };
  }

  async findAllPurchases() {
    const purchases = await this.databaseService.purchase.findMany({
      include: {
        client: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        purchaseItems: {
          include: {
            storeItem: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return purchases;
  }

  async findOnePurchase(id: string) {
    const purchase = await this.databaseService.purchase.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        purchaseItems: {
          include: {
            storeItem: true,
          },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    return purchase;
  }

  async handleWebhook(payload: any) {
    // Handle Paystack webhook for store purchases
    if (payload.event === 'charge.success') {
      const { reference, metadata } = payload.data;
      
      if (metadata?.payment_type === 'store_purchase') {
        try {
          await this.verifyPurchase({ reference });
          console.log(`Store purchase verified for reference: ${reference}`);
        } catch (error) {
          console.error(`Webhook verification failed for reference ${reference}:`, error);
        }
      }
    }
  }
}