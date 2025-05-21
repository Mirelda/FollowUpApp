import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, getDocs, deleteDoc, updateDoc, query, where, setDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Check, Download, FileDown, X } from 'lucide-react';
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

function getLocalToday() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().split('T')[0];
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
  const [filteredPDFData, setFilteredPDFData] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const router = useRouter();
  const { id } = router.query;

  // const dates = [new Date().toISOString().split('T')[0]];
  const dates = [getLocalToday()];

  // Tüm saat seçenekleri
  const availableHours = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });

  // State'e tarih aralığı ekle
  const [startDate, setStartDate] = useState<string>(() => getLocalToday());
  const [endDate, setEndDate] = useState<string>(() => getLocalToday());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        if (id) {
          loadPatient(user.uid, id as string);
          loadMedicines(id as string);
          loadMedicineStatus(id as string);
        }
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router, id]);

  useEffect(() => {
    const interval = setInterval(() => {
      const today = getLocalToday();
      setStartDate(prev => (prev !== today ? today : prev));
      setEndDate(prev => (prev !== today ? today : prev));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadPatient = async (uid: string, patientId: string) => {
    try {
      const patientRef = doc(db, 'patients', patientId);
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

  const loadMedicines = async (patientId: string) => {
    try {
      const medicinesRef = collection(db, 'patients', patientId, 'medicines');
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

  const loadMedicineStatus = async (patientId: string) => {
    try {
      const statusRef = collection(db, 'patients', patientId, 'medicineStatus');
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
      const medicinesRef = collection(db, 'patients', id as string, 'medicines');
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
      const medicineRef = doc(db, 'patients', id as string, 'medicines', medicineId);
      await deleteDoc(medicineRef);

      // İlaç durumlarını sil
      const statusRef = collection(db, 'patients', id as string, 'medicineStatus');
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
      const statusRef = doc(db, 'patients', id as string, 'medicineStatus', statusId);
      
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
    // Seçilen tarih aralığını oluştur
    const start = new Date(startDate);
    const end = new Date(endDate);
    const filteredDates: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      filteredDates.push(new Date(d).toISOString().split('T')[0]);
    }
    // Sadece seçilen aralıktaki verileri PDF'e aktar
    const pdfData = filteredDates.flatMap(date =>
      medicines.flatMap(medicine =>
        medicine.hours.map(hour => ({
          date,
          medicineName: medicine.name,
          hour,
          taken: medicineStatus[date]?.[medicine.id]?.[hour] || false
        }))
      )
    );
    setShowPDF(true);
    setFilteredPDFData(pdfData);
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
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg w-full max-w-4xl h-[80vh]">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="text-lg font-medium">PDF Önizleme</h3>
            <button
              onClick={() => setShowPDF(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="h-[calc(80vh-4rem)]">
            <PDFExport
              data={filteredPDFData}
              title={`${patient?.name} - İlaç Takibi`}
              type="medicine"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Üst Bilgi Kartı */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{patient?.name}</h1>
              <p className="text-gray-600 mt-1">İlaç Takibi</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push(`/patient/${id}`)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Geri Dön
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Plus className="h-5 w-5 mr-2" />
                Yeni İlaç Ekle
              </button>
            </div>
          </div>
        </div>

        {/* Ana Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sol Kolon - İlaç Listesi */}
          <div className="lg:col-span-2 space-y-8">
            {/* İlaç Listesi Kartı */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">İlaç Listesi</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                    <span className="text-gray-500">-</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <button
                    onClick={handleExportPDF}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <FileDown className="h-5 w-5 mr-2" />
                    PDF İndir
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                {medicines.map(medicine => (
                  <div key={medicine.id} className="bg-gray-50 rounded-lg p-4 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-900">{medicine.name}</span>
                      <button
                        onClick={() => handleDeleteMedicine(medicine.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {medicine.hours.map(hour => (
                        <button
                          key={hour}
                          type="button"
                          onClick={() => handleStatusChange(startDate, medicine.id, hour, !(medicineStatus[startDate]?.[medicine.id]?.[hour] || false))}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                            ${medicineStatus[startDate]?.[medicine.id]?.[hour] ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-800 border-gray-300'}`}
                        >
                          {hour} {medicineStatus[startDate]?.[medicine.id]?.[hour] ? '✓' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sağ Kolon - İlaç İstatistikleri */}
          <div className="space-y-8">
            {/* İlaç İstatistikleri Kartı */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">İlaç İstatistikleri</h2>
              <div className="space-y-4">
                {dates.map(date => (
                  <div key={date} className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-900">{new Date(date).toLocaleDateString('tr-TR')}</span>
                    <span className="text-sm font-medium text-gray-500">{Object.keys(medicineStatus[date] || {}).length} ilaç</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modaller */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-medium">Yeni İlaç Ekle</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4">
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
          </div>
        </div>
      )}
    </div>
  );
} 