import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientService } from './client.service';
import { DatabaseService } from '../database/database.service';
import { AuthService } from '../auth/auth.service';
import { FileUploadService } from '../file-upload/file-upload.service';

describe('ClientService', () => {
  let service: ClientService;
  let databaseService: DatabaseService;
  let authService: AuthService;
  let fileUploadService: FileUploadService;

  const mockClient = {
    id: 'client-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: 'hashedpassword',
    profileImage: null,
    qrCodeUrl: null,
    membershipStatus: 'INACTIVE',
    membershipPaidDate: null,
    membershipDueDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientService,
        {
          provide: DatabaseService,
          useValue: {
            client: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              findMany: jest.fn(),
            },
            purchase: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            hashPassword: jest.fn(),
            generateToken: jest.fn(),
            loginClient: jest.fn(),
          },
        },
        {
          provide: FileUploadService,
          useValue: {
            uploadFile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ClientService>(ClientService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    authService = module.get<AuthService>(AuthService);
    fileUploadService = module.get<FileUploadService>(FileUploadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signup', () => {
    const createClientDto = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should successfully create a new client', async () => {
      // Mock that email doesn't exist
      jest.spyOn(databaseService.client, 'findUnique').mockResolvedValue(null);
      
      // Mock password hashing
      jest.spyOn(authService, 'hashPassword').mockResolvedValue('hashedpassword');
      
      // Mock client creation
      jest.spyOn(databaseService.client, 'create').mockResolvedValue(mockClient);
      
      // Mock QR code upload
      jest.spyOn(fileUploadService, 'uploadFile').mockResolvedValue('https://storage.com/qr-code.png');
      
      // Mock client update with QR code
      const clientWithQR = { ...mockClient, qrCodeUrl: 'https://storage.com/qr-code.png' };
      jest.spyOn(databaseService.client, 'update').mockResolvedValue(clientWithQR);
      
      // Mock token generation
      jest.spyOn(authService, 'generateToken').mockResolvedValue('jwt-token');

      const result = await service.signup(createClientDto);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('client');
      expect(result.client).not.toHaveProperty('password');
      expect(databaseService.client.findUnique).toHaveBeenCalledWith({
        where: { email: createClientDto.email },
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      // Mock that email already exists
      jest.spyOn(databaseService.client, 'findUnique').mockResolvedValue(mockClient);

      await expect(service.signup(createClientDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should return a client by id', async () => {
      jest.spyOn(databaseService.client, 'findUnique').mockResolvedValue(mockClient);

      const result = await service.findOne('client-1');

      expect(result).toEqual(mockClient);
      expect(databaseService.client.findUnique).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException if client not found', async () => {
      jest.spyOn(databaseService.client, 'findUnique').mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all clients', async () => {
      const clients = [mockClient];
      jest.spyOn(databaseService.client, 'findMany').mockResolvedValue(clients);

      const result = await service.findAll();

      expect(result).toEqual(clients);
      expect(databaseService.client.findMany).toHaveBeenCalledWith({
        select: expect.any(Object),
      });
    });
  });

  describe('update', () => {
    const updateDto = { firstName: 'Jane' };

    it('should update client successfully', async () => {
      const updatedClient = { ...mockClient, firstName: 'Jane' };
      
      jest.spyOn(databaseService.client, 'findUnique').mockResolvedValue(mockClient);
      jest.spyOn(databaseService.client, 'update').mockResolvedValue(updatedClient);

      const result = await service.update('client-1', updateDto, 'client-1', 'client');

      expect(result).toEqual(updatedClient);
      expect(databaseService.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: updateDto,
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException if client not found', async () => {
      jest.spyOn(databaseService.client, 'findUnique').mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto, 'client-1', 'client'))
        .rejects.toThrow(NotFoundException);
    });
  });
});