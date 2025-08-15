import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
const QRCode = require('qrcode');
import { DatabaseService } from '../database/database.service';
import { AuthService } from '../auth/auth.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import { CreateClientDto } from './dto/create-client.dto';
import {
  UpdateClientDto,
  UpdateClientMembershipAsActiveDto,
} from './dto/update-client.dto';
import { LoginClientDto } from './dto/login-client.dto';
import { MembershipStatus } from 'generated/prisma';

@Injectable()
export class ClientService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly authService: AuthService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async signup(
    createClientDto: CreateClientDto,
    profileImage: Express.Multer.File,
  ) {
    // Check if email already exists
    const existingClient = await this.databaseService.client.findUnique({
      where: { email: createClientDto.email },
    });

    if (existingClient) {
      throw new ConflictException('Email already registered');
    }

    let profileImageUrl = null;

    if (profileImage) {
      profileImageUrl = await this.fileUploadService.uploadFile(
        profileImage.buffer,
        profileImage.originalname,
        profileImage.mimetype,
      );
    }

    // Hash password
    const hashedPassword = await this.authService.hashPassword(
      createClientDto.password,
    );

    // Create client
    const client = await this.databaseService.client.create({
      data: {
        ...createClientDto,
        password: hashedPassword,
        ...(profileImageUrl && { profileImage: profileImageUrl }),
      },
    });

    // Generate QR code
    const qrCodeUrl = await this.generateQRCode(client.id);

    // Update client with QR code URL
    const updatedClient = await this.databaseService.client.update({
      where: { id: client.id },
      data: { qrCodeUrl },
    });

    // Generate JWT token
    const token = await this.authService.generateToken({
      sub: client.id,
      email: client.email,
      type: 'client',
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...clientWithoutPassword } = updatedClient;

    return {
      access_token: token,
      client: clientWithoutPassword,
    };
  }

  async login(loginClientDto: LoginClientDto) {
    return await this.authService.loginClient(
      loginClientDto.email,
      loginClientDto.password,
    );
  }

  async findAll(page: number = 1, limit: number = 10) {
    // Ensure page and limit are at least 1
    const currentPage = Math.max(page, 1);
    const pageSize = Math.max(limit, 1);

    // Count total clients for pagination metadata
    const totalClients = await this.databaseService.client.count();

    // Fetch paginated data
    const clients = await this.databaseService.client.findMany({
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        qrCodeUrl: true,
        membershipStatus: true,
        membershipPaidDate: true,
        membershipDueDate: true,
        membershipLastPaidAmount: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            purchases: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // optional, keeps results ordered
      },
    });

    return {
      data: clients,
      pagination: {
        total: totalClients,
        page: currentPage,
        limit: pageSize,
        totalPages: Math.ceil(totalClients / pageSize),
      },
    };
  }

  async updateClientMembershipAsActive(
    clientId: string,
    updateClientMembershipAsActive: UpdateClientMembershipAsActiveDto,
  ) {
    const { membershipDueDate, membershipPaidDate, amount } =
      updateClientMembershipAsActive;

    const existingClient = await this.databaseService.client.findUnique({
      where: { id: clientId },
    });

    if (!existingClient) {
      throw new NotFoundException('Client not found');
    }

    const updatedClient = await this.databaseService.client.update({
      where: { id: clientId },
      data: {
        membershipStatus: MembershipStatus.ACTIVE,
        membershipDueDate,
        membershipPaidDate,
        membershipLastPaidAmount: amount,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        qrCodeUrl: true,
        membershipStatus: true,
        membershipPaidDate: true,
        membershipDueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedClient;
  }

  async updateClientMembershipAsInactive(clientId: string) {
    const existingClient = await this.databaseService.client.findUnique({
      where: { id: clientId },
    });

    if (!existingClient) {
      throw new NotFoundException('Client not found');
    }

    const updatedClient = await this.databaseService.client.update({
      where: { id: clientId },
      data: {
        membershipStatus: MembershipStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        qrCodeUrl: true,
        membershipStatus: true,
        membershipPaidDate: true,
        membershipDueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedClient;
  }

  async findOne(id: string) {
    const client = await this.databaseService.client.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        qrCodeUrl: true,
        membershipStatus: true,
        membershipPaidDate: true,
        membershipDueDate: true,
        createdAt: true,
        updatedAt: true,
        purchases: {
          include: {
            purchaseItems: {
              include: {
                storeItem: true,
              },
            },
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async findMe(userId: string) {
    return await this.findOne(userId);
  }

  async update(
    id: string,
    updateClientDto: UpdateClientDto,
    currentUserId: string,
    userType: string,
    profileImage: Express.Multer.File,
  ) {
    // Check if the client exists
    const existingClient = await this.databaseService.client.findUnique({
      where: { id },
    });

    if (!existingClient) {
      throw new NotFoundException('Client not found');
    }

    // Only allow clients to update their own profile (unless admin)
    if (userType !== 'admin' && currentUserId !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    let profileImageUrl = null;

    if (profileImage) {
      profileImageUrl = await this.fileUploadService.uploadFile(
        profileImage.buffer,
        profileImage.originalname,
        profileImage.mimetype,
      );
    }

    const updatedClient = await this.databaseService.client.update({
      where: { id },
      data: {
        ...updateClientDto,
        ...(profileImageUrl && { profileImage: profileImageUrl }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        qrCodeUrl: true,
        membershipStatus: true,
        membershipPaidDate: true,
        membershipDueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedClient;
  }

  async remove(id: string) {
    const existingClient = await this.databaseService.client.findUnique({
      where: { id },
    });

    if (!existingClient) {
      throw new NotFoundException('Client not found');
    }

    await this.databaseService.client.delete({
      where: { id },
    });

    return { message: 'Client deleted successfully' };
  }

  async getClientPurchases(
    clientId: string,
    currentUserId: string,
    userType: string,
  ) {
    // Only allow clients to view their own purchases (unless admin)
    if (userType !== 'admin' && currentUserId !== clientId) {
      throw new ForbiddenException('You can only view your own purchases');
    }

    const purchases = await this.databaseService.purchase.findMany({
      where: { clientId },
      include: {
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

  private async generateQRCode(clientId: string): Promise<string> {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const qrData = `${frontendUrl}/client-detail/${clientId}`;

      // Generate QR code as buffer
      const qrCodeBuffer = await QRCode.toBuffer(qrData, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000', // QR code color
          light: '#FFFFFF', // Background color
        },
      });

      // Upload to Supabase Storage
      const fileName = `qr-codes/client-${clientId}-${Date.now()}.png`;
      const qrCodeUrl = await this.fileUploadService.uploadFile(
        qrCodeBuffer,
        fileName,
        'image/png',
      );

      return qrCodeUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }
}
