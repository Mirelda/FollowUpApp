import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';

interface Patient {
  id: string;
  name: string;
  surname: string;
  ownerId: string;
  sharedWith: string[];
  [key: string]: any;
}

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchPatients = async () => {
      if (!user) return;

      try {
        const patientsRef = collection(db, 'patients');
        const q = query(
          patientsRef,
          where('owner', '==', user.email)
        );

        const sharedPatientsQuery = query(
          patientsRef,
          where('sharedWith', 'array-contains', user.email)
        );

        const [ownedSnapshot, sharedSnapshot] = await Promise.all([
          getDocs(q),
          getDocs(sharedPatientsQuery)
        ]);

        const ownedPatients = ownedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Patient[];

        const sharedPatients = sharedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Patient[];

        // Tekrar eden hastaları filtrele
        const allPatients = [...ownedPatients];
        sharedPatients.forEach(sharedPatient => {
          if (!allPatients.find(p => p.id === sharedPatient.id)) {
            allPatients.push(sharedPatient);
          }
        });

        setPatients(allPatients);
      } catch (error) {
        console.error('Hasta listesi yüklenirken hata:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, [user]);

  return { patients, loading };
} 