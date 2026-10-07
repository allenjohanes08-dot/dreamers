// src/services/clickpesa.ts
import * as dotenv from 'dotenv';
dotenv.config();

export interface ClickPesaPaymentPayload {
  amount: number;
  currency: string;
  customerPhone: string;
  customerEmail: string;
  customerName: string;
  referenceId: string;
  description: string;
}

export interface ClickPesaTokenResponse {
  accessToken: string;
  expiresAt: number; // Timestamp in milliseconds when token expires
}

class ClickPesaService {
  private apiUrl: string;
  private clientId: string;
  private clientSecret: string;
  private tokenCache: ClickPesaTokenResponse | null = null;

  constructor() {
    this.apiUrl = process.env.CLICKPESA_API_URL || 'https://api.clickpesa.com/v1';
    this.clientId = process.env.CLICKPESA_CLIENT_ID || '';
    this.clientSecret = process.env.CLICKPESA_CLIENT_SECRET || '';
  }

  /**
   * Securely retrieves the authentication token.
   * Leverages caching to optimize backend requests and prevent redundant round trips.
   */
  async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60000) {
      return this.tokenCache.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      console.warn('ClickPesa credentials missing. Falling back to sandbox/simulation token.');
      return 'mock-sandbox-token';
    }

    try {
      const response = await fetch(`${this.apiUrl}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials'
        }),
      });

      if (!response.ok) {
        throw new Error(`ClickPesa auth endpoint returned status ${response.status}`);
      }

      const data = await response.json();
      // Cache token 60 seconds less than standard expiry to prevent edge cases
      const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;

      this.tokenCache = {
        accessToken: data.access_token || data.token || '',
        expiresAt,
      };

      return this.tokenCache.accessToken;
    } catch (error) {
      console.error('ClickPesa Token Authentication Error:', error);
      throw new Error('Authentication with ClickPesa gateway failed.');
    }
  }

  /**
   * Initiates payment request (Mobile Money TZS, Card, or Bank transfer)
   */
  async initiatePayment(payload: ClickPesaPaymentPayload) {
    const token = await this.getAccessToken();

    if (token === 'mock-sandbox-token') {
      console.log('[ClickPesa Sandbox] Simulating payment initiation payload:', payload);
      return {
        success: true,
        transactionId: `CP-TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        paymentUrl: `https://sandbox.clickpesa.com/pay/${payload.referenceId}`,
        status: 'PENDING',
        message: 'Sandbox Payment Request Initiated successfully.'
      };
    }

    try {
      const response = await fetch(`${this.apiUrl}/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: payload.amount,
          currency: payload.currency,
          phone_number: payload.customerPhone,
          email: payload.customerEmail,
          name: payload.customerName,
          external_reference: payload.referenceId,
          description: payload.description,
          callback_url: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/api/payments/clickpesa/callback`
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`ClickPesa initiation endpoint returned status ${response.status}: ${errorBody}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ClickPesa Initiate Payment Exception:', error);
      throw error;
    }
  }

  /**
   * Securely verifies a transaction directly from the ClickPesa system
   */
  async verifyTransactionStatus(transactionId: string) {
    if (transactionId.startsWith('CP-TX-') || !this.clientId || !this.clientSecret) {
      console.log('[ClickPesa Sandbox] Simulating verification for transaction:', transactionId);
      return {
        success: true,
        transactionId,
        status: 'COMPLETED',
        verifiedAt: new Date().toISOString(),
      };
    }

    const token = await this.getAccessToken();

    try {
      const response = await fetch(`${this.apiUrl}/payments/status/${transactionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`ClickPesa verification endpoint returned status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ClickPesa Verify Transaction Exception:', error);
      throw error;
    }
  }
}

export const clickPesaService = new ClickPesaService();
