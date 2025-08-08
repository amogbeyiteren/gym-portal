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
  Query,
  HttpCode,
  HttpStatus,
  Headers,
  RawBody,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { StoreService } from './store.service';
import { CreateStoreItemDto, UpdateStoreItemDto } from './dto/store-item.dto';
import { CreatePurchaseDto, VerifyPurchaseDto } from './dto/purchase.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ClientGuard } from '../auth/guards/client.guard';
import { PaystackService } from '../paystack/paystack.service';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Store')
@Controller('store')
export class StoreController {
  constructor(
    private readonly storeService: StoreService,
    private readonly paystackService: PaystackService,
  ) {}

  // Store Item Management (Admin only)
  @Post('items')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new store item (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Create store item',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        image: { type: 'string', format: 'binary', description: 'Image' },
        quantity: { type: 'number' },
        isActive: { type: 'boolean' },
      },
    },
  })

  @ApiResponse({ status: 201, description: 'Store item created successfully' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  createStoreItem(@Body() createStoreItemDto: CreateStoreItemDto, @UploadedFile() image: Express.Multer.File) {
    return this.storeService.createStoreItem(createStoreItemDto, image);
  }

  @Get('items')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Get all store items' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Store items retrieved successfully' })
  findAllStoreItems(@Query('includeInactive') includeInactive: string) {
    const includeInactiveBool = includeInactive === 'true';
    return this.storeService.findAllStoreItems(includeInactiveBool);
  }

  @Get('items/:id')
  @UseGuards(ThrottlerGuard)
  @ApiParam({ name: 'id', description: 'Store item ID' })
  @ApiOperation({ summary: 'Get store item by ID' })
  @ApiResponse({ status: 200, description: 'Store item retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Store item not found' })
  findOneStoreItem(@Param('id') id: string) {
    return this.storeService.findOneStoreItem(id);
  }

  @Patch('items/:id')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('image'))
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Store item ID' })
  @ApiOperation({ summary: 'Update store item (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Update store item',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        image: { type: 'string', format: 'binary', description: 'Image' },
        quantity: { type: 'number' },
        isActive: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Store item updated successfully' })
  @ApiResponse({ status: 404, description: 'Store item not found' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  updateStoreItem(
    @Param('id') id: string,
    @Body() updateStoreItemDto: UpdateStoreItemDto,
    @UploadedFile() image: Express.Multer.File,
  ) {
    return this.storeService.updateStoreItem(id, updateStoreItemDto, image);
  }

  @Delete('items/:id')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Store item ID' })
  @ApiOperation({ summary: 'Delete store item (Admin only)' })
  @ApiResponse({ status: 200, description: 'Store item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Store item not found' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  removeStoreItem(@Param('id') id: string) {
    return this.storeService.removeStoreItem(id);
  }

  // Purchase Management
  @Post('purchase')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, ClientGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new purchase (Client only)' })
  @ApiResponse({ status: 201, description: 'Purchase created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Active membership required' })
  createPurchase(@Body() createPurchaseDto: CreatePurchaseDto, @Request() req) {
    return this.storeService.createPurchase(req.user.id, createPurchaseDto);
  }

  @Post('verify-purchase')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, ClientGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify purchase payment' })
  @ApiResponse({ status: 200, description: 'Purchase verified successfully' })
  @ApiResponse({ status: 400, description: 'Payment verification failed' })
  verifyPurchase(@Body() verifyPurchaseDto: VerifyPurchaseDto) {
    return this.storeService.verifyPurchase(verifyPurchaseDto);
  }

  @Get('purchases')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all purchases (Admin only)' })
  @ApiResponse({ status: 200, description: 'Purchases retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  findAllPurchases() {
    return this.storeService.findAllPurchases();
  }

  @Get('purchases/:id')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Purchase ID' })
  @ApiOperation({ summary: 'Get purchase by ID' })
  @ApiResponse({ status: 200, description: 'Purchase retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  findOnePurchase(@Param('id') id: string) {
    return this.storeService.findOnePurchase(id);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paystack webhook for store purchases' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleWebhook(
    @RawBody() body: Buffer,
    @Headers('x-paystack-signature') signature: string,
  ) {
    // Verify webhook signature
    const payload = body.toString();
    const isValidSignature = this.paystackService.verifyWebhookSignature(payload, signature);

    if (!isValidSignature) {
      return { message: 'Invalid signature' };
    }

    const webhookData = JSON.parse(payload);
    await this.storeService.handleWebhook(webhookData);

    return { message: 'Webhook processed successfully' };
  }
}