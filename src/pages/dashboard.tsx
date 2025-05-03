import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import Link from 'next/link';
import { Plus, LogOut, User } from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  owner: string;
  sharedWith: string[];
  createdAt: Date;
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [newPatientName, setNewPatientName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        loadPatients(user.uid, user.email);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadPatients = async (uid: string, userEmail: string | null) => {
    if (!userEmail) return;

    try {
      // Kullanıcının sahip olduğu hastaları yükle
      const patientsRef = collection(db, 'users', uid, 'patients');
      const ownedQ = query(
        patientsRef,
        where('owner', '==', userEmail)
      );
      const ownedSnapshot = await getDocs(ownedQ);
      
      const ownedList = ownedSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        owner: doc.data().owner || userEmail,
        sharedWith: Array.isArray(doc.data().sharedWith) ? doc.data().sharedWith : [],
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Patient[];

      // Paylaşılan hastaları yükle
      const sharedQ = query(
        patientsRef,
        where('sharedWith', 'array-contains', userEmail)
      );
      const sharedSnapshot = await getDocs(sharedQ);
      
      const sharedList = sharedSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        owner: doc.data().owner || '',
        sharedWith: Array.isArray(doc.data().sharedWith) ? doc.data().sharedWith : [],
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Patient[];

      setPatients([...ownedList, ...sharedList]);
    } catch (error) {
      console.error('Hastalar yüklenirken hata oluştu:', error);
      setError('Hastalar yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim() || !user?.email) {
      setError('Hasta adı boş olamaz');
      return;
    }

    try {
      const patientsRef = collection(db, 'users', user.uid, 'patients');
      const docRef = await addDoc(patientsRef, {
        name: newPatientName.trim(),
        owner: user.email,
        sharedWith: [],
        createdAt: Timestamp.now()
      });

      setPatients([...patients, {
        id: docRef.id,
        name: newPatientName.trim(),
        owner: user.email,
        sharedWith: [],
        createdAt: new Date()
      }]);

      setNewPatientName('');
      setError('');
    } catch (error) {
      console.error('Hasta eklenirken hata oluştu:', error);
      setError('Hasta eklenirken bir hata oluştu');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Çıkış yapılırken hata oluştu:', error);
    }
  };

  if (loading) {
    return <div>Yükleniyor...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">MamaMaria</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700 flex items-center">
                <User className="w-5 h-5 mr-2" />
                {user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-50 text-red-600 px-4 py-2 rounded-xl hover:bg-red-100 transition-colors flex items-center"
              >
                <LogOut className="w-5 h-5 mr-2" />
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Hasta Yönetimi</h2>
          
          <form onSubmit={handleAddPatient} className="mb-8">
            <div className="flex gap-4">
              <input
                type="text"
                value={newPatientName}
                onChange={(e) => setNewPatientName(e.target.value)}
                placeholder="Hasta adı"
                className="flex-1 rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
              <button
                type="submit"
                className="bg-primary-50 text-primary-600 px-6 py-2 rounded-xl hover:bg-primary-100 transition-colors flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Hasta Ekle
              </button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </form>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Hastalarım</h3>
            {patients.length === 0 ? (
              <p className="text-gray-500">Henüz hasta eklenmemiş</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {patients.map((patient) => (
                  <Link
                    key={patient.id}
                    href={`/patient/${patient.id}`}
                    className="block p-6 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors hover:shadow-md"
                  >
                    <h4 className="text-lg font-medium text-gray-900">
                      {patient.name}
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {patient.owner === user?.email ? 'Sahibi: Siz' : `Sahibi: ${patient.owner}`}
                    </p>
                    {patient.sharedWith.length > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        {patient.sharedWith.length} kişiyle paylaşıldı
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 