// src/context/CartContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNotifications } from './NotificationContext.tsx';

export interface CartItem {
  id: number | string;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  shopName?: string;
  shopId?: number;
  stock?: number;
  unit?: string;
}

interface CartContextType {
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addToCart: (product: any, quantity?: number) => void;
  updateQuantity: (productId: number, delta: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'dreamers_shopping_cart_v2';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useNotifications();
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  // Sync with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [cart]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);
  const toggleCart = () => setIsCartOpen((prev) => !prev);

  const addToCart = (productObj: any, quantity: number = 1) => {
    const product = productObj.product ? productObj.product : productObj;
    const shop = productObj.shop ? productObj.shop : null;

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      const productPrice = Number(product.price) || 0;
      const productImg =
        product.images?.[0] ||
        product.imageUrl ||
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600';

      if (existingIndex > -1) {
        const updated = [...prev];
        const existingItem = updated[existingIndex];
        const maxStock = product.stock ?? existingItem.stock ?? 999;
        const newQty = Math.min(maxStock, existingItem.quantity + quantity);
        updated[existingIndex] = {
          ...existingItem,
          quantity: newQty,
        };
        return updated;
      }

      const newItem: CartItem = {
        id: `${product.id}-${Date.now()}`,
        productId: product.id,
        name: product.name || 'Bidhaa',
        price: productPrice,
        quantity: Math.max(1, quantity),
        imageUrl: productImg,
        shopName: shop?.name || product.shopName || 'Muuzaji wa Dreamers',
        shopId: shop?.id || product.shopId,
        stock: product.stock,
      };

      return [...prev, newItem];
    });

    showToast('Imewekwa Kwenye Kikapu / Cart Updated', `${product.name || 'Bidhaa'} imewekwa kwenye kikapu chako`, 'success');
    setIsCartOpen(true);
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const nextQty = item.quantity + delta;
            const maxStock = item.stock ?? 999;
            if (nextQty <= 0) return null;
            return { ...item, quantity: Math.min(maxStock, nextQty) };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
    showToast('Imeondolewa / Item Removed', 'Bidhaa imeondolewa kwenye kikapu', 'info');
  };

  const clearCart = () => {
    setCart([]);
  };

  const value = React.useMemo(() => ({
    cart,
    cartCount,
    cartTotal,
    isCartOpen,
    setIsCartOpen,
    openCart,
    closeCart,
    toggleCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  }), [cart, cartCount, cartTotal, isCartOpen]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    console.warn('useCart used outside of CartProvider, returning default fallback.');
    return {
      cart: [],
      cartCount: 0,
      cartTotal: 0,
      isCartOpen: false,
      setIsCartOpen: () => {},
      openCart: () => {},
      closeCart: () => {},
      toggleCart: () => {},
      addToCart: () => {},
      updateQuantity: () => {},
      removeFromCart: () => {},
      clearCart: () => {},
    };
  }
  return context;
};
