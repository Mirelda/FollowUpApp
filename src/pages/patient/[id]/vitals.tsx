import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Thermometer, Heart, Droplet, Activity, Download } from 'lucide-react';
import { PDFExport } from '../../../components/PDFExport';

interface Patient {
  id: string;
  name: string;
}

interface VitalRecord {
  id: string;
  date: string;
  time: string;
  temperature: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  oxygenSaturation: number;
  formulaAmount: number;
  waterAmount: number;
  notes: string;
}

export default function VitalsPage() {
  const [user, setUser] = useState<any>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<VitalRecord[]>([]);
  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    temperature: '',
    bloodPressure: {
      systolic: '',
      diastolic: ''
    },
    oxygenSaturation: '',
    formulaAmount: '',
    waterAmount: '',
    notes: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const { id } = router.query;
  const [showPDF, setShowPDF] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        loadPatient(user.uid, id as string);
        loadRecords(user.uid, id as string);
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
          name: patientDoc.data().name
        });
      } else {
        setError('Hasta bulunamadı');
      }
    } catch (error) {
      console.error('Hasta bilgileri yüklenirken hata oluştu:', error);
      setError('Hasta bilgileri yüklenirken bir hata oluştu');
    }
  };

  const loadRecords = async (uid: string, patientId: string) => {
    try {
      const recordsRef = collection(db, 'users', uid, 'patients', patientId, 'vitals');
      const querySnapshot = await getDocs(recordsRef);
      const recordList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VitalRecord[];
      setRecords(recordList);
    } catch (error) {
      console.error('Kayıtlar yüklenirken hata oluştu:', error);
      setError('Kayıtlar yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasyon kontrolleri
    if (!newRecord.temperature || !newRecord.bloodPressure.systolic || !newRecord.bloodPressure.diastolic) {
      setError('Lütfen zorunlu alanları doldurun');
      return;
    }

    // Sıcaklık kontrolü (35-42 derece arası)
    if (Number(newRecord.temperature) < 35 || Number(newRecord.temperature) > 42) {
      setError('Vücut sıcaklığı 35-42°C arasında olmalıdır');
      return;
    }

    // Tansiyon kontrolü
    if (Number(newRecord.bloodPressure.systolic) < 60 || Number(newRecord.bloodPressure.systolic) > 200) {
      setError('Sistolik tansiyon değeri 60-200 arasında olmalıdır');
      return;
    }

    if (Number(newRecord.bloodPressure.diastolic) < 40 || Number(newRecord.bloodPressure.diastolic) > 120) {
      setError('Diyastolik tansiyon değeri 40-120 arasında olmalıdır');
      return;
    }

    // Oksijen saturasyonu kontrolü
    if (newRecord.oxygenSaturation && (Number(newRecord.oxygenSaturation) < 0 || Number(newRecord.oxygenSaturation) > 100)) {
      setError('Oksijen saturasyonu 0-100 arasında olmalıdır');
      return;
    }

    // Sıvı miktarı kontrolü
    if (newRecord.formulaAmount && Number(newRecord.formulaAmount) < 0) {
      setError('Mama miktarı negatif olamaz');
      return;
    }

    if (newRecord.waterAmount && Number(newRecord.waterAmount) < 0) {
      setError('Su miktarı negatif olamaz');
      return;
    }

    try {
      const recordsRef = collection(db, 'users', user.uid, 'patients', id as string, 'vitals');
      const docRef = await addDoc(recordsRef, {
        ...newRecord,
        temperature: Number(newRecord.temperature),
        bloodPressure: {
          systolic: Number(newRecord.bloodPressure.systolic),
          diastolic: Number(newRecord.bloodPressure.diastolic)
        },
        oxygenSaturation: newRecord.oxygenSaturation ? Number(newRecord.oxygenSaturation) : null,
        formulaAmount: newRecord.formulaAmount ? Number(newRecord.formulaAmount) : null,
        waterAmount: newRecord.waterAmount ? Number(newRecord.waterAmount) : null
      });
      
      setRecords([...records, {
        id: docRef.id,
        ...newRecord,
        temperature: Number(newRecord.temperature),
        bloodPressure: {
          systolic: Number(newRecord.bloodPressure.systolic),
          diastolic: Number(newRecord.bloodPressure.diastolic)
        },
        oxygenSaturation: newRecord.oxygenSaturation ? Number(newRecord.oxygenSaturation) : 0,
        formulaAmount: newRecord.formulaAmount ? Number(newRecord.formulaAmount) : 0,
        waterAmount: newRecord.waterAmount ? Number(newRecord.waterAmount) : 0
      }]);
      
      setNewRecord({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        temperature: '',
        bloodPressure: {
          systolic: '',
          diastolic: ''
        },
        oxygenSaturation: '',
        formulaAmount: '',
        waterAmount: '',
        notes: ''
      });
      setError('');
    } catch (error) {
      console.error('Kayıt eklenirken hata oluştu:', error);
      setError('Kayıt eklenirken bir hata oluştu');
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    try {
      const recordRef = doc(db, 'users', user.uid, 'patients', id as string, 'vitals', recordId);
      await deleteDoc(recordRef);
      setRecords(records.filter(record => record.id !== recordId));
    } catch (error) {
      console.error('Kayıt silinirken hata oluştu:', error);
      setError('Kayıt silinirken bir hata oluştu');
    }
  };

  const handleExportPDF = () => {
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
            <Link href="/dashboard" className="text-primary-600 hover:text-primary-700 mt-4 inline-block">
              Dashboard'a dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return null;
  }

  if (showPDF) {
    return (
      <PDFExport
        data={records}
        title={`${patient?.name} - Vital Değerler`}
        type="vitals"
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href={`/patient/${patient.id}`} className="text-gray-700 hover:text-gray-900 mr-4 flex items-center">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Geri
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">{patient.name} - Vital Değerler</h1>
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
          <form onSubmit={handleAddRecord} className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                  Tarih
                </label>
                <input
                  type="date"
                  id="date"
                  value={newRecord.date}
                  onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })}
                  className="w-full rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
              <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                  Saat
                </label>
                <input
                  type="time"
                  id="time"
                  value={newRecord.time}
                  onChange={(e) => setNewRecord({ ...newRecord, time: e.target.value })}
                  className="w-full rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
              <div>
                <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-1">
                  Vücut Sıcaklığı (°C)
                </label>
                <div className="relative">
                  <Thermometer className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="number"
                    step="0.1"
                    id="temperature"
                    value={newRecord.temperature}
                    onChange={(e) => setNewRecord({ ...newRecord, temperature: e.target.value })}
                    className="w-full pl-10 rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="systolic" className="block text-sm font-medium text-gray-700 mb-1">
                  Tansiyon (Sistolik)
                </label>
                <div className="relative">
                  <Heart className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="number"
                    id="systolic"
                    value={newRecord.bloodPressure.systolic}
                    onChange={(e) => setNewRecord({
                      ...newRecord,
                      bloodPressure: { ...newRecord.bloodPressure, systolic: e.target.value }
                    })}
                    className="w-full pl-10 rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="diastolic" className="block text-sm font-medium text-gray-700 mb-1">
                  Tansiyon (Diyastolik)
                </label>
                <div className="relative">
                  <Heart className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="number"
                    id="diastolic"
                    value={newRecord.bloodPressure.diastolic}
                    onChange={(e) => setNewRecord({
                      ...newRecord,
                      bloodPressure: { ...newRecord.bloodPressure, diastolic: e.target.value }
                    })}
                    className="w-full pl-10 rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="oxygenSaturation" className="block text-sm font-medium text-gray-700 mb-1">
                  Oksijen Saturasyonu (%)
                </label>
                <div className="relative">
                  <Activity className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="number"
                    id="oxygenSaturation"
                    value={newRecord.oxygenSaturation}
                    onChange={(e) => setNewRecord({ ...newRecord, oxygenSaturation: e.target.value })}
                    className="w-full pl-10 rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="formulaAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Mama Miktarı (ml)
                </label>
                <div className="relative">
                  <Droplet className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="number"
                    id="formulaAmount"
                    value={newRecord.formulaAmount}
                    onChange={(e) => setNewRecord({ ...newRecord, formulaAmount: e.target.value })}
                    className="w-full pl-10 rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="waterAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Su Miktarı (ml)
                </label>
                <div className="relative">
                  <Droplet className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="number"
                    id="waterAmount"
                    value={newRecord.waterAmount}
                    onChange={(e) => setNewRecord({ ...newRecord, waterAmount: e.target.value })}
                    className="w-full pl-10 rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notlar
                </label>
                <textarea
                  id="notes"
                  value={newRecord.notes}
                  onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <button
                  type="submit"
                  className="w-full bg-primary-50 text-primary-600 px-4 py-2 rounded-xl hover:bg-primary-100 transition-colors flex items-center justify-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Kaydet
                </button>
              </div>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tarih/Saat
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sıcaklık
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tansiyon
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    O2 Sat
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mama
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Su
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.date} {record.time}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Thermometer className="w-4 h-4 mr-2 text-gray-400" />
                        {record.temperature}°C
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Heart className="w-4 h-4 mr-2 text-gray-400" />
                        {record.bloodPressure.systolic}/{record.bloodPressure.diastolic}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Activity className="w-4 h-4 mr-2 text-gray-400" />
                        %{record.oxygenSaturation}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Droplet className="w-4 h-4 mr-2 text-gray-400" />
                        {record.formulaAmount}ml
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Droplet className="w-4 h-4 mr-2 text-gray-400" />
                        {record.waterAmount}ml
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDeleteRecord(record.id)}
                        className="text-red-600 hover:text-red-900 flex items-center"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
} 