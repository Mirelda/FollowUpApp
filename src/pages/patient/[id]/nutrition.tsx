import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Monitor, Activity, Battery, Wifi, Download, FileDown, X } from 'lucide-react';
import { PDFExport } from '../../../components/PDFExport';

interface Patient {
  id: string;
  name: string;
}

interface DeviceRecord {
  id: string;
  date: string;
  time: string;
  deviceType: 'monitor' | 'pulse' | 'oxygen' | 'other';
  status: 'normal' | 'warning' | 'critical';
  notes: string;
}

function getLocalToday() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().split('T')[0];
}

export default function DevicePage() {
  const [user, setUser] = useState<any>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<DeviceRecord[]>([]);
  const [newRecord, setNewRecord] = useState({
    date: getLocalToday(),
    time: new Date().toTimeString().slice(0, 5),
    deviceType: 'monitor',
    status: 'normal',
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
  const [filteredPDFData, setFilteredPDFData] = useState<DeviceRecord[]>([]);

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
      const recordsRef = collection(db, 'patients', patientId, 'devices');
      const querySnapshot = await getDocs(recordsRef);
      const recordList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DeviceRecord[];
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

    try {
      const recordsRef = collection(db, 'patients', id as string, 'devices');
      const docRef = await addDoc(recordsRef, {
        ...newRecord,
        deviceType: newRecord.deviceType as 'monitor' | 'pulse' | 'oxygen' | 'other',
        status: newRecord.status as 'normal' | 'warning' | 'critical'
      });
      
      setRecords([...records, {
        id: docRef.id,
        ...newRecord,
        deviceType: newRecord.deviceType as 'monitor' | 'pulse' | 'oxygen' | 'other',
        status: newRecord.status as 'normal' | 'warning' | 'critical'
      }]);
      
      setNewRecord({
        date: getLocalToday(),
        time: new Date().toTimeString().slice(0, 5),
        deviceType: 'monitor',
        status: 'normal',
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
      const recordRef = doc(db, 'patients', id as string, 'devices', recordId);
      await deleteDoc(recordRef);
      setRecords(records.filter(record => record.id !== recordId));
    } catch (error) {
      console.error('Kayıt silinirken hata oluştu:', error);
      setError('Kayıt silinirken bir hata oluştu');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'monitor':
        return <Monitor className="w-4 h-4 mr-2 text-gray-400" />;
      case 'pulse':
        return <Activity className="w-4 h-4 mr-2 text-gray-400" />;
      case 'oxygen':
        return <Activity className="w-4 h-4 mr-2 text-gray-400" />;
      case 'other':
        return <Monitor className="w-4 h-4 mr-2 text-gray-400" />;
      default:
        return <Monitor className="w-4 h-4 mr-2 text-gray-400" />;
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
              title={`${patient?.name} - Cihaz Takibi`}
              type="device"
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
              <p className="text-gray-600 mt-1">Cihaz Takibi</p>
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
                Yeni Cihaz Ekle
              </button>
            </div>
          </div>
        </div>

        {/* Ana Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sol Kolon - Cihaz Listesi */}
          <div className="lg:col-span-2 space-y-8">
            {/* Cihaz Listesi Kartı */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Cihaz Listesi</h2>
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
                      <div>Cihaz Türü: <span className="font-semibold">{record.deviceType === 'monitor' ? 'Monitor' : record.deviceType === 'pulse' ? 'Nabız Ölçer' : record.deviceType === 'oxygen' ? 'Oksijen Ölçer' : 'Diğer'}</span></div>
                      <div>Durum: <span className={`font-semibold ${record.status === 'normal' ? 'text-green-600' : record.status === 'warning' ? 'text-yellow-600' : 'text-red-600'}`}>{record.status === 'normal' ? 'Normal' : record.status === 'warning' ? 'Uyarı' : 'Kritik'}</span></div>
                      {record.notes && (
                        <div className="col-span-full">Not: <span className="italic">{record.notes}</span></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sağ Kolon - Cihaz İstatistikleri */}
          <div className="space-y-8">
            {/* Cihaz İstatistikleri Kartı */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Cihaz İstatistikleri</h2>
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
              <h3 className="text-lg font-medium">Yeni Cihaz Ekle</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4">
              <form onSubmit={handleAddRecord} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
                  <input
                    type="date"
                    id="date"
                    value={newRecord.date}
                    onChange={e => setNewRecord({ ...newRecord, date: e.target.value })}
                    required
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">Saat</label>
                  <input
                    type="time"
                    id="time"
                    value={newRecord.time}
                    onChange={e => setNewRecord({ ...newRecord, time: e.target.value })}
                    required
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="deviceType" className="block text-sm font-medium text-gray-700 mb-1">Cihaz Türü</label>
                  <select
                    id="deviceType"
                    value={newRecord.deviceType}
                    onChange={e => setNewRecord({ ...newRecord, deviceType: e.target.value as 'monitor' | 'pulse' | 'oxygen' | 'other' })}
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  >
                    <option value="monitor">Monitor</option>
                    <option value="pulse">Nabız Ölçer</option>
                    <option value="oxygen">Oksijen Ölçer</option>
                    <option value="other">Diğer</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                  <select
                    id="status"
                    value={newRecord.status}
                    onChange={e => setNewRecord({ ...newRecord, status: e.target.value as 'normal' | 'warning' | 'critical' })}
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="warning">Uyarı</option>
                    <option value="critical">Kritik</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
                  <textarea
                    id="notes"
                    value={newRecord.notes}
                    onChange={e => setNewRecord({ ...newRecord, notes: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-primary-50 text-primary-600 px-4 py-2 rounded-xl hover:bg-primary-100 transition-colors flex items-center justify-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Kaydet
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 