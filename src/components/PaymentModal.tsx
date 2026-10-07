// src/components/PaymentModal.tsx
import React, { useState, useEffect } from 'react';
import { 
  X, 
  CreditCard, 
  Building2, 
  Copy, 
  Check, 
  PhoneCall, 
  ShieldCheck, 
  ArrowRight, 
  Upload, 
  AlertCircle,
  Clock,
  Sparkles,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { fetchWithRetry } from '../lib/api';
import { auth } from '../lib/firebase';
import { useNotifications } from '../context/NotificationContext';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  purpose: 'EVENT_INVITATION' | 'SELLER_VERIFICATION' | 'SELLER_SUBSCRIPTION' | 'ORDER_INITIAL' | 'ORDER_BALANCE' | 'ORDER_FULL' | 'OTHER';
  relatedEntityType?: 'EVENT' | 'ORDER' | 'SELLER_PROFILE' | 'SELLER_SUBSCRIPTION';
  relatedEntityId?: string;
  amountExpected: number; // Integer TZS
  title: string;
  subtitle?: string;
  onPaymentSuccess?: (payment: any) => void;
}

interface PaymentChannel {
  code: string;
  name: string;
  type: string;
  accountNumber: string;
  accountName: string;
  ussdCode?: string;
  instructionsEn: string;
  instructionsSw: string;
}

