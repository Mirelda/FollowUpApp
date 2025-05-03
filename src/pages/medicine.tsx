import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { Inter } from 'next/font/google';
import html2pdf from 'html2pdf.js';

const inter = Inter({ subsets: ['latin'] });

interface Medication {
  id: string;
  name: string;
  dosage: number;
  times: string[];
}

interface MedicationStatus {
  [date: string]: {
    [medicationId: string]: {
      [time: string]: boolean;
    };
  };
}

// Saat seçenekleri
const timeOptions = [
  '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'
];

// localStorage'dan ilaçları yükle
const loadMedications = (): Medication[] => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('medications');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((med: any) => ({
          ...med,
          times: med.times || [med.time || '08:00'],
          dosage: typeof med.dosage === 'string' ? parseInt(med.dosage.replace(/[^0-9]/g, '')) || 0 : med.dosage || 0
        }));
      } catch (e) {
        console.error('Medications parse error:', e);
      }
    }
    return [
      { id: '1', name: 'Ranto', dosage: 500, times: ['08:00', '20:00'] },
      { id: '2', name: 'Belok', dosage: 50, times: ['08:00'] },
      { id: '3', name: 'Cipralex', dosage: 10, times: ['20:00'] },
      { id: '4', name: 'Vitamin D', dosage: 1000, times: ['12:00'] },
      { id: '5', name: 'Magnezyum', dosage: 400, times: ['20:00'] },
    ];
  }
  return [];
};

// Son 7 günü oluştur
const getLastSevenDays = () => {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date.toISOString().split('T')[0]);
  }
  return days.reverse();
};

