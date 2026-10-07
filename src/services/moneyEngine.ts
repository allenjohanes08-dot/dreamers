// src/services/moneyEngine.ts
import { db } from '../db/index.ts';
import { 
  payments, 
  moneyLedger, 
  registryRequests, 
  users, 
  sellerProfiles, 
  sellerSubscriptions, 
  orders, 
  paymentMethodsConfig 
} from '../db/schema.ts';
import { eq, and, sql, desc, or, ilike, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import { adminDb } from '../lib/firebase-admin.ts';

export interface PaymentIntentInput {
  userId: number;
  purpose: 'EVENT_INVITATION' | 'SELLER_VERIFICATION' | 'SELLER_SUBSCRIPTION' | 'ORDER_INITIAL' | 'ORDER_BALANCE' | 'ORDER_FULL' | 'OTHER';
  relatedEntityType?: 'EVENT' | 'ORDER' | 'SELLER_PROFILE' | 'SELLER_SUBSCRIPTION';
  relatedEntityId?: string;
  amountExpected: number; // Integer TZS
  paymentMethod: string; // NMB, M-PESA, AIRTEL_MONEY, TIGO_PESA, HALOPESA
  idempotencyKey?: string;
}

export interface PaymentProofInput {
  paymentId?: number;
  transactionId?: string;
  senderName: string;
  senderPhone?: string;
  referenceNumber: string;
  amountSubmitted: number; // Integer TZS
  paymentDate?: string;
  evidenceUrl?: string;
  notes?: string;
}

export interface AdminVerificationInput {
  paymentId: number;
  adminId: number;
  action: 'VERIFY' | 'REJECT' | 'REQUEST_INFO' | 'REFUND';
  rejectionReason?: string;
  adminNotes?: string;
}

export const PRIMARY_NMB_ACCOUNT = {
  bank: 'NMB Bank',
  accountNumber: '33510020641',
  accountName: 'ALLEN JOHAS',
};

// Generate unique reference string with prefix (e.g. DRM-PAY-20261006-8F72K9)
export function generateReferenceCode(prefix: 'DRM-PAY' | 'DRM-ORD' | 'DRM-EVT' | 'DRM-SUB' | 'DRM-LED'): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${dateStr}-${randomSuffix}`;
}

// Calculate logistics fee based on distance
export function calculateLogisticsFee(distanceKm: number, baseFee: number = 3000, ratePerKm: number = 1000, serviceFee: number = 0): {
  baseFee: number;
  distanceFee: number;
  serviceFee: number;
  totalLogisticsFee: number;
} {
  const safeDistance = Math.max(0, distanceKm || 0);
  const distanceFee = Math.round(safeDistance * ratePerKm);
  const total = baseFee + distanceFee + serviceFee;
  return {
    baseFee: Math.round(baseFee),
    distanceFee,
    serviceFee: Math.round(serviceFee),
    totalLogisticsFee: Math.round(total)
  };
}

// Centralized Money Engine Service
export class MoneyEngineService {

  // Create payment intent
  static async createPaymentIntent(input: PaymentIntentInput) {
    const amountExpected = Math.round(Math.max(0, input.amountExpected));
    
    // Check idempotency key if provided
    if (input.idempotencyKey) {
      const [existing] = await db.select().from(payments).where(eq(payments.idempotencyKey, input.idempotencyKey)).limit(1);
      if (existing) return existing;
    }

    const transactionId = generateReferenceCode('DRM-PAY');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry

    const [payment] = await db.insert(payments).values({
      transactionId,
      userId: input.userId,
      purpose: input.purpose,
      relatedEntityType: input.relatedEntityType || null,
      relatedEntityId: input.relatedEntityId ? String(input.relatedEntityId) : null,
      amountExpected,
      amountSubmitted: 0,
      amountVerified: 0,
      balanceDue: amountExpected,
      currency: 'TZS',
      paymentMethod: input.paymentMethod || 'NMB',
      status: 'PENDING',
      idempotencyKey: input.idempotencyKey || null,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any).returning();

    return payment;
  }

  // Submit payment details / evidence
  static async submitPaymentProof(userId: number, input: PaymentProofInput) {
    const { paymentId, transactionId, senderName, senderPhone, referenceNumber, amountSubmitted, evidenceUrl, notes } = input;
    
    let targetPayment;
    if (paymentId) {
      [targetPayment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    } else if (transactionId) {
      [targetPayment] = await db.select().from(payments).where(eq(payments.transactionId, transactionId)).limit(1);
    }

    if (!targetPayment) {
      throw new Error('Payment intent not found');
    }

    if (targetPayment.userId !== userId) {
      throw new Error('Unauthorized access to this payment record');
    }

    if (['VERIFIED', 'REFUNDED'].includes(targetPayment.status)) {
      throw new Error(`Payment is already ${targetPayment.status.toLowerCase()}`);
    }

    const cleanRef = (referenceNumber || '').trim().toUpperCase();
    const cleanAmount = Math.round(Math.max(0, amountSubmitted || targetPayment.amountExpected));

    // Duplicate detection: check if reference number was used in another verified payment
    let isDuplicate = false;
    if (cleanRef) {
      const [existingRef] = await db.select().from(payments)
        .where(and(
          eq(payments.referenceNumber, cleanRef),
          sql`${payments.id} != ${targetPayment.id}`,
          eq(payments.status, 'VERIFIED')
        )).limit(1);
      if (existingRef) {
        isDuplicate = true;
      }
    }

    const isUnderpayment = cleanAmount < targetPayment.amountExpected;
    const isOverpayment = cleanAmount > targetPayment.amountExpected;
    const underpaymentAmount = isUnderpayment ? (targetPayment.amountExpected - cleanAmount) : 0;
    const overpaymentAmount = isOverpayment ? (cleanAmount - targetPayment.amountExpected) : 0;

    const [updated] = await db.update(payments).set({
      senderName: senderName ? senderName.trim() : 'Payer',
      senderPhone: senderPhone ? senderPhone.trim() : null,
      referenceNumber: cleanRef,
      amountSubmitted: cleanAmount,
      paymentDate: new Date(),
      evidenceUrl: evidenceUrl || null,
      notes: notes || null,
      status: isDuplicate ? 'UNDER_REVIEW' : 'SUBMITTED',
      isDuplicate,
      isUnderpayment,
      isOverpayment,
      underpaymentAmount,
      overpaymentAmount,
      updatedAt: new Date(),
    } as any).where(eq(payments.id, targetPayment.id)).returning();

    return updated;
  }

  // Admin Verification & Workflow Triggering
  static async verifyOrRejectPayment(input: AdminVerificationInput) {
    const { paymentId, adminId, action, rejectionReason, adminNotes } = input;

    return await db.transaction(async (tx) => {
      const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
      if (!payment) {
        throw new Error('Payment record not found');
      }

      // IDEMPOTENCY SAFETY: Check if payment is already verified or rejected
      if (payment.status === 'VERIFIED') {
        return payment; // Already verified, bypass duplicate execution to prevent double guest quotas
      }
      if (payment.status === 'REJECTED' && action === 'REJECT') {
        return payment; // Already rejected
      }

      if (action === 'REJECT') {
        const [rejected] = await tx.update(payments).set({
          status: 'REJECTED',
          rejectionReason: rejectionReason || 'Payment proof could not be verified.',
          adminNotes: adminNotes || null,
          verifiedBy: adminId,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        } as any).where(eq(payments.id, paymentId)).returning();

        return rejected;
      }

      if (action === 'VERIFY') {
        const amountVerified = payment.amountSubmitted > 0 ? payment.amountSubmitted : payment.amountExpected;

        const [verifiedPayment] = await tx.update(payments).set({
          status: 'VERIFIED',
          amountVerified,
          balanceDue: Math.max(0, payment.amountExpected - amountVerified),
          verifiedBy: adminId,
          verifiedAt: new Date(),
          adminNotes: adminNotes || null,
          updatedAt: new Date(),
        } as any).where(eq(payments.id, paymentId)).returning();

        // Immutable Money Ledger Entry
        const ledgerCode = generateReferenceCode('DRM-LED');
        await tx.insert(moneyLedger).values({
          ledgerCode,
          paymentId: verifiedPayment.id,
          transactionId: verifiedPayment.transactionId,
          userId: verifiedPayment.userId,
          type: verifiedPayment.purpose,
          amount: amountVerified,
          currency: 'TZS',
          direction: 'CREDIT',
          source: 'CUSTOMER',
          destination: 'PLATFORM_NMB',
          status: 'COMPLETED',
          relatedEntityType: verifiedPayment.relatedEntityType || null,
          relatedEntityId: verifiedPayment.relatedEntityId || null,
          createdBy: verifiedPayment.userId,
          verifiedBy: adminId,
          createdAt: new Date(),
        } as any);

        // Execute Domain Actions based on Payment Purpose
        if (verifiedPayment.purpose === 'EVENT_INVITATION' && verifiedPayment.relatedEntityId) {
          const eventId = Number(verifiedPayment.relatedEntityId);
          const [event] = await tx.select().from(registryRequests).where(eq(registryRequests.id, eventId)).limit(1);
          if (event) {
            // Calculate additional guests purchased
            const guestsPurchased = Math.floor(amountVerified / (event.invitationFeePerGuest || 500));
            const newQuotaPurchased = (event.guestQuotaPurchased || 0) + guestsPurchased;
            const newQuotaRemaining = (event.guestQuotaRemaining || 0) + guestsPurchased;
            const newTotalPaid = (event.totalPaidInvitationAmount || 0) + amountVerified;

            // Automatically set status to APPROVED (fully verified / unlocked)
            await tx.update(registryRequests).set({
              guestQuotaPurchased: newQuotaPurchased,
              guestQuotaRemaining: newQuotaRemaining,
              totalPaidInvitationAmount: newTotalPaid,
              status: 'APPROVED',
              updatedAt: new Date(),
            } as any).where(eq(registryRequests.id, eventId));

            // Synchronize status changes directly to Firestore for real-time visual client unlock
            try {
              await adminDb.collection('registryRequests').doc(String(eventId)).set({
                status: 'APPROVED',
                guestQuotaPurchased: newQuotaPurchased,
                guestQuotaRemaining: newQuotaRemaining,
                totalPaidInvitationAmount: newTotalPaid,
                updatedAt: new Date().toISOString()
              }, { merge: true });
            } catch (fsErr) {
              console.error('Firestore sync error in payment verification domain action:', fsErr);
            }
          }
        } else if (verifiedPayment.purpose === 'SELLER_VERIFICATION') {
          // Verify Seller Profile
          const [sellerProf] = await tx.select().from(sellerProfiles).where(eq(sellerProfiles.userId, verifiedPayment.userId)).limit(1);
          if (sellerProf) {
            await tx.update(sellerProfiles).set({
              verificationFeePaid: true,
              verificationFeePaymentId: verifiedPayment.transactionId,
              lipaVerificationStatus: 'VERIFIED',
            } as any).where(eq(sellerProfiles.id, sellerProf.id));
          }

          // Activate Seller Role on User
          await tx.update(users).set({
            role: 'SELLER',
            verificationStatus: 'VERIFIED',
            updatedAt: new Date(),
          } as any).where(eq(users.id, verifiedPayment.userId));

        } else if (verifiedPayment.purpose === 'SELLER_SUBSCRIPTION') {
          const [sellerProf] = await tx.select().from(sellerProfiles).where(eq(sellerProfiles.userId, verifiedPayment.userId)).limit(1);
          if (sellerProf) {
            const startDate = new Date();
            const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
            const subCode = generateReferenceCode('DRM-SUB');
            const periodMonth = startDate.toISOString().slice(0, 7);

            await tx.insert(sellerSubscriptions).values({
              sellerId: sellerProf.id,
              subscriptionCode: subCode,
              amount: amountVerified,
              periodMonth,
              startDate,
              endDate,
              status: 'PAID',
              paymentId: verifiedPayment.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as any);

            await tx.update(sellerProfiles).set({
              subscriptionStatus: 'ACTIVE',
              subscriptionExpiresAt: endDate,
            } as any).where(eq(sellerProfiles.id, sellerProf.id));
          }
        } else if (['ORDER_INITIAL', 'ORDER_FULL', 'ORDER_BALANCE'].includes(verifiedPayment.purpose) && verifiedPayment.relatedEntityId) {
          const orderId = Number(verifiedPayment.relatedEntityId);
          const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
          if (order) {
            const newPaidAmount = (order.paidAmount || 0) + amountVerified;
            const newRemaining = Math.max(0, Number(order.totalAmount) - newPaidAmount);
            const financialStatus = newRemaining <= 0 ? 'FULLY_PAID' : 'PARTIALLY_PAID';

            await tx.update(orders).set({
              paidAmount: newPaidAmount,
              remainingAmount: newRemaining,
              financialStatus,
              status: 'PAID',
              updatedAt: new Date(),
            } as any).where(eq(orders.id, orderId));

            // Customer Welcome Bonus Check
            const [customer] = await tx.select().from(users).where(eq(users.id, order.customerId)).limit(1);
            if (customer && !customer.welcomeBonusUsed) {
              const welcomeBonusAmount = 500; // TZS 500
              await tx.update(users).set({
                welcomeBonusUsed: true,
                welcomeBonusAmount,
                updatedAt: new Date(),
              } as any).where(eq(users.id, customer.id));

              await tx.update(orders).set({
                welcomeBonusApplied: true,
              } as any).where(eq(orders.id, orderId));

              // Record welcome bonus in ledger
              const bonusLedgerCode = generateReferenceCode('DRM-LED');
              await tx.insert(moneyLedger).values({
                ledgerCode: bonusLedgerCode,
                paymentId: verifiedPayment.id,
                transactionId: verifiedPayment.transactionId,
                userId: customer.id,
                type: 'WELCOME_BONUS',
                amount: welcomeBonusAmount,
                currency: 'TZS',
                direction: 'DEBIT',
                source: 'PLATFORM',
                destination: 'CUSTOMER_WALLET',
                status: 'COMPLETED',
                relatedEntityType: 'ORDER',
                relatedEntityId: String(order.id),
                createdBy: adminId,
                verifiedBy: adminId,
                createdAt: new Date(),
              } as any);
            }
          }
        }

        return verifiedPayment;
      }

      throw new Error(`Invalid action: ${action}`);
    });
  }
}
