import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let databaseService: DatabaseService;
  let jwtService: JwtService;

  const mockClient = {
    id: 'client-1',
    email: 'test@example.com',
    password: 'hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockAdmin = {
    id: 'admin-1',
    email: 'admin@example.com',
    password: 'hashedpassword',
    firstName: 'Admin',
    lastName: 'User',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DatabaseService,
          useValue: {
            client: {
              findUnique: jest.fn(),
            },
            admin: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const mockHash = 'hashedpassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(mockHash);

      const result = await service.hashPassword('password123');

      expect(result).toBe(mockHash);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
    });
  });

  describe('comparePasswords', () => {
    it('should return true for matching passwords', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.comparePasswords('password123', 'hashedpassword');

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedpassword');
    });

    it('should return false for non-matching passwords', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.comparePasswords('wrongpassword', 'hashedpassword');

      expect(result).toBe(false);
    });
  });

  describe('validateClient', () => {
    it('should validate client with correct credentials', async () => {
      jest.spyOn(databaseService.client, 'findUnique').mockResolvedValue(mockClient);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateClient('test@example.com', 'password123');

      expect(result).toEqual({
        id: mockClient.id,
        email: mockClient.email,
        firstName: mockClient.firstName,
        lastName: mockClient.lastName,
      });
    });

    it('should throw UnauthorizedException for non-existent client', async () => {
      jest.spyOn(databaseService.client, 'findUnique').mockResolvedValue(null);

      await expect(service.validateClient('test@example.com', 'password123'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      jest.spyOn(databaseService.client, 'findUnique').mockResolvedValue(mockClient);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateClient('test@example.com', 'wrongpassword'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('loginClient', () => {
    it('should return access token and client data', async () => {
      const clientWithoutPassword = {
        id: mockClient.id,
        email: mockClient.email,
        firstName: mockClient.firstName,
        lastName: mockClient.lastName,
      };

      jest.spyOn(service, 'validateClient').mockResolvedValue(clientWithoutPassword);
      jest.spyOn(jwtService, 'sign').mockReturnValue('jwt-token');

      const result = await service.loginClient('test@example.com', 'password123');

      expect(result).toEqual({
        access_token: 'jwt-token',
        client: clientWithoutPassword,
      });
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token', async () => {
      jest.spyOn(jwtService, 'sign').mockReturnValue('jwt-token');

      const payload = { sub: 'client-1', email: 'test@example.com', type: 'client' as const };
      const result = await service.generateToken(payload);

      expect(result).toBe('jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith(payload);
    });
  });
});