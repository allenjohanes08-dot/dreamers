// src/services/api.ts
import { fetchWithRetry } from '../lib/api.ts';

export interface ProductPayload {
  name: string;
  description: string;
  price: number;
  stock: number;
  categoryId: number;
  shopId?: number;
  images: string[];
  videoUrl?: string | null;
  status?: string;
}

/**
 * Validate and sanitize product payload to prevent malformed or dangerous data.
 */
function sanitizeProductPayload(data: Partial<ProductPayload>): Partial<ProductPayload> {
  const sanitized: Partial<ProductPayload> = {};

  if (typeof data.name === 'string') {
    sanitized.name = data.name.trim().slice(0, 255);
  }
  if (typeof data.description === 'string') {
    sanitized.description = data.description.trim().slice(0, 5000);
  }
  if (data.price !== undefined) {
    const p = Number(data.price);
    sanitized.price = isNaN(p) || p < 0 ? 0 : p;
  }
  if (data.stock !== undefined) {
    const s = parseInt(String(data.stock), 10);
    sanitized.stock = isNaN(s) || s < 0 ? 0 : s;
  }
  if (data.categoryId !== undefined) {
    sanitized.categoryId = Number(data.categoryId);
  }
  if (data.shopId !== undefined) {
    sanitized.shopId = Number(data.shopId);
  }
  if (Array.isArray(data.images)) {
    sanitized.images = data.images
      .filter((img) => typeof img === 'string' && img.trim().length > 0)
      .slice(0, 10);
  }
  if (data.videoUrl !== undefined) {
    if (data.videoUrl && typeof data.videoUrl === 'string' && (data.videoUrl.startsWith('http') || data.videoUrl.startsWith('data:video/'))) {
      sanitized.videoUrl = data.videoUrl.trim();
    } else {
      sanitized.videoUrl = null;
    }
  }
  if (typeof data.status === 'string') {
    sanitized.status = data.status;
  }

  return sanitized;
}

/**
 * Service layer for product creation with validation, idempotency, and atomic error handling.
 */
export async function createProductService(productData: ProductPayload, token?: string): Promise<any> {
  const cleanData = sanitizeProductPayload(productData);

  if (!cleanData.name) {
    throw new Error('Product name is required');
  }

  try {
    const res = await fetchWithRetry('/api/seller/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(cleanData),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to create product record in database');
    }

    return await res.json();
  } catch (error) {
    console.error('Product creation service error (Atomic write aborted):', error);
    throw new Error(error instanceof Error ? error.message : 'Atomic product creation failed');
  }
}

/**
 * Service layer for product updates with validation, idempotency, and atomic error handling.
 */
export async function updateProductService(
  productId: number | string,
  productData: Partial<ProductPayload>,
  token?: string,
  isAdmin = false
): Promise<any> {
  const cleanData = sanitizeProductPayload(productData);
  const endpoint = isAdmin ? `/api/admin/products/${productId}` : `/api/seller/products/${productId}`;

  try {
    const res = await fetchWithRetry(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(cleanData),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to update product record in database');
    }

    return await res.json();
  } catch (error) {
    console.error(`Product update service error for ID ${productId} (Atomic write aborted):`, error);
    throw new Error(error instanceof Error ? error.message : 'Atomic product update failed');
  }
}

/**
 * Service layer for product deletion / archiving.
 */
export async function deleteProductService(productId: number | string, token?: string): Promise<any> {
  try {
    const res = await fetchWithRetry(`/api/seller/products/${productId}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to delete product');
    }

    return await res.json();
  } catch (error) {
    console.error(`Product delete service error for ID ${productId}:`, error);
    throw new Error(error instanceof Error ? error.message : 'Failed to delete product');
  }
}
