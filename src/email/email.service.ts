import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendPurchaseConfirmationToClient(purchase: any) {
    const client = purchase.client;
    const totalAmount = parseFloat(purchase.totalAmount.toString());
    
    // Create items list
    const itemsList = purchase.purchaseItems
      .map(item => 
        `• ${item.storeItem.name} x ${item.quantity} - ₦${parseFloat(item.totalPrice.toString()).toLocaleString()}`
      )
      .join('\n');

    const emailContent = `
      Dear ${client.firstName} ${client.lastName},

      Thank you for your purchase! Your order has been confirmed and payment has been successfully processed.

      Order Details:
      --------------
      Order ID: ${purchase.id}
      Purchase Date: ${new Date(purchase.createdAt).toLocaleDateString()}
      
      Items Ordered:
      ${itemsList}
      
      Total Amount: ₦${totalAmount.toLocaleString()}
      Delivery Option: ${purchase.deliveryOption}
      ${purchase.deliveryAddress ? `Delivery Address: ${purchase.deliveryAddress}` : ''}
      
      Payment Reference: ${purchase.paymentReference}

      ${purchase.deliveryOption === 'PICKUP' 
        ? 'Please visit our gym to pick up your items. Bring a valid ID for verification.' 
        : 'Your items will be delivered to the provided address within 2-3 business days.'
      }

      Thank you for choosing our gym!

      Best regards,
      Gym Portal Team
    `;

    try {
      const data = await this.resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: client.email,
        subject: `Purchase Confirmation - Order #${purchase.id}`,
        text: emailContent,
      });
      console.log('Client email sent:', data.data.id);
      return data;
    } catch (error) {
      console.error('Error sending email to client:', error);
      throw error;
    }
  }

  async sendPurchaseNotificationToAdmin(purchase: any) {
    const client = purchase.client;
    const totalAmount = parseFloat(purchase.totalAmount.toString());
    
    // Create items list
    const itemsList = purchase.purchaseItems
      .map(item => 
        `• ${item.storeItem.name} x ${item.quantity} - ₦${parseFloat(item.totalPrice.toString()).toLocaleString()}`
      )
      .join('\n');

    const emailContent = `
      New Purchase Alert!

      A new purchase has been made and payment has been confirmed.

      Customer Details:
      ----------------
      Name: ${client.firstName} ${client.lastName}
      Email: ${client.email}
      Customer ID: ${client.id}

      Order Details:
      --------------
      Order ID: ${purchase.id}
      Purchase Date: ${new Date(purchase.createdAt).toLocaleDateString()}
      
      Items Ordered:
      ${itemsList}
      
      Total Amount: ₦${totalAmount.toLocaleString()}
      Delivery Option: ${purchase.deliveryOption}
      ${purchase.deliveryAddress ? `Delivery Address: ${purchase.deliveryAddress}` : ''}
      
      Payment Reference: ${purchase.paymentReference}

      Action Required:
      ${purchase.deliveryOption === 'PICKUP' 
        ? 'Prepare items for customer pickup at the gym.' 
        : 'Arrange delivery to the customer address.'
      }

      Login to the admin panel for more details.
    `;

    try {
      const data = await this.resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: `New Purchase - Order #${purchase.id}`,
        text: emailContent,
      });
      console.log('Admin email sent:', data.data.id);
      return data;
    } catch (error) {
      console.error('Error sending email to admin:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(client: any) {
    const emailContent = `
      Welcome to Gym Portal!

      Dear ${client.firstName} ${client.lastName},

      Thank you for joining our gym! Your account has been successfully created.

      Account Details:
      ---------------
      Email: ${client.email}
      Member ID: ${client.id}
      Registration Date: ${new Date(client.createdAt).toLocaleDateString()}

      Next Steps:
      -----------
      1. Complete your membership payment to access all gym facilities
      2. Visit our store to browse available products
      3. Use your QR code for easy check-ins at the gym

      Your QR code has been generated and is available in your profile.

      We're excited to have you as part of our fitness community!

      Best regards,
      Gym Portal Team
    `;

    try {
      const data = await this.resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: client.email,
        subject: 'Welcome to Gym Portal!',
        text: emailContent,
      });
      console.log('Welcome email sent:', data.data.id);
      return data;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      // Don't throw error for welcome email as it's not critical
      return null;
    }
  }

  async sendMembershipConfirmation(client: any, membershipDetails: any) {
    const emailContent = `
      Membership Payment Confirmed!

      Dear ${client.firstName} ${client.lastName},

      Your membership payment has been successfully processed and confirmed.

      Membership Details:
      ------------------
      Status: ${membershipDetails.status}
      Payment Date: ${new Date(membershipDetails.paidDate).toLocaleDateString()}
      Expiry Date: ${new Date(membershipDetails.dueDate).toLocaleDateString()}
      Payment Reference: ${membershipDetails.reference}

      You now have full access to all gym facilities and services!

      Welcome to our fitness community. We look forward to helping you achieve your fitness goals.

      Best regards,
      Gym Portal Team
    `;

    try {
      const data = await this.resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: client.email,
        subject: 'Membership Payment Confirmed',
        text: emailContent,
      });
      console.log('Membership confirmation email sent:', data.data.id);
      return data;
    } catch (error) {
      console.error('Error sending membership confirmation email:', error);
      throw error;
    }
  }

  async sendForgotPasswordEmail(email: string, token: string) {
    const emailContent = `
      Password Reset Request

      Dear ${email},

      You requested a password reset. Please click the link below to reset your password:

      ${process.env.FRONTEND_URL}/auth/reset-password/${token}

      If you did not request a password reset, please ignore this email.
    `;

    try {
      const data = await this.resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: 'Password Reset Request',
        text: emailContent,
      });

      console.log('Forgot password email sent');
      return data;
    } catch (error) {
      console.error('Error sending forgot password email:', error);
      throw error;
    }
  }
}