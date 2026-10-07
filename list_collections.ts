
import { adminDb } from './src/lib/firebase-admin.ts';

async function listCollections() {
  try {
    const collections = await adminDb.listCollections();
    console.log('Collections:', collections.map(c => c.id));
  } catch (err) {
    console.error('Error listing collections:', err);
  }
}

listCollections();
