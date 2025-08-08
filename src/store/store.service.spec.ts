import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { StoreService } from './store.service';
import { DatabaseService } from '../database/database.service';
import { PaystackService } from '../paystack/paystack.service';
import { EmailService } from '../email/email.service';
import { MembershipStatus, DeliveryOption, PurchaseStatus } from '@prisma/client';

describe('StoreService', () => {
  let service: StoreService;
  let databaseService: DatabaseService;
  let paystackService: PaystackService;
  let emailService: EmailService;

  const mockStoreItem = {
    id: 'item-1',
    name: 'Protein Powder',
    description: 'High quality protein',
    price: 15000,
    imageUrl: null,
    quantity: 50,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockClient = {
    id: 'client-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    membershipStatus: MembershipStatus.ACTIVE,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreService,
        {
          provide: DatabaseService,
          useValue: {
            storeItem: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            client: {
              findUnique: jest.fn(),
            },
            purchase: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: PaystackService,
          useValue: {
            initializeTransaction: jest.fn(),
            verifyTransaction: jest.fn(),
            generateReference: jest.fn(),
            convertToKobo: jest.fn(),
            convertFromKobo: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendPurchaseConfirmationToClient: jest.fn(),
            sendPurchaseNotificationToAdmin: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StoreService>(StoreService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    paystackService = module.get<PaystackService>(PaystackService);
    emailService = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createStoreItem', () => {
    const createDto = {
      name: 'Protein Powder',
      description: 'High quality protein',
      price: 15000,
      quantity: 50,
    };

    it('should create store item successfully', async () => {
      jest.spyOn(databaseService.storeItem, 'create').mockResolvedValue(mockStoreItem);

      const result = await service.createStoreItem(createDto);

      expect(result).toEqual(mockStoreItem);
      expect(databaseService.storeItem.create).toHaveBeenCalledWith({
        data: createDto,
      });
    });
  });

  describe('findAllStoreItems', () => {
    it('should return all active items by default', async () => {
      const items = [mockStoreItem];
      jest.spyOn(databaseService.storeItem, 'findMany').mockResolvedValue(items);

      const result = await service.findAllStoreItems();

      expect(result).toEqual(items);
      expect(databaseService.storeItem.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return all items including inactive when requested', async () => {
      const items = [mockStoreItem];
      jest.spyOn(databaseService.storeItem, 'findMany').mockResolvedValue(items);

      await service.findAllStoreItems(true);

      expect(databaseService.storeItem.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOneStoreItem', () => {
    it('should return store item by id', async () => {
      jest.spyOn(databaseService.storeItem, 'findUnique').mockResolvedValue(mockStoreItem);

      const result = await service.findOneStoreItem('item-1');

      expect(result).toEqual(mockStoreItem);
    });

    it('should throw NotFoundException if item not found', async () => {
      jest.spyOn(databaseService.storeItem, 'findUnique').mockResolvedValue(null);

      await expect(service.findOneStoreItem('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPurchase', () => {
    const createPurchaseDto = {
      items: [{ storeItemId: 'item-1', quantity: 2 }],
      deliveryOption: DeliveryOption.PICKUP,
    };

    it('should create purchase successfully', async () => {
      const mockPurchase = {
        id: 'purchase-1',
        clientId: 'client-1',
        totalAmount: 30000,
        status: PurchaseStatus.PENDING,
        deliveryOption: DeliveryOption.PICKUP,
        paymentReference: 'ref-123',
        purchaseItems: [],
      };

      // Mock client with active membership
      jest.spyOn(databaseService.client, 'findUnique').mockResolvedValue(mockClient);
      
      // Mock store item
      jest.spyOn(databaseService.storeItem, 'findUnique').mockResolvedValue(mockStoreItem);
      
      // Mock purchase creation
      jest.spyOn(databaseService.purchase, 'create').mockResolvedValue(mockPurchase);
      
      // Mock Paystack services
      jest.spyOn(paystackService, 'generateReference').mockReturnValue('ref-123');
      jest.spyOn(paystackService, 'convertToKobo').mockReturnValue(3000000);
      jest.spyOn(paystackService, 'initializeTransaction').mockResolvedValue({
        status: true,
        message: 'success',
        data: {
          authorization_url: 'https://paystack.com/pay',
          access_code: 'access-code',
          reference: 'ref-123',
        },
      });

      const result = await service.createPurchase('client-1', createPurchaseDto);

      expect(result).toHaveProperty('purchase');
      expect(result).toHaveProperty('payment');
      expect(result.payment.reference).toBe('ref-123');
    });

    it('should throw ForbiddenException for inactive membership', async () => {
      const inactiveClient = { ...mockClient, membershipStatus: MembershipStatus.INACTIVE };
      jest.spyOn(databaseService.client, 'findUnique').mockResolvedValue(inactiveClient);

      await expect(service.createPurchase('client-1', createPurchaseDto))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for delivery without address', async () => {
      const deliveryDto = {
        items: [{ storeItemId: 'item-1', quantity: 1 }],
        deliveryOption: DeliveryOption.DELIVERY,
      };

      jest.spyOn(databaseService.client, 'findUnique').mockResolvedValue(mockClient);

      await expect(service.createPurchase('client-1', deliveryDto))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for insufficient quantity', async () => {
      const insufficientQtyDto = {
        items: [{ storeItemId: 'item-1', quantity: 100 }], // More than available
        deliveryOption: DeliveryOption.PICKUP,
      };

      jest.spyOn(databaseService.client, 'findUnique').mockResolvedValue(mockClient);
      jest.spyOn(databaseService.storeItem, 'findUnique').mockResolvedValue(mockStoreItem);

      await expect(service.createPurchase('client-1', insufficientQtyDto))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStoreItem', () => {
    const updateDto = { price: 20000 };

    it('should update store item successfully', async () => {
      const updatedItem = { ...mockStoreItem, price: 20000 };
      
      jest.spyOn(service, 'findOneStoreItem').mockResolvedValue(mockStoreItem);
      jest.spyOn(databaseService.storeItem, 'update').mockResolvedValue(updatedItem);

      const result = await service.updateStoreItem('item-1', updateDto);

      expect(result).toEqual(updatedItem);
      expect(databaseService.storeItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: updateDto,
      });
    });
  });

  describe('removeStoreItem', () => {
    it('should delete store item successfully', async () => {
      jest.spyOn(service, 'findOneStoreItem').mockResolvedValue(mockStoreItem);
      jest.spyOn(databaseService.storeItem, 'delete').mockResolvedValue(mockStoreItem);

      const result = await service.removeStoreItem('item-1');

      expect(result).toEqual({ message: 'Store item deleted successfully' });
      expect(databaseService.storeItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
    });
  });
});