export default function MedicinePage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [status, setStatus] = useState<MedicationStatus>({});
  const [dates] = useState<string[]>(getLastSevenDays());
  const [newMedication, setNewMedication] = useState<Omit<Medication, 'id'>>({
    name: '',
    dosage: 0,
    times: [],
  });
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const pdfRef = useRef<HTMLDivElement>(null);

  // localStorage'dan ilaçları yükle
  useEffect(() => {
    setMedications(loadMedications());
  }, []);

  // localStorage'dan durumları yükle
  useEffect(() => {
    const savedStatus = localStorage.getItem('medicationStatus');
    if (savedStatus) {
      setStatus(JSON.parse(savedStatus));
    }
  }, []);

  // localStorage'a durumları kaydet
  useEffect(() => {
    localStorage.setItem('medicationStatus', JSON.stringify(status));
  }, [status]);

  // localStorage'a ilaçları kaydet
  useEffect(() => {
    localStorage.setItem('medications', JSON.stringify(medications));
  }, [medications]);

  const toggleStatus = (date: string, medicationId: string, time: string) => {
    setStatus(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [medicationId]: {
          ...prev[date]?.[medicationId],
          [time]: !prev[date]?.[medicationId]?.[time],
        },
      },
    }));
  };

  const getStatus = (date: string, medicationId: string, time: string) => {
    return status[date]?.[medicationId]?.[time] || false;
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTimes(prev => {
      if (prev.includes(time)) {
        return prev.filter(t => t !== time);
      }
      return [...prev, time].sort();
    });
  };

  const handleAddMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedication.name.trim() || selectedTimes.length === 0) return;

    const medication: Medication = {
      ...newMedication,
      times: selectedTimes,
      id: Date.now().toString(),
    };

    setMedications([...medications, medication]);
    setNewMedication({ name: '', dosage: 0, times: [] });
    setSelectedTimes([]);
  };

  const handleEditMedication = (medication: Medication) => {
    setEditingMedication(medication);
    setSelectedTimes(medication.times);
    setIsModalOpen(true);
  };

  const handleUpdateMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMedication || !editingMedication.name.trim() || selectedTimes.length === 0) return;

    const updatedMedication: Medication = {
      ...editingMedication,
      times: selectedTimes,
    };

    setMedications(medications.map(med => 
      med.id === updatedMedication.id ? updatedMedication : med
    ));
    setIsModalOpen(false);
    setEditingMedication(null);
    setSelectedTimes([]);
  };

  const handleDeleteMedication = (medicationId: string) => {
    if (window.confirm('Bu ilacı silmek istediğinizden emin misiniz?')) {
      setMedications(medications.filter(med => med.id !== medicationId));
      setIsModalOpen(false);
      setEditingMedication(null);
    }
  };

  const handleDownloadPDF = () => {
    if (!pdfRef.current) return;

    const element = pdfRef.current;
    const opt = {
      margin: 1,
      filename: `ilac-takibi-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <>
      <Head>
        <title>İlaç Takibi - MamaMaria</title>
        <meta name="description" content="İlaç takip ve hatırlatma sistemi" />
      </Head>
      <main className={`min-h-screen p-4 ${inter.className}`}>
        <div className="container mx-auto max-w-6xl">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-primary-600">
              İlaç Takibi
            </h1>
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
              PDF Raporu İndir
            </button>
          </div>

          {/* PDF için gizli div */}
          <div ref={pdfRef} className="hidden">
            <div className="p-8">
              <h1 className="text-2xl font-bold text-center mb-6">
                İlaç Takip Raporu
              </h1>
              <div className="text-sm text-gray-500 text-center mb-8">
                {new Date().toLocaleDateString('tr-TR')} - {new Date().toLocaleTimeString('tr-TR')}
              </div>

              {/* İlaç Listesi */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">İlaç Listesi</h2>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">İlaç Adı</th>
                      <th className="border p-2 text-left">Doz</th>
                      <th className="border p-2 text-left">Saatler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medications.map(med => (
                      <tr key={med.id}>
                        <td className="border p-2">{med.name}</td>
                        <td className="border p-2">{med.dosage} mg</td>
                        <td className="border p-2">{med.times.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* İlaç Durumları */}
              <div>
                <h2 className="text-xl font-semibold mb-4">İlaç Durumları</h2>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Tarih</th>
                      <th className="border p-2 text-left">İlaç</th>
                      <th className="border p-2 text-left">Saat</th>
                      <th className="border p-2 text-left">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(status).map(([date, medStatus]) => (
                      Object.entries(medStatus).map(([medId, timeStatus]) => {
                        const med = medications.find(m => m.id === medId);
                        return Object.entries(timeStatus).map(([time, taken]) => (
                          <tr key={`${date}-${medId}-${time}`}>
                            <td className="border p-2">{new Date(date).toLocaleDateString('tr-TR')}</td>
                            <td className="border p-2">{med?.name || '-'}</td>
                            <td className="border p-2">{time}</td>
                            <td className="border p-2">{taken ? 'Alındı' : 'Alınmadı'}</td>
                          </tr>
                        ));
                      })
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Yeni İlaç Ekleme Formu */}
          <form onSubmit={handleAddMedication} className="mb-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Yeni İlaç Ekle
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  İlaç Adı
                </label>
                <input
                  type="text"
                  id="name"
                  value={newMedication.name}
                  onChange={(e) => setNewMedication({ ...newMedication, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="dosage" className="block text-sm font-medium text-gray-700 mb-1">
                  Doz (mg)
                </label>
                <input
                  type="number"
                  id="dosage"
                  value={newMedication.dosage}
                  onChange={(e) => setNewMedication({ ...newMedication, dosage: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alınma Saatleri
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {timeOptions.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => handleTimeSelect(time)}
                      className={`px-2 py-1 text-sm rounded-md transition-colors ${
                        selectedTimes.includes(time)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                disabled={selectedTimes.length === 0}
              >
                İlacı Kaydet
              </button>
            </div>
          </form>

          {/* İlaç Takip Tablosu */}
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                      >
                        Tarih
                      </th>
                      {medications.map((med) => (
                        <th
                          key={med.id}
                          scope="col"
                          className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900"
                        >
                          <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2">
                              <span>{med.name}</span>
                              <button
                                onClick={() => handleEditMedication(med)}
                                className="text-gray-400 hover:text-primary-600 transition-colors"
                                aria-label={`${med.name} ilacını düzenle`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                              </button>
                            </div>
                            <span className="text-xs text-gray-500">{med.dosage} mg</span>
                            <div className="flex flex-wrap justify-center gap-1 mt-1">
                              {med.times.map((time) => (
                                <span key={time} className="text-xs text-gray-400">
                                  {time}
                                </span>
                              ))}
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {dates.map((date) => (
                      <tr key={date} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {new Date(date).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'long',
                          })}
                        </td>
                        {medications.map((med) => (
                          <td
                            key={`${date}-${med.id}`}
                            className="whitespace-nowrap px-3 py-4 text-center"
                          >
                            <div className="flex flex-wrap justify-center gap-2">
                              {med.times.map((time) => (
                                <button
                                  key={`${date}-${med.id}-${time}`}
                                  onClick={() => toggleStatus(date, med.id, time)}
                                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                                    getStatus(date, med.id, time)
                                      ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                  }`}
                                  aria-label={`${med.name} ilacı ${time} saatinde ${getStatus(date, med.id, time) ? 'alındı' : 'alınmadı'}`}
                                >
                                  {getStatus(date, med.id, time) ? '✓' : '○'}
                                </button>
                              ))}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Düzenleme Modalı */}
          {isModalOpen && editingMedication && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  İlacı Düzenle
                </h2>
                <form onSubmit={handleUpdateMedication}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                        İlaç Adı
                      </label>
                      <input
                        type="text"
                        id="edit-name"
                        value={editingMedication.name}
                        onChange={(e) => setEditingMedication({ ...editingMedication, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-dosage" className="block text-sm font-medium text-gray-700 mb-1">
                        Doz (mg)
                      </label>
                      <input
                        type="number"
                        id="edit-dosage"
                        value={editingMedication.dosage}
                        onChange={(e) => setEditingMedication({ ...editingMedication, dosage: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        min="0"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Alınma Saatleri
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {timeOptions.map((time) => (
                          <button
                            key={time}
                            type="button"
                            onClick={() => handleTimeSelect(time)}
                            className={`px-2 py-1 text-sm rounded-md transition-colors ${
                              selectedTimes.includes(time)
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-between">
                    <button
                      type="button"
                      onClick={() => handleDeleteMedication(editingMedication.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                    >
                      Sil
                    </button>
                    <div className="space-x-4">
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          setEditingMedication(null);
                          setSelectedTimes([]);
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                      >
                        İptal
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                        disabled={selectedTimes.length === 0}
                      >
                        Kaydet
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-center space-x-4">
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-2">✓</div>
              <span className="text-sm text-gray-600">Alındı</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mr-2">○</div>
              <span className="text-sm text-gray-600">Alınmadı</span>
            </div>
          </div>
        </div>
      </main>
    </>
  );
} 