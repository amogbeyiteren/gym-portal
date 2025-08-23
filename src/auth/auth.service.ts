import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  async comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  async generateToken(payload: { sub: string; email: string; type: 'client' | 'admin' }): Promise<string> {
    return this.jwtService.sign(payload);
  }

  async generateForgotPasswordToken(payload: { sub: string; email: string; type: 'client' | 'admin'; purpose: 'reset-password' }): Promise<string> {
    return this.jwtService.sign(payload, { expiresIn: '1h' });
  }

  async verifyToken(token: string) {
    return this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
  }

  async validateClient(email: string, password: string) {
    const client = await this.databaseService.client.findUnique({
      where: { email },
    });

    if (!client) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.comparePasswords(password, client.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...result } = client;
    return { ...result, type: 'client' };
  }

  async validateAdmin(email: string, password: string) {
    const admin = await this.databaseService.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.comparePasswords(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...result } = admin;
    return { ...result, type: 'admin' };
  }

  async loginClient(email: string, password: string) {
    const client = await this.validateClient(email, password);
    
    const payload = { 
      sub: client.id, 
      email: client.email, 
      type: 'client' as const 
    };
    
    return {
      access_token: await this.generateToken(payload),
      client,
    };
  }

  async loginAdmin(email: string, password: string) {
    const admin = await this.validateAdmin(email, password);
    
    const payload = { 
      sub: admin.id, 
      email: admin.email, 
      type: 'admin' as const 
    };
    
    return {
      access_token: await this.generateToken(payload),
      admin,
    };
  }
}