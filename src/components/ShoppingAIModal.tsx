// src/components/ShoppingAIModal.tsx
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  ShoppingBag,
  ShieldCheck,
  Truck,
  RotateCcw,
  Store,
  ChevronRight,
  Maximize2,
  Minimize2,
  Square,
  RefreshCw,
  Clock,
  CheckCircle2,
  Zap,
  Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useShoppingAI } from '../context/ShoppingAIContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { auth } from '../lib/firebase.ts';
import { fetchWithRetry } from '../lib/api.ts';
import { staggerContainer, fadeInUp, listItem, buttonHover } from '../lib/animations';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
  isError?: boolean;
  latencyMs?: number;
  metadata?: {
    products?: any[];
    shop?: any;
    order?: any;
    categories?: any[];
  };
}

export default function ShoppingAIModal() {
  const { language } = useAuth();
  const { isOpen, setIsOpen, initialQuery, activeProductContext } = useShoppingAI();
  const { cart, addToCart, removeFromCart, clearCart } = useCart();
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusState, setStatusText] = useState<'Online' | 'Thinking' | 'Streaming' | 'Error' | 'Stopped'>('Online');
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'sw' ? 'sw-TZ' : 'en-US';
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'initial',
      sender: 'ai',
      text:
        language === 'sw'
          ? 'Habari! Mimi ni Shopping AI wa DREAMERS 🛍️✨\nKARIBU TUONGEE BIASHARA!\n\nJe, unatafuta bidhaa gani leo au unahitaji msaada gani kuhusu oda, maduka, au malipo salama ya Escrow?'
          : 'Hello! I am Shopping AI for DREAMERS 🛍️✨\nKARIBU TUONGEE BIASHARA!\n\nHow can I help you find top Tanzanian products, track your orders, or understand Escrow buyer protection today?',
      timestamp: new Date(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen && initialQuery) {
      handleSendMessageStream(initialQuery);
    }
  }, [isOpen, initialQuery]);

  const starterPrompts = [
    {
      label: language === 'sw' ? '🌾 Mazao & Kilimo' : '🌾 Agriculture & Produce',
      prompt: language === 'sw' ? 'Nionyeshe bidhaa bora za kilimo na mazao ya chakula sokoni' : 'Show me top agricultural produce in Tanzania',
    },
    {
      label: language === 'sw' ? '👗 Mavazi & Vitenge' : '👗 Fashion & Textiles',
      prompt: language === 'sw' ? 'Kuna maduka gani ya vitenge na mavazi ya kitanzania?' : 'Where can I find authentic Tanzanian Vitenge and fabrics?',
    },
    {
      label: language === 'sw' ? '🛡️ Escrow Inafanyaje Kazi?' : '🛡️ How Escrow Works',
      prompt: language === 'sw' ? 'Eleza jinsi mfumo wa Escrow unavyolinda pesa zangu mpaka mzigo ufike' : 'How does Escrow payment protect my money until delivery?',
    },
    {
      label: language === 'sw' ? '📂 Sekta za Biashara' : '📂 Business Sectors',
      prompt: language === 'sw' ? 'Nionyeshe sekta zote za biashara zilizopo' : 'Show me all available business sectors',
    },
    {
      label: language === 'sw' ? '🔥 Bidhaa Zinazovuma' : '🔥 Trending Products',
      prompt: language === 'sw' ? 'Nionyeshe bidhaa zinazovuma sasa hivi sokoni' : 'What are the trending products right now?',
    },
    {
      label: language === 'sw' ? '🚚 Oda Yangu Ipo Wapi?' : '🚚 Where is my order?',
      prompt: language === 'sw' ? 'Oda yangu ya hivi karibuni ipo katika hali gani?' : 'What is the status of my latest order?',
    },
  ];

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setStatusText('Stopped');
  };

  const handleSendMessageStream = async (textToSend?: string) => {
    const messageText = (textToSend || inputMessage).trim();
    if (!messageText || loading) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMsg: Message = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'user',
      text: messageText,
      timestamp: new Date(),
    };

    const aiMsgId = Math.random().toString(36).substring(2, 9);
    const placeholderAiMsg: Message = {
      id: aiMsgId,
      sender: 'ai',
      text: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, placeholderAiMsg]);
    if (!textToSend) setInputMessage('');
    setLoading(true);
    setStatusText('Thinking');

    const requestStart = Date.now();
    const historyPayload = messages
      .filter((m) => m.id !== 'initial' && m.text && !m.isStreaming && !m.isError)
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

    try {
      const token = await auth.currentUser?.getIdToken();

      const res = await fetch('/api/ai/chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: messageText,
          history: historyPayload,
          context: {
            page: window.location.pathname,
            product: activeProductContext,
            cart: cart.map((c) => ({ id: c.productId, name: c.name, price: c.price, qty: c.quantity })),
          },
          language,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Streaming connection failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumText = '';
      let firstChunkTime: number | null = null;
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6).trim();
            if (jsonStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.status === 'streaming') {
                setStatusText('Streaming');
              } else if (parsed.status === 'processing') {
                setStatusText('Thinking');
              } else if (parsed.action === 'cart_update') {
                try {
                  if (parsed.data.action === 'add' && parsed.data.product) {
                    addToCart(parsed.data.product, parsed.data.quantity || 1);
                  } else if (parsed.data.action === 'remove' && (parsed.data.productId || parsed.data.id)) {
                    removeFromCart(parsed.data.productId || parsed.data.id);
                  } else if (parsed.data.action === 'clear') {
                    clearCart();
                  }
                } catch (e) {
                  console.error('AI Cart Action Failed:', e);
                }
              } else if (parsed.metadata) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId ? { ...m, metadata: { ...m.metadata, ...parsed.metadata } } : m
                  )
                );
              } else if (parsed.text) {
                if (firstChunkTime === null) {
                  firstChunkTime = Date.now() - requestStart;
                  setLastLatency(firstChunkTime);
                }
                accumText += parsed.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId ? { ...m, text: accumText, isStreaming: true, latencyMs: firstChunkTime || undefined } : m
                  )
                );
              }
            } catch (e) {}
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, text: accumText || (language === 'sw' ? 'Shopping AI ipo tayari.' : 'Shopping AI is ready.'), isStreaming: false } : m))
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStatusText('Stopped');
      } else {
        console.warn('SSE stream disconnected, attempting fallback endpoint...', err);
        // Fallback to standard POST chat endpoint
        try {
          const fallbackRes = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: messageText,
              history: historyPayload,
              context: {
                page: window.location.pathname,
                product: activeProductContext,
                cart: cart.map((c) => ({ id: c.productId, name: c.name, price: c.price, qty: c.quantity })),
              },
              language,
            }),
          });
          const fallbackData = await fallbackRes.json();
          const replyText = fallbackData.reply || fallbackData.text || (language === 'sw' ? 'Habari! Shopping AI ipo tayari kukusaidia.' : 'Hello! Shopping AI is ready to help.');
          
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, text: replyText, isStreaming: false, isError: false } : m
            )
          );
          setStatusText('Online');
          return;
        } catch (fallbackErr) {
          console.error('Fallback Chat Error:', fallbackErr);
        }

        setStatusText('Error');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  text:
                    language === 'sw'
                      ? 'Samahani, tumepata changamoto ya mtandao. Bofya "Jaribu Tena" kutuma upya.'
                      : 'Sorry, I am having trouble connecting right now. Please try again.',
                  isError: true,
                  isStreaming: false,
                }
              : m
          )
        );
      }
    } finally {
      setLoading(false);
      setStatusText('Online');
      abortControllerRef.current = null;
    }
  };

  const handleResetChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
    setStatusText('Online');
    setMessages([
      {
        id: 'initial',
        sender: 'ai',
        text:
          language === 'sw'
            ? 'Habari tena! Mimi ni Shopping AI wa DREAMERS 🛍️✨\nKARIBU TUONGEE BIASHARA!\n\nUna swali gani lingine?'
            : 'Hello again! I am Shopping AI for DREAMERS 🛍️✨\nKARIBU TUONGEE BIASHARA!\n\nWhat else would you like to explore?',
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <>
      {/* Shopping AI Chat Interface Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-end sm:justify-center p-0 sm:p-6 pointer-events-none">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs pointer-events-auto"
            />

            {/* Chat Window */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`bg-light-green rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl border border-light-green-border w-full relative z-10 flex flex-col overflow-hidden pointer-events-auto transition-all ${
                isExpanded ? 'max-w-4xl h-[92vh]' : 'max-w-lg h-[88vh] sm:h-[680px]'
              }`}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-light-green p-4 sm:p-5 flex items-center justify-between relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center space-x-3 relative z-10">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 ring-2 ring-white/20 shrink-0">
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-light-green" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-black uppercase tracking-tight text-light-green">
                        Shopping AI
                      </h3>
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full tracking-wider flex items-center space-x-1 ${
                        statusState === 'Online'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                          : statusState === 'Streaming' || statusState === 'Thinking'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 animate-pulse'
                          : 'bg-red-500/20 text-red-300 border border-red-400/40'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{statusState}</span>
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <p className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">
                        KARIBU TUONGEE BIASHARA 🇹🇿
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1 relative z-10">
                  <button
                    onClick={handleResetChat}
                    title="Clear Conversation"
                    className="p-2 text-slate-400 hover:text-light-green rounded-xl hover:bg-light-green/10 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                    className="p-2 text-slate-400 hover:text-light-green rounded-xl hover:bg-light-green/10 transition-colors hidden sm:block"
                  >
                    {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    title="Close"
                    className="p-2 text-slate-400 hover:text-light-green rounded-xl hover:bg-light-green/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Active Context Banner */}
              {activeProductContext && (
                <div className="bg-blue-900 text-white px-4 py-2 border-b border-blue-700/50 flex items-center justify-between text-xs font-bold shrink-0">
                  <div className="flex items-center space-x-2 truncate">
                    <ShoppingBag className="w-4 h-4 text-amber-300 shrink-0" />
                    <span className="truncate">Context: {activeProductContext.name || 'Product View'} ({Number(activeProductContext.price).toLocaleString()} TZS)</span>
                  </div>
                  <button
                    onClick={() => handleSendMessageStream(`Nieleze zaidi kuhusu ${activeProductContext.name}`)}
                    className="text-[10px] font-black uppercase text-amber-300 hover:underline shrink-0 ml-2"
                  >
                    Ask AI
                  </button>
                </div>
              )}

              {/* Chat Thread Messages */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-grow space-y-4 bg-emerald-50/30 min-h-0">
                <motion.div 
                  initial="initial"
                  animate="animate"
                  variants={staggerContainer(0.08)}
                  className="space-y-4"
                >
                  <AnimatePresence mode="popLayout">
                    {messages.map((m) => {
                      const isUser = m.sender === 'user';
                      return (
                          <motion.div
                            layout
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            key={m.id}
                            className={`flex items-start space-x-2.5 group ${isUser ? 'justify-end' : 'justify-start'}`}
                          >
                          {!isUser && (
                            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-light-green shrink-0 shadow-xs mt-1">
                              <Bot className="w-4 h-4" />
                            </div>
                          )}

                          <motion.div
                            layout
                            className={`max-w-[85%] rounded-2xl p-4 text-xs font-medium leading-relaxed shadow-xs whitespace-pre-line relative ${
                              isUser
                                ? 'bg-blue-600 text-light-green rounded-tr-none'
                                : m.isError
                                ? 'bg-red-950 text-red-100 border border-red-500/50 rounded-tl-none'
                                : 'bg-light-green text-slate-800 border border-light-green-border rounded-tl-none'
                            }`}
                          >
                            {!isUser && (
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                                  Shopping AI
                                </p>
                              </div>
                            )}

                            <p>{m.text || (m.isStreaming ? '...' : '')}</p>

                            {/* Rich Metadata Rendering */}
                            {m.metadata?.products && m.metadata.products.length > 0 && (
                              <div className="mt-4 grid grid-cols-1 gap-3">
                                {m.metadata.products.map((p: any) => (
                                  <div key={p.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center space-x-3 hover:bg-white/10 transition-colors">
                                    <img 
                                      src={p.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=100'} 
                                      className="w-12 h-12 rounded-lg object-cover" 
                                    />
                                    <div className="flex-grow min-w-0">
                                      <p className="font-bold text-[11px] truncate text-light-green">{p.name}</p>
                                      <p className="text-[10px] text-blue-400 font-black">{Number(p.price).toLocaleString()} TZS</p>
                                    </div>
                                    <button 
                                      onClick={() => addToCart(p)}
                                      className="p-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
                                    >
                                      <Plus className="w-3 h-3 text-white" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {m.metadata?.shop && (
                              <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="flex items-center space-x-2 mb-2">
                                  <Store className="w-4 h-4 text-amber-400" />
                                  <span className="font-black text-[11px] uppercase text-light-green">{m.metadata.shop.name}</span>
                                </div>
                                <p className="text-[10px] text-slate-300 mb-2 italic">{m.metadata.shop.address}</p>
                                {m.metadata.shop.verificationStatus === 'VERIFIED' && (
                                  <div className="flex items-center space-x-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full w-fit">
                                    <ShieldCheck className="w-3 h-3" />
                                    <span className="text-[9px] font-bold">Verified Seller</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {!isUser && m.text && (
                              <div className="flex items-center justify-end mt-2 space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => speak(m.text)}
                                  className={`p-1.5 rounded-lg transition-colors ${isSpeaking ? 'bg-amber-500 text-white' : 'bg-white/10 text-slate-400 hover:text-white'}`}
                                >
                                  <Zap className={`w-3 h-3 ${isSpeaking ? 'animate-pulse' : ''}`} />
                                </button>
                              </div>
                            )}

                            {m.isError && (
                              <motion.button
                                whileHover={buttonHover.hover}
                                whileTap={buttonHover.tap}
                                onClick={() => {
                                  const lastUserMsg = [...messages].reverse().find((msg) => msg.sender === 'user');
                                  if (lastUserMsg) handleSendMessageStream(lastUserMsg.text);
                                }}
                                className="mt-3 inline-flex items-center px-3 py-1.5 bg-red-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider shadow-sm hover:bg-red-700 cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3 mr-1" /> Jaribu Tena / Retry
                              </motion.button>
                            )}

                            <p
                              className={`text-[9px] mt-1.5 text-right font-bold ${
                                isUser ? 'text-blue-200' : 'text-slate-400'
                              }`}
                            >
                              {new Date(m.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </motion.div>

                          {isUser && (
                            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-light-green shrink-0 shadow-xs mt-1">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>

                <div ref={messagesEndRef} />
              </div>

              {/* Starter Prompt Chips */}
              {messages.length <= 2 && (
                <div className="px-4 py-2 bg-light-green border-t border-light-green-border flex overflow-x-auto space-x-2 no-scrollbar shrink-0">
                  {starterPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessageStream(p.prompt)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-slate-700 hover:text-blue-600 border border-light-green-border rounded-xl text-[11px] font-bold whitespace-nowrap transition-all shrink-0 flex items-center space-x-1 cursor-pointer"
                    >
                      <span>{p.label}</span>
                      <ChevronRight className="w-3 h-3 opacity-60" />
                    </button>
                  ))}
                </div>
              )}

              {/* Input Bar */}
              <div className="p-3 sm:p-4 bg-light-green border-t border-light-green-border shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessageStream();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={
                      language === 'sw'
                        ? 'Uliza Shopping AI chochote kuhusu bidhaa au oda...'
                        : 'Ask Shopping AI about products, shops or orders...'
                    }
                    className="flex-grow p-3 sm:p-3.5 bg-blue-600 border border-blue-400 rounded-2xl text-xs font-bold text-white placeholder:text-blue-100 outline-none focus:ring-2 focus:ring-blue-300 focus:border-white shadow-sm transition-all"
                  />

                  {loading ? (
                    <button
                      type="button"
                      onClick={stopGeneration}
                      className="p-3 sm:p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl shadow-lg transition-all shrink-0 cursor-pointer flex items-center space-x-1 text-xs font-bold"
                      title="Stop generating"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span className="hidden xs:inline">Stop</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!inputMessage.trim()}
                      className="p-3 sm:p-3.5 bg-blue-600 hover:bg-blue-700 text-light-green rounded-2xl shadow-lg shadow-blue-500/25 transition-all disabled:opacity-40 shrink-0 cursor-pointer"
                      title="Send"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
