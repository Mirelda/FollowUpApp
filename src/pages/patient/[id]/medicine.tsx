import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, getDocs, deleteDoc, updateDoc, query, where, setDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Check, Download } from 'lucide-react';
import { PDFExport } from '../../../components/PDFExport';

interface Medicine {
  id: string;
  name: string;
  hours: string[];
}

interface MedicineStatus {
  [date: string]: {
    [medicineId: string]: {
      [hour: string]: boolean;
    };
  };
}

export default function MedicinePage() {
  const [user, setUser] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medicineStatus, setMedicineStatus] = useState<MedicineStatus>({});
  const [newMedicine, setNewMedicine] = useState({ name: '', hours: ['08:00'] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPDF, setShowPDF] = useState(false);
  const router = useRouter();
  const { id } = router.query;

  // Son 7 günün tarihlerini oluştur
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  // Tüm saat seçenekleri
  const availableHours = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        if (id) {
          loadPatient(user.uid, id as string);
          loadMedicines(user.uid, id as string);
          loadMedicineStatus(user.uid, id as string);
        }
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router, id]);

  const loadPatient = async (uid: string, patientId: string) => {
    try {
      const patientRef = doc(db, 'users', uid, 'patients', patientId);
      const patientDoc = await getDoc(patientRef);
      
      if (patientDoc.exists()) {
        setPatient({
          id: patientDoc.id,
          ...patientDoc.data()
        });
      } else {
        setError('Hasta bulunamadı');
      }
    } catch (error) {
      console.error('Hasta bilgileri yüklenirken hata oluştu:', error);
      setError('Hasta bilgileri yüklenirken bir hata oluştu');
    }
  };

  const loadMedicines = async (uid: string, patientId: string) => {
    try {
      const medicinesRef = collection(db, 'users', uid, 'patients', patientId, 'medicines');
      const querySnapshot = await getDocs(medicinesRef);
      const medicineList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Medicine[];
      setMedicines(medicineList);
    } catch (error) {
      console.error('İlaçlar yüklenirken hata oluştu:', error);
      setError('İlaçlar yüklenirken bir hata oluştu');
    }
  };

  const loadMedicineStatus = async (uid: string, patientId: string) => {
    try {
      const statusRef = collection(db, 'users', uid, 'patients', patientId, 'medicineStatus');
      const querySnapshot = await getDocs(statusRef);
      const status: MedicineStatus = {};
      
      querySnapshot.docs.forEach(doc => {
        const [date, medicineId, hour] = doc.id.split('_');
        if (!status[date]) status[date] = {};
        if (!status[date][medicineId]) status[date][medicineId] = {};
        status[date][medicineId][hour] = doc.data().taken;
      });
      
      setMedicineStatus(status);
    } catch (error) {
      console.error('İlaç durumları yüklenirken hata oluştu:', error);
      setError('İlaç durumları yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedicine.name.trim() || !user || !id) return;

    try {
      const medicinesRef = collection(db, 'users', user.uid, 'patients', id as string, 'medicines');
      const docRef = await addDoc(medicinesRef, {
        name: newMedicine.name.trim(),
        hours: newMedicine.hours
      });

      setMedicines([...medicines, {
        id: docRef.id,
        name: newMedicine.name.trim(),
        hours: newMedicine.hours
      }]);

      setNewMedicine({ name: '', hours: ['08:00'] });
    } catch (error) {
      console.error('İlaç eklenirken hata oluştu:', error);
      setError('İlaç eklenirken bir hata oluştu');
    }
  };

  const handleDeleteMedicine = async (medicineId: string) => {
    if (!user || !id || !window.confirm('İlacı silmek istediğinizden emin misiniz?')) return;

    try {
      // İlacı sil
      const medicineRef = doc(db, 'users', user.uid, 'patients', id as string, 'medicines', medicineId);
      await deleteDoc(medicineRef);

      // İlaç durumlarını sil
      const statusRef = collection(db, 'users', user.uid, 'patients', id as string, 'medicineStatus');
      const statusQuery = query(statusRef, where('medicineId', '==', medicineId));
      const statusSnapshot = await getDocs(statusQuery);
      
      statusSnapshot.docs.forEach(async (doc) => {
        await deleteDoc(doc.ref);
      });

      setMedicines(medicines.filter(m => m.id !== medicineId));
      
      // Status state'inden de sil
      const newStatus = { ...medicineStatus };
      Object.keys(newStatus).forEach(date => {
        if (newStatus[date][medicineId]) {
          delete newStatus[date][medicineId];
        }
      });
      setMedicineStatus(newStatus);
    } catch (error) {
      console.error('İlaç silinirken hata oluştu:', error);
      setError('İlaç silinirken bir hata oluştu');
    }
  };

  const handleStatusChange = async (date: string, medicineId: string, hour: string, taken: boolean) => {
    if (!user || !id) return;

    try {
      const statusId = `${date}_${medicineId}_${hour}`;
      const statusRef = doc(db, 'users', user.uid, 'patients', id as string, 'medicineStatus', statusId);
      
      await setDoc(statusRef, {
        taken,
        medicineId,
        date,
        hour,
        updatedAt: new Date()
      }, { merge: true });

      setMedicineStatus(prev => ({
        ...prev,
        [date]: {
          ...prev[date],
          [medicineId]: {
            ...(prev[date]?.[medicineId] || {}),
            [hour]: taken
          }
        }
      }));
    } catch (error) {
      console.error('İlaç durumu güncellenirken hata oluştu:', error);
      setError('İlaç durumu güncellenirken bir hata oluştu');
    }
  };

  const handleExportPDF = () => {
    // İlaç durumlarını PDF için uygun formata dönüştür
    const pdfData = Object.entries(medicineStatus).flatMap(([date, medicineStatus]) => 
      Object.entries(medicineStatus).flatMap(([medicineId, hourStatus]) => 
        Object.entries(hourStatus).map(([hour, taken]) => ({
          id: `${date}_${medicineId}_${hour}`,
          date,
          medicineName: medicines.find(m => m.id === medicineId)?.name || '',
          hour,
          taken
        }))
      )
    );
    setShowPDF(true);
  };

  if (loading) {
    return <div>Yükleniyor...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <p className="text-red-600">{error}</p>
            <Link href={`/patient/${id}`} className="text-primary-600 hover:text-primary-700 mt-4 inline-block">
              Hasta detayına dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (showPDF) {
    return (
      <PDFExport
        data={Object.entries(medicineStatus).flatMap(([date, medicineStatus]) => 
          Object.entries(medicineStatus).flatMap(([medicineId, hourStatus]) => 
            Object.entries(hourStatus).map(([hour, taken]) => ({
              id: `${date}_${medicineId}_${hour}`,
              date,
              medicineName: medicines.find(m => m.id === medicineId)?.name || '',
              hour,
              taken
            }))
          )
        )}
        title={`${patient?.name} - İlaç Takibi`}
        type="medicine"
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href={`/patient/${id}`} className="text-gray-700 hover:text-gray-900 mr-4 flex items-center">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Geri
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">{patient?.name} - İlaç Takibi</h1>
            </div>
            <button
              onClick={handleExportPDF}
              className="bg-primary-50 text-primary-600 px-4 py-2 rounded-xl hover:bg-primary-100 transition-colors flex items-center"
            >
              <Download className="w-5 h-5 mr-2" />
              PDF İndir
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Yeni İlaç Ekle</h2>
          <form onSubmit={handleAddMedicine} className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={newMedicine.name}
                  onChange={(e) => setNewMedicine({ ...newMedicine, name: e.target.value })}
                  placeholder="İlaç adı"
                  className="w-full rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
              <button
                type="submit"
                className="bg-primary-50 text-primary-600 px-6 py-2 rounded-xl hover:bg-primary-100 transition-colors flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Ekle
              </button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-lg">
              {availableHours.map(hour => (
                <label key={hour} className="inline-flex items-center px-3 py-2 bg-white rounded-lg shadow-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={newMedicine.hours.includes(hour)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewMedicine({
                          ...newMedicine,
                          hours: [...newMedicine.hours, hour]
                        });
                      } else {
                        setNewMedicine({
                          ...newMedicine,
                          hours: newMedicine.hours.filter(h => h !== hour)
                        });
                      }
                    }}
                    className="form-checkbox h-5 w-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-600">{hour}</span>
                </label>
              ))}
            </div>
          </form>
        </div>

        {medicines.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 border-b text-left">Tarih</th>
                  {medicines.map(medicine => (
                    medicine.hours.map(hour => (
                      <th key={`${medicine.id}-${hour}`} className="px-4 py-2 border-b">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-sm font-medium text-center">{medicine.name}</span>
                          <span className="text-xs text-gray-500">{hour}</span>
                          <button
                            onClick={() => handleDeleteMedicine(medicine.id)}
                            className="text-red-500 hover:text-red-700 mt-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </th>
                    ))
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map(date => (
                  <tr key={date}>
                    <td className="px-4 py-2 border-b">
                      {new Date(date).toLocaleDateString('tr-TR')}
                    </td>
                    {medicines.map(medicine => (
                      medicine.hours.map(hour => (
                        <td key={`${date}-${medicine.id}-${hour}`} className="px-4 py-2 border-b">
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={medicineStatus[date]?.[medicine.id]?.[hour] || false}
                              onChange={(e) => handleStatusChange(date, medicine.id, hour, e.target.checked)}
                              className="form-checkbox h-5 w-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                            />
                          </div>
                        </td>
                      ))
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
} 