const PRIMARY_NMB = {
  bank: 'NMB Bank',
  accountNumber: '33510020641',
  accountName: 'ALLEN JOHAS',
};

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  purpose,
  relatedEntityType,
  relatedEntityId,
  amountExpected,
  title,
  subtitle,
  onPaymentSuccess
}) => {
  const { showToast } = useNotifications();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Choose Channel & Instructions, 2: Submit Details, 3: Confirmation / Pending
  const [copied, setCopied] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>('NMB');
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<any>(null);

  // Form inputs
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [amountSubmitted, setAmountSubmitted] = useState<number>(amountExpected);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmountSubmitted(amountExpected);
      fetchPaymentMethodsAndIntent();
    }
  }, [isOpen, amountExpected]);

  const fetchPaymentMethodsAndIntent = async () => {
    try {
      setLoadingIntent(true);
      const token = await auth.currentUser?.getIdToken();

      // 1. Fetch channels
      const resMethods = await fetchWithRetry('/api/payments/methods');
      if (resMethods.ok) {
        const data = await resMethods.json();
        setChannels(data.methods || []);
      }

      // 2. Create Intent
      const resIntent = await fetchWithRetry('/api/payments/intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          purpose,
          relatedEntityType,
          relatedEntityId,
          amountExpected,
          paymentMethod: selectedChannel
        })
      });

      if (resIntent.ok) {
        const intentData = await resIntent.json();
        setPaymentIntent(intentData.payment);
      }
    } catch (err) {
      console.error('Failed to initialize payment intent:', err);
    } finally {
      setLoadingIntent(false);
    }
  };

  if (!isOpen) return null;

  const handleCopyAccount = () => {
    navigator.clipboard.writeText(PRIMARY_NMB.accountNumber);
    setCopied(true);
    showToast('Copied', `Account Number ${PRIMARY_NMB.accountNumber} copied!`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChannelSelect = (code: string) => {
    setSelectedChannel(code);
  };

  const currentChannelObj = channels.find(c => c.code === selectedChannel) || {
    code: 'NMB',
    name: 'NMB Bank (Manual Transfer)',
    type: 'BANK',
    accountNumber: PRIMARY_NMB.accountNumber,
    accountName: PRIMARY_NMB.accountName,
    ussdCode: '*150*66#',
    instructionsEn: `Pay directly to NMB Bank Account Number ${PRIMARY_NMB.accountNumber} (Name: ${PRIMARY_NMB.accountName}). Submit sender name and receipt reference code after transfer.`,
    instructionsSw: `Lipa moja kwa moja kwenda NMB Bank Akaunti Namba ${PRIMARY_NMB.accountNumber} (Jina: ${PRIMARY_NMB.accountName}). Wasilisha jina na kumbukumbu baada ya muamala.`
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim()) {
      showToast('Validation Error', 'Please enter sender full name.', 'error');
      return;
    }
    if (!referenceNumber.trim()) {
      showToast('Validation Error', 'Please enter your bank slip or transaction reference code.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const token = await auth.currentUser?.getIdToken();

      const res = await fetchWithRetry('/api/payments/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          paymentId: paymentIntent?.id,
          transactionId: paymentIntent?.transactionId,
          senderName: senderName.trim(),
          senderPhone: senderPhone.trim(),
          referenceNumber: referenceNumber.trim().toUpperCase(),
          amountSubmitted: Number(amountSubmitted),
          evidenceUrl: evidenceUrl.trim(),
          notes: notes.trim()
        })
      });

      if (res.ok) {
        const data = await res.json();
        setPaymentIntent(data.payment);
        setStep(3);
        showToast('Payment Submitted', '🎉 Your payment proof has been submitted for verification!', 'success');
        if (onPaymentSuccess) onPaymentSuccess(data.payment);
      } else {
        const errData = await res.json();
        showToast('Submission Failed', errData.error || 'Failed to submit payment details.', 'error');
      }
    } catch (err: any) {
      console.error('Payment submission error:', err);
      showToast('Error', err.message || 'An error occurred submitting payment details.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[350] flex items-start sm:items-center justify-center p-3 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800/80 rounded-3xl shadow-2xl text-slate-100 overflow-hidden my-auto max-h-[90dvh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-slate-800/60 bg-slate-950/50 shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <CreditCard className="w-5 h-5" />
              </span>
              <h2 className="text-lg md:text-xl font-bold tracking-tight text-white">{title}</h2>
            </div>
            {subtitle && <p className="text-xs md:text-sm text-slate-400 mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 md:p-6 space-y-6 overflow-y-auto flex-grow min-h-0">

          {/* Amount Bar */}
          <div className="bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-slate-900 border border-blue-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-blue-400">Total Amount Required</span>
              <div className="text-2xl md:text-3xl font-black text-white tracking-tight mt-0.5">
                {amountExpected.toLocaleString()} <span className="text-sm font-semibold text-blue-300">TZS</span>
              </div>
            </div>
            {paymentIntent?.transactionId && (
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Reference Ref ID</span>
                <div className="text-xs font-mono font-bold text-amber-300 bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-500/20 mt-1">
                  {paymentIntent.transactionId}
                </div>
              </div>
            )}
          </div>

          {step === 1 && (
            <div className="space-y-6">
              
              {/* PRIMARY NMB BANK ACCOUNT HIGHLIGHT CARD */}
              <div className="bg-slate-950 border-2 border-emerald-500/30 rounded-2xl p-4 md:p-5 relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-300 text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-bl-xl border-l border-b border-emerald-500/30">
                  Official Destination Account
                </div>

                <div className="flex items-center space-x-3 mb-3">
                  <Building2 className="w-6 h-6 text-emerald-400" />
                  <div>
                    <h3 className="text-base font-bold text-emerald-300">{PRIMARY_NMB.bank}</h3>
                    <p className="text-xs text-slate-400">Direct Manual Bank & Lipa Payment</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-[11px] uppercase font-bold text-slate-400">Account Name</span>
                    <p className="text-sm font-bold text-white mt-0.5">{PRIMARY_NMB.accountName}</p>
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-bold text-slate-400">Account Number</span>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-base font-mono font-black text-amber-300">{PRIMARY_NMB.accountNumber}</span>
                      <button
                        type="button"
                        onClick={handleCopyAccount}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center space-x-1 text-xs"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Channel Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Select Payment Channel
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {channels.map((ch) => (
                    <button
                      key={ch.code}
                      type="button"
                      onClick={() => handleChannelSelect(ch.code)}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                        selectedChannel === ch.code
                          ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-xs font-bold block">{ch.name}</span>
                      <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{ch.type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Instructions & USSD button */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex items-center space-x-2 text-blue-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Payment Instructions</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentChannelObj.instructionsEn}
                </p>

                {currentChannelObj.ussdCode && (
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-900">
                    <span className="text-xs text-slate-400">Quick USSD Launch Code:</span>
                    <a
                      href={`tel:${encodeURIComponent(currentChannelObj.ussdCode)}`}
                      className="inline-flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Dial {currentChannelObj.ussdCode}</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20"
                >
                  <span>I Have Transferred / Submit Details</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-blue-300">
                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  Please enter the exact full name of the sender and your bank transfer / M-Pesa receipt reference code. Payment will be verified by an administrator.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Sender Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="e.g. John Michael Joseph"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Sender Phone Number
                  </label>
                  <input
                    type="text"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="e.g. +255 754 000 000"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Transaction / Receipt Reference Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. MP2610068F72 or NMB-335100"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-amber-300 placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Amount Paid (TZS) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={amountSubmitted}
                    onChange={(e) => setAmountSubmitted(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Optional Screenshot URL / Receipt Note
                </label>
                <input
                  type="text"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="https://... image link or extra transfer notes"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 text-xs text-slate-400 hover:text-white transition"
                >
                  Back
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center space-x-2 shadow-lg shadow-emerald-600/20"
                >
                  {submitting ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{submitting ? 'Submitting...' : 'Confirm & Submit Proof'}</span>
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">Payment Details Submitted!</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Your payment reference <span className="font-mono text-amber-300 font-bold">{paymentIntent?.referenceNumber || paymentIntent?.transactionId}</span> has been received and is now <span className="text-amber-400 font-bold uppercase">SUBMITTED FOR VERIFICATION</span>.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left text-xs space-y-2 max-w-md mx-auto">
                <div className="flex justify-between">
                  <span className="text-slate-400">Transaction Ref:</span>
                  <span className="font-mono text-white font-bold">{paymentIntent?.transactionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="text-amber-400 font-bold uppercase">{paymentIntent?.status || 'SUBMITTED'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Submitted Amount:</span>
                  <span className="text-emerald-400 font-bold">{paymentIntent?.amountSubmitted?.toLocaleString()} TZS</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition"
              >
                Close & Done
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
