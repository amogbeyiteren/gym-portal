import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Welcome to Gym Portal API! Visit /api/docs for API documentation.';
  }
}