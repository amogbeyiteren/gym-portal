import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { LoginAdminDto } from './dto/login-admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly authService: AuthService) {}

  async login(loginAdminDto: LoginAdminDto) {
    return await this.authService.loginAdmin(loginAdminDto.email, loginAdminDto.password);
  }

  async getDashboardStats() {
    // This would typically fetch various statistics for the admin dashboard
    // For now, returning a placeholder structure
    return {
      totalClients: 0,
      activeMembers: 0,
      totalPurchases: 0,
      totalRevenue: 0,
      recentPurchases: [],
      membershipStats: {
        active: 0,
        inactive: 0,
        expired: 0,
      },
    };
  }
}