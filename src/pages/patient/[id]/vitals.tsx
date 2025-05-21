import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Thermometer, Heart, Droplet, Activity, Download, FileDown, X } from 'lucide-react';
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

function getLocalToday() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().split('T')[0];
}

export default function VitalsPage() {
  const [user, setUser] = useState<any>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<VitalRecord[]>([]);
  const [newRecord, setNewRecord] = useState({
    date: getLocalToday(),
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [startDate, setStartDate] = useState<string>(() => getLocalToday());
  const [endDate, setEndDate] = useState<string>(() => getLocalToday());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        loadPatient(id as string);
        loadRecords(id as string);
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

  const loadPatient = async (patientId: string) => {
    try {
      const patientRef = doc(db, 'patients', patientId);
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

  const loadRecords = async (patientId: string) => {
    try {
      const recordsRef = collection(db, 'patients', patientId, 'vitals');
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
      console.log("Firestore'a vital ekleniyor:", newRecord);
      const recordsRef = collection(db, 'patients', id as string, 'vitals');
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
      console.log("Firestore'a vital eklendi, docRef:", docRef);
      console.log("Eklenen path:", docRef.path);
      
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
        date: getLocalToday(),
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
      const recordRef = doc(db, 'patients', id as string, 'vitals', recordId);
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

  const filteredPDFData = records.filter(record => {
    const recordDate = new Date(record.date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return recordDate >= start && recordDate <= end;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Üst Bilgi Kartı */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{patient?.name}</h1>
              <p className="text-gray-600 mt-1">Vital Takibi</p>
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
                Yeni Vital Ekle
              </button>
            </div>
          </div>
        </div>

        {/* Ana Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sol Kolon - Vital Listesi */}
          <div className="lg:col-span-2 space-y-8">
            {/* Vital Listesi Kartı */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Vital Listesi</h2>
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
                {records.map((record) => (
                  <div key={record.id} className="bg-gray-50 rounded-lg p-4 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">{record.date} {record.time}</span>
                      <button
                        onClick={() => handleDeleteRecord(record.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Sil
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-gray-700">
                      <div>Sıcaklık: <span className="font-semibold">{record.temperature}°C</span></div>
                      <div>Tansiyon: <span className="font-semibold">{record.bloodPressure?.systolic}/{record.bloodPressure?.diastolic}</span></div>
                      {record.oxygenSaturation !== undefined && record.oxygenSaturation !== null && (
                        <div>O2 Sat: <span className="font-semibold">%{record.oxygenSaturation}</span></div>
                      )}
                      {record.formulaAmount !== undefined && record.formulaAmount !== null && (
                        <div>Mama: <span className="font-semibold">{record.formulaAmount}ml</span></div>
                      )}
                      {record.waterAmount !== undefined && record.waterAmount !== null && (
                        <div>Su: <span className="font-semibold">{record.waterAmount}ml</span></div>
                      )}
                      {record.notes && (
                        <div className="col-span-full">Not: <span className="italic">{record.notes}</span></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sağ Kolon - Vital İstatistikleri */}
          <div className="space-y-8">
            {/* Vital İstatistikleri Kartı */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Vital İstatistikleri</h2>
              <div className="space-y-4">
                {/* ... mevcut istatistikler ... */}
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
              <h3 className="text-lg font-medium">Yeni Vital Ekle</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4">
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
            </div>
          </div>
        </div>
      )}

      {showPDF && (
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
                title={`${patient?.name} - Vital Takibi`}
                type="vitals"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 