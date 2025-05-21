import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';

interface SharePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  sharedWith: string[];
}

export default function SharePatientModal({ isOpen, onClose, patientId, sharedWith }: SharePatientModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleShare = async () => {
    if (!email) {
      toast.error('Lütfen bir e-posta adresi girin');
      return;
    }

    if (sharedWith.includes(email)) {
      toast.error('Bu e-posta adresi zaten paylaşılmış');
      return;
    }

    setIsLoading(true);
    try {
      const patientRef = doc(db, 'patients', patientId);
      await updateDoc(patientRef, {
        sharedWith: arrayUnion(email)
      });
      toast.success('Hasta başarıyla paylaşıldı');
      onClose();
      setEmail('');
    } catch (error) {
      console.error('Paylaşım hatası:', error);
      toast.error('Paylaşım sırasında bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-sm rounded bg-white p-6">
          <Dialog.Title className="text-lg font-medium mb-4">
            Hastayı Paylaş
          </Dialog.Title>

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                E-posta Adresi
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="ornek@email.com"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                İptal
              </button>
              <button
                onClick={handleShare}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Paylaşılıyor...' : 'Paylaş'}
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
} 