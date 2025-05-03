import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Monitor, Activity, Battery, Wifi, Download } from 'lucide-react';
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

export default function DevicePage() {
  const [user, setUser] = useState<any>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<DeviceRecord[]>([]);
  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split('T')[0],
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
      const recordsRef = collection(db, 'users', uid, 'patients', patientId, 'devices');
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
      const recordsRef = collection(db, 'users', user.uid, 'patients', id as string, 'devices');
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
        date: new Date().toISOString().split('T')[0],
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
      const recordRef = doc(db, 'users', user.uid, 'patients', id as string, 'devices', recordId);
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
      <PDFExport
        data={records}
        title={`${patient?.name} - Cihaz Takibi`}
        type="device"
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
              <h1 className="text-xl font-semibold text-gray-900">{patient.name} - Cihaz Takibi</h1>
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
                <label htmlFor="deviceType" className="block text-sm font-medium text-gray-700 mb-1">
                  Cihaz Türü
                </label>
                <select
                  id="deviceType"
                  value={newRecord.deviceType}
                  onChange={(e) => setNewRecord({ ...newRecord, deviceType: e.target.value as 'monitor' | 'pulse' | 'oxygen' | 'other' })}
                  className="w-full rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="monitor">Monitor</option>
                  <option value="pulse">Nabız Ölçer</option>
                  <option value="oxygen">Oksijen Ölçer</option>
                  <option value="other">Diğer</option>
                </select>
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Durum
                </label>
                <select
                  id="status"
                  value={newRecord.status}
                  onChange={(e) => setNewRecord({ ...newRecord, status: e.target.value as 'normal' | 'warning' | 'critical' })}
                  className="w-full rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="normal">Normal</option>
                  <option value="warning">Uyarı</option>
                  <option value="critical">Kritik</option>
                </select>
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

          <div className="overflow-x-auto -mx-6 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Tarih/Saat
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Cihaz
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Durum
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">İşlemler</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 sm:pl-6">
                          <div className="flex flex-col">
                            <span>{record.date}</span>
                            <span className="text-gray-500">{record.time}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                          <div className="flex items-center">
                            {getDeviceIcon(record.deviceType)}
                            <span>
                              {record.deviceType === 'monitor' ? 'Monitor' : 
                               record.deviceType === 'pulse' ? 'Nabız Ölçer' : 
                               record.deviceType === 'oxygen' ? 'Oksijen Ölçer' : 'Diğer'}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span className={`${getStatusColor(record.status)}`}>
                            {record.status === 'normal' ? 'Normal' : 
                             record.status === 'warning' ? 'Uyarı' : 'Kritik'}
                          </span>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            onClick={() => handleDeleteRecord(record.id)}
                            className="text-red-600 hover:text-red-900 flex items-center justify-end"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="ml-1 hidden sm:inline">Sil</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 