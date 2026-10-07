// src/context/ShoppingAIContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

interface ShoppingAIContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  openShoppingAI: (query?: string, productObj?: any) => void;
  closeShoppingAI: () => void;
  initialQuery?: string;
  activeProductContext?: any;
  setActiveProductContext: (prod: any) => void;
}

const ShoppingAIContext = createContext<ShoppingAIContextType | undefined>(undefined);

export function ShoppingAIProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState<string | undefined>(undefined);
  const [activeProductContext, setActiveProductContext] = useState<any>(null);

  const openShoppingAI = (query?: string, productObj?: any) => {
    if (query) {
      setInitialQuery(query);
    }
    if (productObj) {
      setActiveProductContext(productObj);
    }
    setIsOpen(true);
  };

  const closeShoppingAI = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ query?: string; product?: any }>;
      openShoppingAI(customEvent.detail?.query, customEvent.detail?.product);
    };

    window.addEventListener('open-shopping-ai', handleOpen);
    return () => window.removeEventListener('open-shopping-ai', handleOpen);
  }, []);

  return (
    <ShoppingAIContext.Provider
      value={{
        isOpen,
        setIsOpen,
        openShoppingAI,
        closeShoppingAI,
        initialQuery,
        activeProductContext,
        setActiveProductContext,
      }}
    >
      {children}
    </ShoppingAIContext.Provider>
  );
}

export function useShoppingAI() {
  const context = useContext(ShoppingAIContext);
  if (!context) {
    console.warn('useShoppingAI used outside of ShoppingAIProvider, returning default fallback.');
    return {
      isOpen: false,
      setIsOpen: () => {},
      openShoppingAI: () => {},
      closeShoppingAI: () => {},
      initialQuery: undefined,
      activeProductContext: null,
      setActiveProductContext: () => {},
    };
  }
  return context;
}
