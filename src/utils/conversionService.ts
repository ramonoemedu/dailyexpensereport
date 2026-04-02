import { auth } from '@/lib/firebase';

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
  async getAuthHeaders() {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Authentication token is missing.');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  },

  // Save conversion record to Firestore
  async saveConversion(record: Omit<ConversionRecord, 'id'>): Promise<string> {
    try {
      const res = await fetch('/api/conversions', {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ record }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to save conversion.');
      return payload.id as string;
    } catch (error) {
      console.error('Error saving conversion record:', error);
      throw error;
    }
  },

  // Get user's conversion history
  async getConversionHistory(_userId: string): Promise<ConversionRecord[]> {
    try {
      const res = await fetch('/api/conversions', {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to fetch conversion history.');

      const records = (payload.records || []) as Array<Record<string, unknown>>;
      return records.map((item) => ({
        id: String(item.id || ''),
        userId: String(item.userId || ''),
        fileName: String(item.fileName || ''),
        pdfSize: Number(item.pdfSize || 0),
        pageCount: Number(item.pageCount || 0),
        mdPath: String(item.mdPath || ''),
        docxPath: String(item.docxPath || ''),
        createdAt: new Date(String(item.createdAt || new Date().toISOString())),
        status: (item.status === 'failed' ? 'failed' : 'completed') as 'completed' | 'failed',
        errorMessage: item.errorMessage ? String(item.errorMessage) : undefined,
      }));
    } catch (error) {
      console.error('Error fetching conversion history:', error);
      throw error;
    }
  },

  // Delete conversion record
  async deleteConversion(conversionId: string): Promise<void> {
    try {
      const res = await fetch(`/api/conversions/${conversionId}`, {
        method: 'DELETE',
        headers: await this.getAuthHeaders(),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to delete conversion record.');
    } catch (error) {
      console.error('Error deleting conversion record:', error);
      throw error;
    }
  },
};
