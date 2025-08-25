import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import {
  UpdateClientDto,
  UpdateClientMembershipAsActiveDto,
} from './dto/update-client.dto';
import { LoginClientDto } from './dto/login-client.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ClientGuard } from '../auth/guards/client.guard';
import { FormDataRequest } from 'nestjs-form-data';
import { FileInterceptor } from '@nestjs/platform-express';
import { MembershipStatus } from '@prisma/client';

@ApiTags('Clients')
@UseGuards(ThrottlerGuard)
@Controller('clients')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Register a new client' })
  @ApiBody({
    description: 'Signup',
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        password: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        profileImage: {
          type: 'string',
          format: 'binary',
          description: 'Profile image',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Client registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  signup(
    @Body() createClientDto: CreateClientDto,
    @UploadedFile() profileImage: Express.Multer.File,
  ) {
    return this.clientService.signup(createClientDto, profileImage);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Client login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() loginClientDto: LoginClientDto) {
    return this.clientService.login(loginClientDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, ClientGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current client profile' })
  @ApiResponse({ status: 200, description: 'Client profile retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMe(@Request() req) {
    return this.clientService.findMe(req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiQuery({ name: 'status', type: String, required: false })
  @ApiOperation({ summary: 'Get all clients (Admin only)' })
  @ApiResponse({ status: 200, description: 'Clients retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  findAll(@Query('page') page: number = 1, @Query('limit') limit: number = 10, @Query('search') search: string = '', @Query('status') status: MembershipStatus | null = null) {
    return this.clientService.findAll(page, limit, search, status);
  }

  @Patch('active/:id')
  @ApiParam({ name: 'id', description: 'Client ID' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a client's membership status" })
  @ApiResponse({
    status: 200,
    description: 'Client membership status updated successfully',
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  updateClientMembershipAsActive(
    @Param('id') id: string,
    @Body()
    updateClientMembershipAsActiveDto: UpdateClientMembershipAsActiveDto,
  ) {
    return this.clientService.updateClientMembershipAsActive(
      id,
      updateClientMembershipAsActiveDto,
    );
  }

  @Patch('inactive/:id')
  @ApiParam({ name: 'id', description: 'Client ID' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a client's membership status" })
  @ApiResponse({
    status: 200,
    description: 'Client membership status updated successfully',
  })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  updateClientMembershipAsInactive(
    @Param('id') id: string
  ) {
    return this.clientService.updateClientMembershipAsInactive(
      id
    );
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Client ID' })
  @ApiOperation({ summary: 'Get client by ID' })
  @ApiResponse({ status: 200, description: 'Client retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.clientService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Client ID' })
  @ApiOperation({ summary: 'Update client profile' })
  @ApiResponse({ status: 200, description: 'Client updated successfully' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Update client profile',
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        profileImage: {
          type: 'string',
          format: 'binary',
          description: 'Profile image',
        },
      },
    },
  })
  update(
    @Param('id') id: string,
    @Body() updateClientDto: UpdateClientDto,
    @Request() req,
    @UploadedFile() profileImage: Express.Multer.File,
  ) {
    return this.clientService.update(
      id,
      updateClientDto,
      req.user.id,
      req.user.userType,
      profileImage,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Client ID' })
  @ApiOperation({ summary: 'Delete client (Admin only)' })
  @ApiResponse({ status: 200, description: 'Client deleted successfully' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  remove(@Param('id') id: string) {
    return this.clientService.remove(id);
  }

  @Get(':id/purchases')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Client ID' })
  @ApiOperation({ summary: 'Get client purchase history' })
  @ApiResponse({ status: 200, description: 'Purchase history retrieved' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  getClientPurchases(@Param('id') id: string, @Request() req) {
    return this.clientService.getClientPurchases(
      id,
      req.user.id,
      req.user.userType,
    );
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Send forgot password email' })
  @ApiResponse({ status: 200, description: 'Forgot password email sent' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  forgotPassword(@Body('email') email: string) {
    return this.clientService.forgotPassword(email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  resetPassword(@Body('token') token: string, @Body('password') password: string) {
    return this.clientService.resetPassword(token, password);
  }
}
