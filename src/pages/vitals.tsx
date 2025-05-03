import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { Inter } from 'next/font/google';
import html2pdf from 'html2pdf.js';

const inter = Inter({ subsets: ['latin'] });

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
  const [records, setRecords] = useState<VitalRecord[]>([]);
  const [newRecord, setNewRecord] = useState<Omit<VitalRecord, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    temperature: 0,
    bloodPressure: {
      systolic: 0,
      diastolic: 0,
    },
    oxygenSaturation: 0,
    formulaAmount: 0,
    waterAmount: 0,
    notes: '',
  });

  const pdfRef = useRef<HTMLDivElement>(null);

  // localStorage'dan kayıtları yükle
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vitalRecords');
      if (saved) {
        try {
          setRecords(JSON.parse(saved));
        } catch (e) {
          console.error('Records parse error:', e);
        }
      }
    }
  }, []);

  // localStorage'a kayıtları kaydet
  useEffect(() => {
    localStorage.setItem('vitalRecords', JSON.stringify(records));
  }, [records]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('bloodPressure.')) {
      const field = name.split('.')[1];
      setNewRecord(prev => ({
        ...prev,
        bloodPressure: {
          ...prev.bloodPressure,
          [field]: Number(value),
        },
      }));
    } else {
      setNewRecord(prev => ({
        ...prev,
        [name]: name === 'notes' ? value : Number(value),
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const record: VitalRecord = {
      ...newRecord,
      id: Date.now().toString(),
    };
    setRecords([...records, record]);
    setNewRecord({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      temperature: 0,
      bloodPressure: {
        systolic: 0,
        diastolic: 0,
      },
      oxygenSaturation: 0,
      formulaAmount: 0,
      waterAmount: 0,
      notes: '',
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Bu kaydı silmek istediğinizden emin misiniz?')) {
      setRecords(records.filter(record => record.id !== id));
    }
  };

  const handleDownloadPDF = () => {
    if (!pdfRef.current) return;

    const element = pdfRef.current;
    const opt = {
      margin: 1,
      filename: `vital-degerler-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <>
      <Head>
        <title>Vital Değerler - MamaMaria</title>
        <meta name="description" content="Vital değerler ve beslenme takibi" />
      </Head>
      <main className={`min-h-screen p-4 ${inter.className}`}>
        <div className="container mx-auto max-w-6xl">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-primary-600">
              Vital Değerler ve Beslenme Takibi
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
                Vital Değerler ve Beslenme Raporu
              </h1>
              <div className="text-sm text-gray-500 text-center mb-8">
                {new Date().toLocaleDateString('tr-TR')} - {new Date().toLocaleTimeString('tr-TR')}
              </div>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">Tarih/Saat</th>
                    <th className="border p-2 text-left">Sıcaklık</th>
                    <th className="border p-2 text-left">Tansiyon</th>
                    <th className="border p-2 text-left">O2 Sat</th>
                    <th className="border p-2 text-left">Mama</th>
                    <th className="border p-2 text-left">Su</th>
                    <th className="border p-2 text-left">Notlar</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => (
                    <tr key={record.id}>
                      <td className="border p-2">
                        {new Date(record.date).toLocaleDateString('tr-TR')}
                        <br />
                        <span className="text-sm text-gray-500">{record.time}</span>
                      </td>
                      <td className="border p-2">{record.temperature}°C</td>
                      <td className="border p-2">
                        {record.bloodPressure.systolic}/{record.bloodPressure.diastolic}
                      </td>
                      <td className="border p-2">%{record.oxygenSaturation}</td>
                      <td className="border p-2">{record.formulaAmount} ml</td>
                      <td className="border p-2">{record.waterAmount} ml</td>
                      <td className="border p-2">{record.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Kayıt Formu */}
          <form onSubmit={handleSubmit} className="mb-8 bg-white rounded-lg shadow-md p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                  Tarih
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={newRecord.date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                  Saat
                </label>
                <input
                  type="time"
                  id="time"
                  name="time"
                  value={newRecord.time}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-1">
                  Vücut Sıcaklığı (°C)
                </label>
                <input
                  type="number"
                  id="temperature"
                  name="temperature"
                  value={newRecord.temperature}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  step="0.1"
                  min="30"
                  max="45"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tansiyon
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="bloodPressure.systolic"
                    value={newRecord.bloodPressure.systolic}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Sistolik"
                    min="50"
                    max="250"
                    required
                  />
                  <span className="flex items-center text-gray-500">/</span>
                  <input
                    type="number"
                    name="bloodPressure.diastolic"
                    value={newRecord.bloodPressure.diastolic}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Diyastolik"
                    min="30"
                    max="150"
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="oxygenSaturation" className="block text-sm font-medium text-gray-700 mb-1">
                  Oksijen Saturasyonu (%)
                </label>
                <input
                  type="number"
                  id="oxygenSaturation"
                  name="oxygenSaturation"
                  value={newRecord.oxygenSaturation}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  min="0"
                  max="100"
                  required
                />
              </div>
              <div>
                <label htmlFor="formulaAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Mama Miktarı (ml)
                </label>
                <input
                  type="number"
                  id="formulaAmount"
                  name="formulaAmount"
                  value={newRecord.formulaAmount}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  min="0"
                  required
                />
              </div>
              <div>
                <label htmlFor="waterAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Su Miktarı (ml)
                </label>
                <input
                  type="number"
                  id="waterAmount"
                  name="waterAmount"
                  value={newRecord.waterAmount}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  min="0"
                  required
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notlar
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={newRecord.notes}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              >
                Kaydet
              </button>
            </div>
          </form>

          {/* Kayıt Tablosu */}
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Tarih/Saat
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                        Sıcaklık
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                        Tansiyon
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                        O2 Sat
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                        Mama
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                        Su
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Notlar
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                        İşlem
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                          {new Date(record.date).toLocaleDateString('tr-TR')}
                          <br />
                          <span className="text-gray-500">{record.time}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-gray-900">
                          {record.temperature}°C
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-gray-900">
                          {record.bloodPressure.systolic}/{record.bloodPressure.diastolic}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-gray-900">
                          %{record.oxygenSaturation}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-gray-900">
                          {record.formulaAmount} ml
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-gray-900">
                          {record.waterAmount} ml
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-900">
                          {record.notes}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="text-red-600 hover:text-red-900"
                            aria-label="Kaydı sil"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
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
    </>
  );
} 