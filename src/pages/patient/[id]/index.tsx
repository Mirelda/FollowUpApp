import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Pill, 
  Activity, 
  Monitor, 
  Bell, 
  X,
  FileDown,
  Heart,
  Cake
} from 'lucide-react';
import SharePatientModal from '../../../components/SharePatientModal';
import { useAuth } from '../../../contexts/AuthContext';
import { toast, Toaster } from 'react-hot-toast';
import { PDFExport } from '../../../components/PDFExport';

interface DailySummary {
  vitals: {
    temperature?: number;
    bloodPressure?: {
      systolic: number;
      diastolic: number;
    };
    oxygenSaturation?: number;
    formulaAmount?: number;
    waterAmount?: number;
    time?: string;
  };
  devices: {
    status: 'normal' | 'warning' | 'critical';
    deviceType: string;
    time: string;
    notes?: string;
  }[];
  medicines: {
    name: string;
    hours: string[];
    status: {
      [hour: string]: boolean;
    };
  }[];
}

// Icon bileşenlerini doğrudan kullan
const PillIcon = Pill;
const HeartIcon = Heart;
const CakeIcon = Cake;
const DocumentArrowDownIcon = FileDown;
const XMarkIcon = X;

function getLocalToday() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().split('T')[0];
}

export default function PatientDetail() {
  const [user, setUser] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [dailySummary, setDailySummary] = useState<DailySummary>({
    vitals: {},
    devices: [],
    medicines: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const router = useRouter();
  const { id } = router.query;
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const { user: authUser } = useAuth();
  const [startDate, setStartDate] = useState<string>(() => getLocalToday());
  const [endDate, setEndDate] = useState<string>(() => getLocalToday());
  const [showPDF, setShowPDF] = useState(false);
  const [filteredPDFData, setFilteredPDFData] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        if (id) {
          loadPatient(id as string);
          loadDailySummary(user.uid, id as string);
        }
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router, id]);

  // İlaç hatırlatmaları için kontrol
  useEffect(() => {
    const checkMedicineReminders = () => {
      const now = new Date();
      const currentHour = now.getHours().toString().padStart(2, '0') + ':00';
      
      dailySummary.medicines.forEach(medicine => {
        if (medicine.hours.includes(currentHour) && !medicine.status[currentHour]) {
          const notification = `${medicine.name} ilacının ${currentHour} dozunu almayı unutmayın!`;
          if (!notifications.includes(notification)) {
            setNotifications(prev => [...prev, notification]);
            setShowNotification(true);
          }
        }
      });
    };

    const interval = setInterval(checkMedicineReminders, 60000); // Her dakika kontrol et
    return () => clearInterval(interval);
  }, [dailySummary.medicines]);

  // Gün değişimini algılayan useEffect
  useEffect(() => {
    const interval = setInterval(() => {
      const today = getLocalToday();
      setStartDate(prev => (prev !== today ? today : prev));
      setEndDate(prev => (prev !== today ? today : prev));
    }, 60000); // Her dakika kontrol et
    return () => clearInterval(interval);
  }, []);

  const loadPatient = async (patientId: string) => {
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

  const loadDailySummary = async (uid: string, patientId: string) => {
    try {
      const today = getLocalToday();
      
      // Vital değerleri yükle
      const vitalsRef = collection(db, 'patients', patientId, 'vitals');
      const vitalsQuery = query(vitalsRef, where('date', '==', today));
      const vitalsSnapshot = await getDocs(vitalsQuery);
      
      if (!vitalsSnapshot.empty) {
        const latestVital = vitalsSnapshot.docs[vitalsSnapshot.docs.length - 1].data();
        setDailySummary(prev => ({
          ...prev,
          vitals: {
            temperature: latestVital.temperature,
            bloodPressure: latestVital.bloodPressure,
            oxygenSaturation: latestVital.oxygenSaturation,
            formulaAmount: latestVital.formulaAmount,
            waterAmount: latestVital.waterAmount,
            time: latestVital.time
          }
        }));
      }

      // Cihaz durumlarını yükle
      const devicesRef = collection(db, 'patients', patientId, 'devices');
      const devicesQuery = query(devicesRef, where('date', '==', today));
      const devicesSnapshot = await getDocs(devicesQuery);
      
      const devices = devicesSnapshot.docs.map(doc => ({
        status: doc.data().status,
        deviceType: doc.data().deviceType,
        time: doc.data().time,
        notes: doc.data().notes
      }));

      // İlaçları yükle
      const medicinesRef = collection(db, 'patients', patientId, 'medicines');
      const medicinesSnapshot = await getDocs(medicinesRef);
      
      const medicines = await Promise.all(medicinesSnapshot.docs.map(async doc => {
        const statusRef = collection(db, 'patients', patientId, 'medicineStatus');
        const statusQuery = query(statusRef, where('date', '==', today));
        const statusSnapshot = await getDocs(statusQuery);
        
        const status: { [hour: string]: boolean } = {};
        statusSnapshot.docs.forEach(statusDoc => {
          if (statusDoc.id.includes(doc.id)) {
            const [, , hour] = statusDoc.id.split('_');
            status[hour] = statusDoc.data().taken;
          }
        });

        return {
          id: doc.id,
          name: doc.data().name,
          hours: doc.data().hours,
          status
        };
      }));

      setDailySummary(prev => ({
        ...prev,
        devices,
        medicines
      }));
    } catch (error) {
      console.error('Günlük özet yüklenirken hata oluştu:', error);
      setError('Günlük özet yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const filteredDates: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      filteredDates.push(new Date(d).toISOString().split('T')[0]);
    }
    // Firestore'dan ilgili günler için verileri çek
    const summaryData = await Promise.all(filteredDates.map(async (date) => {
      // Vitals
      const vitalsRef = collection(db, 'patients', id as string, 'vitals');
      const vitalsQuery = query(vitalsRef, where('date', '==', date));
      const vitalsSnapshot = await getDocs(vitalsQuery);
      const vitals = vitalsSnapshot.docs.map(doc => doc.data());
      // Devices
      const devicesRef = collection(db, 'patients', id as string, 'devices');
      const devicesQuery = query(devicesRef, where('date', '==', date));
      const devicesSnapshot = await getDocs(devicesQuery);
      const devices = devicesSnapshot.docs.map(doc => doc.data());
      // Medicines
      const medicinesRef = collection(db, 'patients', id as string, 'medicines');
      const medicinesSnapshot = await getDocs(medicinesRef);
      const medicines = medicinesSnapshot.docs.map(doc => ({ id: String(doc.id), ...doc.data() }));
      // Medicine status (işaretlemeler)
      const statusRef = collection(db, 'patients', id as string, 'medicineStatus');
      const statusQuery = query(statusRef, where('date', '==', date));
      const statusSnapshot = await getDocs(statusQuery);
      const medicineStatus: { [medicineId: string]: { [hour: string]: boolean } } = {};
      statusSnapshot.docs.forEach(doc => {
        const { medicineId, hour, taken } = doc.data();
        const medId = String(medicineId);
        if (!medicineStatus[medId]) medicineStatus[medId] = {};
        medicineStatus[medId][hour] = taken;
      });
      return {
        date,
        vitals,
        devices,
        medicines,
        medicineStatus
      };
    }));
    console.log('PDF summaryData:', summaryData);
    setShowPDF(true);
    setFilteredPDFData(summaryData);
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
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <div className="h-[calc(80vh-4rem)]">
            <PDFExport
              data={filteredPDFData}
              title={`${patient?.name} - Günlük Özet`}
              type="summary"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Geri Butonu */}
        <div className="mb-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Hasta Yönetimi'ne Dön
          </button>
        </div>
        {/* Üst Bilgi Kartı */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{patient?.name}</h1>
              <p className="text-gray-600 mt-1">Hasta ID: {id}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push(`/patient/${id}/medicine`)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <PillIcon className="h-5 w-5 mr-2" />
                İlaç Takibi
              </button>
              <button
                onClick={() => router.push(`/patient/${id}/vitals`)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <HeartIcon className="h-5 w-5 mr-2" />
                Vital Takibi
              </button>
              <button
                onClick={() => router.push(`/patient/${id}/nutrition`)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                <CakeIcon className="h-5 w-5 mr-2" />
                Cihaz Takibi
              </button>
            </div>
          </div>
        </div>
        {/* Sadece Günlük Özet Kartı */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Günlük Özet</h2>
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
                  <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                  PDF İndir
                </button>
              </div>
            </div>
            {dailySummary.vitals.temperature && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Son Vital Değerler ({dailySummary.vitals.time})</h3>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Sıcaklık: {dailySummary.vitals.temperature}°C</p>
                  {dailySummary.vitals.bloodPressure && (
                    <p className="text-sm text-gray-600">
                      Tansiyon: {dailySummary.vitals.bloodPressure.systolic}/{dailySummary.vitals.bloodPressure.diastolic}
                    </p>
                  )}
                  {dailySummary.vitals.oxygenSaturation && (
                    <p className="text-sm text-gray-600">O2 Sat: %{dailySummary.vitals.oxygenSaturation}</p>
                  )}
                  {dailySummary.vitals.formulaAmount && (
                    <p className="text-sm text-gray-600">Mama: {dailySummary.vitals.formulaAmount}ml</p>
                  )}
                  {dailySummary.vitals.waterAmount && (
                    <p className="text-sm text-gray-600">Su: {dailySummary.vitals.waterAmount}ml</p>
                  )}
                </div>
              </div>
            )}
            {dailySummary.devices.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Son Cihaz Durumları</h3>
                <div className="space-y-2">
                  {dailySummary.devices.map((device, index) => (
                    <div key={index} className="flex flex-col md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          {device.deviceType === 'monitor' ? 'Monitor' :
                            device.deviceType === 'pulse' ? 'Nabız Ölçer' :
                            device.deviceType === 'oxygen' ? 'Oksijen Ölçer' : 'Diğer'}
                        </span>
                        <span className={`text-sm ${
                          device.status === 'normal' ? 'text-green-600' :
                            device.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {device.status === 'normal' ? 'Normal' :
                            device.status === 'warning' ? 'Uyarı' : 'Kritik'}
                        </span>
                      </div>
                      {device.notes && (
                        <span className="text-xs text-gray-500 italic mt-1 md:mt-0 md:ml-4">Açıklama: {device.notes}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {dailySummary.medicines.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Günlük İlaçlar</h3>
                <div className="space-y-2">
                  {dailySummary.medicines.map((medicine, index) => (
                    <div key={index}>
                      <p className="text-sm text-gray-600">{medicine.name}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {medicine.hours.map(hour => (
                          <span
                            key={hour}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                              medicine.status[hour]
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {hour}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Bildirimler */}
      {showNotification && notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50">
          {notifications.map((notification, index) => (
            <div key={index} className="bg-white rounded-lg shadow-lg p-4 mb-2 flex items-center">
              <Bell className="w-5 h-5 text-primary-500 mr-2" />
              <span>{notification}</span>
              <button
                onClick={() => {
                  setNotifications(prev => prev.filter((_, i) => i !== index));
                  if (notifications.length === 1) setShowNotification(false);
                }}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 