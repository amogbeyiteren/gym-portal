import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { LoginAdminDto } from './dto/login-admin.dto';
import { DatabaseService } from 'src/database/database.service';
import { MembershipStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly authService: AuthService, private readonly databaseService: DatabaseService) {}

  async login(loginAdminDto: LoginAdminDto) {
    return await this.authService.loginAdmin(loginAdminDto.email, loginAdminDto.password);
  }

  async getDashboardStats() {
    const clients = await this.databaseService.client.findMany();
    const totalClients = clients.length;
    const activeClients = clients.filter(client => client.membershipStatus === MembershipStatus.ACTIVE).length;
    const inactiveClients = clients.filter(client => client.membershipStatus === MembershipStatus.INACTIVE).length;
    const expiredClients = clients.filter(client => client.membershipStatus === MembershipStatus.EXPIRED).length;
    const totalRevenue = clients.reduce((acc, client) => acc + client.membershipLastPaidAmount, 0);
    return {
      totalClients,
      activeClients,
      inactiveClients,
      expiredClients,
      totalRevenue,
    };
  }
}