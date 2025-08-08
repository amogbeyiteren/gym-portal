import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../../database/database.service';

export interface JwtPayload {
  sub: string;
  email: string;
  type: 'client' | 'admin';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly databaseService: DatabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type === 'client') {
      const client = await this.databaseService.client.findUnique({
        where: { id: payload.sub },
      });

      if (!client) {
        throw new UnauthorizedException('Client not found');
      }

      return { ...client, userType: 'client' };
    } else if (payload.type === 'admin') {
      const admin = await this.databaseService.admin.findUnique({
        where: { id: payload.sub },
      });

      if (!admin) {
        throw new UnauthorizedException('Admin not found');
      }

      return { ...admin, userType: 'admin' };
    }

    throw new UnauthorizedException('Invalid user type');
  }
}