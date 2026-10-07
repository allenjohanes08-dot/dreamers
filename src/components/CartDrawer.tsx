/// <reference types="@types/google.maps" />
// src/components/CartDrawer.tsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ShieldCheck,
  MapPin,
  Truck,
  ArrowRight,
  CheckCircle2,
  ShoppingBag,
  Store,
  CreditCard,
  AlertCircle,
  Crosshair,
  Navigation
} from 'lucide-react';
import { useCart } from '../context/CartContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import { auth } from '../lib/firebase.ts';
import { fetchWithRetry } from '../lib/api.ts';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useNavigate } from 'react-router-dom';
import { staggerContainer, fadeInUp, listItem, scaleIn, buttonHover } from '../lib/animations';

export default function CartDrawer() {
  const { cart, cartCount, cartTotal, isCartOpen, closeCart, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user, dbUser, language } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number }>({
    lat: -6.7924, // Default Dar es Salaam center
    lng: 39.2083,
  });
  const [paymentMethod, setPaymentMethod] = useState('M-Pesa');
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const autocompleteInputRef = useRef<HTMLInputElement>(null);
  const placesLib = useMapsLibrary('places');

  // Sync user defaults when cart opens
  useEffect(() => {
    if (isCartOpen && dbUser) {
      if (dbUser.profile?.deliveryAddress && !deliveryAddress) {
        setDeliveryAddress(dbUser.profile.deliveryAddress);
      }
      if (dbUser.profile?.paymentMethod) {
        setPaymentMethod(dbUser.profile.paymentMethod);
      }
    }
  }, [isCartOpen, dbUser]);

  // Google Maps Places Autocomplete setup for Tanzania
  useEffect(() => {
    if (!placesLib || !autocompleteInputRef.current || !isCartOpen) return;

    try {
      const autocomplete = new google.maps.places.Autocomplete(autocompleteInputRef.current, {
        componentRestrictions: { country: 'tz' },
        fields: ['address_components', 'geometry', 'formatted_address'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry && place.geometry.location) {
          setDeliveryAddress(place.formatted_address || '');
          setDeliveryCoords({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      });
    } catch (e) {
      console.warn('Google Places init handled gracefully:', e);
    }
  }, [placesLib, isCartOpen]);

  // Delivery fee calculation (flat standard fee or dynamic)
  const deliveryFee = cart.length > 0 ? 3500 : 0; // 3,500 TZS standard courier
  const grandTotal = cartTotal + deliveryFee;

  const [isLocatingUser, setIsLocatingUser] = useState(false);

  // Allow customer to capture and verify device GPS location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('GPS Error', language === 'sw' ? 'Kifaa chako hakina huduma ya GPS' : 'Device does not support GPS geolocation', 'error');
      return;
    }

    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setDeliveryCoords({ lat: latitude, lng: longitude });

        // Reverse geocode via Google Geocoder if available, or set coordinates
        if (typeof google !== 'undefined' && google.maps?.Geocoder) {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
            setIsLocatingUser(false);
            if (status === 'OK' && results && results[0]) {
              setDeliveryAddress(results[0].formatted_address);
              showToast('Eneo Limethibitishwa', `GPS Imethibitishwa (±${Math.round(accuracy)}m): ${results[0].formatted_address}`, 'success');
            } else {
              const fallbackAddr = `GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)}), Tanzania`;
              setDeliveryAddress(fallbackAddr);
              showToast('Eneo Limethibitishwa', `GPS Imethibitishwa: ${fallbackAddr}`, 'success');
            }
          });
        } else {
          setIsLocatingUser(false);
          const fallbackAddr = `GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)}), Tanzania`;
          setDeliveryAddress(fallbackAddr);
          showToast('Eneo Limethibitishwa', `GPS Imethibitishwa: ${fallbackAddr}`, 'success');
        }
      },
      (err) => {
        setIsLocatingUser(false);
        console.warn('Customer geolocation error:', err);
        showToast('Ruhusa ya GPS', language === 'sw' ? 'Ruhusa ya eneo imekataliwa. Tafadhali wezesha kwenye kivinjari chako.' : 'Location permission denied in browser.', 'error');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleCheckout = async () => {
    setErrorMessage(null);

    if (!user) {
      try {
        localStorage.setItem('dreamers_pending_checkout', 'true');
        localStorage.setItem('dreamers_delivery_address', deliveryAddress || 'Kariakoo, Dar es Salaam');
      } catch (e) {}
      showToast('Tafadhali Ingia / Sign In Required', 'Ingia au tengeneza akaunti ili kukamilisha oda yako ya Escrow', 'info');
      closeCart();
      navigate('/login?redirect=checkout&action=checkout');
      return;
    }

    const targetAddress = deliveryAddress.trim() || 'Kariakoo, Dar es Salaam';
    const targetCoords = deliveryCoords || { lat: -6.8162, lng: 39.2804 };

    setIsOrdering(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry('/api/customer/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
          deliveryAddress: targetAddress,
          deliveryLatitude: targetCoords.lat,
          deliveryLongitude: targetCoords.lng,
          totalAmount: grandTotal,
          paymentMethod: paymentMethod,
        }),
      });

      if (res.ok) {
        const orderData = await res.json().catch(() => ({}));
        setOrderSuccess(orderData);
        clearCart();
        showToast('Oda Imewasilishwa / Order Placed!', `Oda #${orderData.id || ''} imepokelewa. Malipo yapo salama kwenye Escrow.`, 'success');
        try {
          localStorage.removeItem('dreamers_pending_checkout');
        } catch (e) {}
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = err.error || 'Failed to place order. Please check item stock.';
        setErrorMessage(msg);
        showToast('Oda Imeshindikana / Order Error', msg, 'error');
      }
    } catch (e: any) {
      const msg = e?.message || 'Network error occurred. Please retry.';
      setErrorMessage(msg);
      showToast('Error', msg, 'error');
    } finally {
      setIsOrdering(false);
    }
  };

  const handleGoToOrders = () => {
    setOrderSuccess(null);
    closeCart();
    navigate('/customer');
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <div className="fixed inset-0 z-[120] overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
          />

          {/* Slide-out Drawer Panel */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 pointer-events-auto">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="w-screen max-w-md bg-slate-900 border-l border-white/15 text-white shadow-2xl flex flex-col justify-between h-full max-h-[100dvh] min-h-0"
            >
              {/* Header */}
              <div className="p-6 bg-slate-950/80 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/40 rounded-2xl flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-black uppercase tracking-tight text-white flex items-center space-x-2">
                      <span>{language === 'sw' ? 'Mkokoteni wa Manunuzi' : 'Shopping Cart'}</span>
                      <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full font-bold">
                        {cartCount} {language === 'sw' ? 'vitu' : 'items'}
                      </span>
                    </h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      100% Escrow Protection • Tanzania
                    </p>
                  </div>
                </div>

                <button
                  onClick={closeCart}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Order Success State */}
              <AnimatePresence mode="wait">
                {orderSuccess ? (
                  <motion.div 
                    key="success"
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    variants={staggerContainer(0.1)}
                    className="p-8 flex flex-col items-center justify-center text-center space-y-6 flex-grow overflow-y-auto"
                  >
                    <motion.div variants={scaleIn} className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/40 rounded-3xl flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-10 h-10" />
                    </motion.div>
                    <div className="space-y-2">
                      <motion.span variants={fadeInUp} className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full inline-block">
                        {language === 'sw' ? 'Oda Imepokelewa Kikamilifu' : 'Order Placed Successfully'}
                      </motion.span>
                      <motion.h3 variants={fadeInUp} className="text-2xl font-black text-white uppercase tracking-tight">
                        {language === 'sw' ? 'Asante kwa Kununua!' : 'Thank you for your order!'}
                      </motion.h3>
                      <motion.p variants={fadeInUp} className="text-xs text-slate-300 font-medium max-w-xs leading-relaxed mx-auto">
                        {language === 'sw'
                          ? 'Malipo yako yamelindwa kwenye Escrow. Mfanyabiashara anaanza kuandaa oda yako na msafirishaji amearifiwa.'
                          : 'Your funds are securely held in Escrow. The seller is preparing your items and dispatch is scheduled.'}
                      </motion.p>
                    </div>

                    <motion.div variants={fadeInUp} className="w-full bg-slate-950/80 border border-white/10 p-4 rounded-2xl text-left space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>{language === 'sw' ? 'Anwani ya Mzigo:' : 'Destination:'}</span>
                        <span className="text-white font-bold truncate max-w-[180px]">{deliveryAddress}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>{language === 'sw' ? 'Jumla ya Malipo:' : 'Total Amount:'}</span>
                        <span className="text-emerald-400 font-black">{grandTotal.toLocaleString()} TZS</span>
                      </div>
                    </motion.div>

                    <div className="w-full space-y-2">
                      <motion.button
                        variants={fadeInUp}
                        whileHover={buttonHover.hover}
                        whileTap={buttonHover.tap}
                        onClick={handleGoToOrders}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/25 transition-all"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>{language === 'sw' ? 'Fuatilia Oda Zako' : 'Track Your Orders'}</span>
                      </motion.button>
                      <motion.button
                        variants={fadeInUp}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setOrderSuccess(null);
                          closeCart();
                        }}
                        className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl text-xs font-bold transition-all"
                      >
                        {language === 'sw' ? 'Endelea Kununua' : 'Continue Shopping'}
                      </motion.button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="cart-content"
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    variants={staggerContainer(0.05)}
                    className="flex flex-col flex-grow overflow-hidden"
                  >
                    {/* Cart Item List */}
                    <div className="p-6 overflow-y-auto space-y-4 flex-grow">
                      {cart.length === 0 ? (
                        <motion.div 
                          variants={scaleIn}
                          className="text-center py-16 space-y-4"
                        >
                        <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto text-slate-500">
                          <ShoppingBag className="w-8 h-8" />
                        </div>
                        <div>
                          <h4 className="text-base font-black text-white uppercase tracking-tight">
                            {language === 'sw' ? 'Mkokoteni Wako Upo Wazi' : 'Your cart is empty'}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                            {language === 'sw'
                              ? 'Vinjari bidhaa bora sokoni na uziongeze hapa kwa kubofya "Add to Cart".'
                              : 'Explore verified Tanzanian products in our marketplace and add them here.'}
                          </p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            closeCart();
                            navigate('/marketplace');
                          }}
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md transition-all"
                        >
                          {language === 'sw' ? 'Vinjari Sokoni' : 'Browse Marketplace'}
                        </motion.button>
                      </motion.div>
                    ) : (
                      <>
                        <motion.div 
                          initial="initial"
                          animate="animate"
                          variants={staggerContainer(0.05)}
                          className="space-y-3"
                        >
                          {cart.map((item) => (
                            <motion.div
                              layout
                              variants={listItem}
                              key={item.productId}
                              className="p-4 bg-slate-950/70 border border-white/10 rounded-2xl flex items-center space-x-3.5 group hover:border-blue-500/40 transition-all"
                            >
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-16 h-16 object-cover rounded-xl bg-slate-800 shrink-0 border border-white/10"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=200';
                                }}
                              />

                              <div className="flex-grow min-w-0">
                                {item.shopName && (
                                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest truncate flex items-center space-x-1">
                                    <Store className="w-3 h-3 shrink-0 mr-1" />
                                    <span>{item.shopName}</span>
                                  </p>
                                )}
                                <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                                <p className="text-xs font-black text-emerald-400 mt-0.5">
                                  {Number(item.price).toLocaleString()} <span className="text-[10px]">TZS</span>
                                </p>
                              </div>

                              <div className="flex flex-col items-end space-y-2 shrink-0">
                                <button
                                  onClick={() => removeFromCart(item.productId)}
                                  className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>

                                <div className="flex items-center space-x-1.5 bg-slate-900/90 rounded-xl p-1 border border-blue-500/30 shadow-inner">
                                  <button
                                    onClick={() => updateQuantity(item.productId, -1)}
                                    aria-label="Decrease quantity"
                                    className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/30 active:scale-95 transition-all"
                                  >
                                    <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                                  </button>
                                  <span className="text-xs font-black px-2 min-w-[24px] text-center text-white">
                                    {item.quantity}
                                  </span>
                                  <button
                                    onClick={() => updateQuantity(item.productId, 1)}
                                    aria-label="Increase quantity"
                                    className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/30 active:scale-95 transition-all"
                                  >
                                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </motion.div>

                        {/* Delivery Location Section */}
                        <motion.div variants={fadeInUp} className="p-4 bg-slate-950/80 border border-white/10 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-300">
                            <div className="flex items-center space-x-2">
                              <MapPin className="w-4 h-4 text-blue-400" />
                              <span>{language === 'sw' ? 'Eneo la Kufikisha Mzigo' : 'Delivery Destination (TZ)'}</span>
                            </div>
                            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Tanzania</span>
                          </div>

                          <div className="relative">
                            <input
                              ref={autocompleteInputRef}
                              type="text"
                              value={deliveryAddress}
                              onChange={(e) => {
                                setDeliveryAddress(e.target.value);
                                if (!deliveryCoords) setDeliveryCoords({ lat: -6.8162, lng: 39.2804 });
                              }}
                              placeholder={
                                language === 'sw'
                                  ? 'Mfano: Kariakoo, Dar es Salaam au Arusha mjini...'
                                  : 'e.g., Kariakoo Market, Dar es Salaam or Arusha...'
                              }
                              className="w-full px-3.5 py-3 bg-blue-600 border border-blue-400 rounded-xl text-xs font-bold text-white placeholder:text-blue-100 outline-none focus:ring-2 focus:ring-blue-300 focus:border-white shadow-sm"
                            />
                          </div>

                          {/* Device GPS Location Button & Verified Coordinate Badge */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleUseCurrentLocation}
                              disabled={isLocatingUser}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 rounded-xl text-[10px] font-black text-blue-200 uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
                            >
                              <Crosshair className={`w-3.5 h-3.5 text-blue-400 ${isLocatingUser ? 'animate-spin' : ''}`} />
                              <span>
                                {isLocatingUser
                                  ? (language === 'sw' ? 'Inatafuta GPS...' : 'Locating GPS...')
                                  : (language === 'sw' ? 'Tumia GPS Yangu Sasa' : 'Use My Current GPS')}
                              </span>
                            </button>

                            {deliveryCoords && (
                              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 truncate max-w-[200px]">
                                ✓ GPS: {deliveryCoords.lat.toFixed(4)}, {deliveryCoords.lng.toFixed(4)}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">
                              {language === 'sw' ? 'Njia ya Malipo' : 'Payment Method'}
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {['M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Cash on Delivery'].map((method) => (
                                <button
                                  key={method}
                                  type="button"
                                  onClick={() => setPaymentMethod(method)}
                                  className={`px-2 py-2 rounded-xl text-[10px] font-black transition-all border ${
                                    paymentMethod === method
                                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                                      : 'bg-slate-900 text-slate-400 border-white/5 hover:border-white/20'
                                  }`}
                                >
                                  {method}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Quick Destination Chips for Tanzania */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {[
                              { name: 'Kariakoo, Dar', lat: -6.8162, lng: 39.2804 },
                              { name: 'Posta / CBD', lat: -6.8169, lng: 39.2894 },
                              { name: 'Sinza / Kinondoni', lat: -6.7800, lng: 39.2300 },
                              { name: 'Mlimani City', lat: -6.7725, lng: 39.2198 },
                              { name: 'Arusha CBD', lat: -3.3731, lng: 36.6944 },
                              { name: 'Dodoma City', lat: -6.1630, lng: 35.7516 },
                            ].map((loc) => (
                              <button
                                key={loc.name}
                                type="button"
                                onClick={() => {
                                  setDeliveryAddress(`${loc.name}, Tanzania`);
                                  setDeliveryCoords({ lat: loc.lat, lng: loc.lng });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all border ${
                                  deliveryAddress.includes(loc.name.split(',')[0])
                                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                                    : 'bg-slate-900 text-slate-300 border-white/10 hover:border-blue-400 hover:text-blue-300'
                                }`}
                              >
                                📍 {loc.name}
                              </button>
                            ))}
                          </div>

                          {/* Escrow Guarantee Pill */}
                          <div className="p-3 bg-blue-950/50 border border-blue-500/30 rounded-xl flex items-start space-x-2.5">
                            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-blue-200 font-medium leading-tight">
                              <strong className="font-black text-white">Escrow Secured:</strong>{' '}
                              {language === 'sw'
                                ? 'Pesa zako zinalindwa hadi mzigo utakapokufikia na kuridhika.'
                                : 'Funds remain protected in Escrow until delivery is confirmed.'}
                            </p>
                          </div>
                        </motion.div>

                        {/* Error notice */}
                        {errorMessage && (
                          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center space-x-2 text-xs text-red-300 font-bold">
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                            <span>{errorMessage}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                    {/* Footer & Checkout Summary */}
                    {cart.length > 0 && (
                      <motion.div variants={fadeInUp} className="p-6 bg-slate-950/90 border-t border-white/10 space-y-4">
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between text-slate-400">
                            <span>{language === 'sw' ? 'Bei ya Bidhaa' : 'Subtotal'}</span>
                            <span className="text-slate-200 font-bold">{cartTotal.toLocaleString()} TZS</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span className="flex items-center space-x-1">
                              <Truck className="w-3.5 h-3.5 text-blue-400" />
                              <span>{language === 'sw' ? 'Gharama ya Usafirishaji' : 'Delivery Fee (TZ)'}</span>
                            </span>
                            <span className="text-slate-200 font-bold">{deliveryFee.toLocaleString()} TZS</span>
                          </div>
                          <div className="pt-2 border-t border-white/10 flex justify-between items-baseline">
                            <span className="text-sm font-black text-white uppercase tracking-tight">
                              {language === 'sw' ? 'Jumla Kuu' : 'Grand Total'}
                            </span>
                            <span className="text-xl font-black text-emerald-400 tracking-tight">
                              {grandTotal.toLocaleString()} <span className="text-xs">TZS</span>
                            </span>
                          </div>
                        </div>

                        <motion.button
                          whileHover={buttonHover.hover}
                          whileTap={buttonHover.tap}
                          onClick={handleCheckout}
                          disabled={isOrdering}
                          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 shadow-xl shadow-blue-500/25 transition-all group"
                        >
                          {isOrdering ? (
                            <span>{language === 'sw' ? 'Inashughulikiwa...' : 'Processing Escrow...'}</span>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4" />
                              <span>
                                {language === 'sw' ? 'Lipa Salama (Escrow Protected)' : 'Checkout (Escrow Protected)'}
                              </span>
                              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
                        </motion.button>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
