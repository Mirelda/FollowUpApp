import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import Link from 'next/link';
import { ArrowLeft, Pill, Activity, Monitor, Bell, X } from 'lucide-react';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        if (id) {
          loadPatient(user.uid, id as string);
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

  const loadDailySummary = async (uid: string, patientId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Vital değerleri yükle
      const vitalsRef = collection(db, 'users', uid, 'patients', patientId, 'vitals');
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
      const devicesRef = collection(db, 'users', uid, 'patients', patientId, 'devices');
      const devicesQuery = query(devicesRef, where('date', '==', today));
      const devicesSnapshot = await getDocs(devicesQuery);
      
      const devices = devicesSnapshot.docs.map(doc => ({
        status: doc.data().status,
        deviceType: doc.data().deviceType,
        time: doc.data().time,
        notes: doc.data().notes
      }));

      // İlaçları yükle
      const medicinesRef = collection(db, 'users', uid, 'patients', patientId, 'medicines');
      const medicinesSnapshot = await getDocs(medicinesRef);
      
      const medicines = await Promise.all(medicinesSnapshot.docs.map(async doc => {
        const statusRef = collection(db, 'users', uid, 'patients', patientId, 'medicineStatus');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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

      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-gray-700 hover:text-gray-900 mr-4">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">{patient?.name}</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Günlük Özet Kartı */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Günlük Özet</h2>
            
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
                    <div key={index} className="flex items-center justify-between">
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

          {/* Hızlı Erişim Kartları */}
          <div className="space-y-4">
            <Link
              href={`/patient/${id}/vitals`}
              className="block bg-white rounded-2xl shadow-sm p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <Activity className="w-6 h-6 text-primary-500 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">Vital Değerler</h2>
              </div>
            </Link>

            <Link
              href={`/patient/${id}/medicine`}
              className="block bg-white rounded-2xl shadow-sm p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <Pill className="w-6 h-6 text-primary-500 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">İlaç Takibi</h2>
              </div>
            </Link>

            <Link
              href={`/patient/${id}/nutrition`}
              className="block bg-white rounded-2xl shadow-sm p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <Monitor className="w-6 h-6 text-primary-500 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">Cihaz Takibi</h2>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
} 