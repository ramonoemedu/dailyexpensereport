import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

export interface ConversionRecord {
  id?: string;
  userId: string;
  fileName: string;
  pdfSize: number;
  pageCount: number;
  mdPath: string;
  docxPath: string;
  createdAt: Date;
  status: 'completed' | 'failed';
  errorMessage?: string;
}

export const conversionService = {
  // Save conversion record to Firestore
  async saveConversion(record: Omit<ConversionRecord, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'pdf_conversions'), {
        ...record,
        createdAt: new Date(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error saving conversion record:', error);
      throw error;
    }
  },

  // Get user's conversion history
  async getConversionHistory(userId: string): Promise<ConversionRecord[]> {
    try {
      const q = query(
        collection(db, 'pdf_conversions'),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
      } as ConversionRecord));
    } catch (error) {
      console.error('Error fetching conversion history:', error);
      throw error;
    }
  },

  // Delete conversion record
  async deleteConversion(conversionId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'pdf_conversions', conversionId));
    } catch (error) {
      console.error('Error deleting conversion record:', error);
      throw error;
    }
  },
};
