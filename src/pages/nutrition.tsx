import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { Inter } from 'next/font/google';
import html2pdf from 'html2pdf.js';

const inter = Inter({ subsets: ['latin'] });

interface CustomField {
  id: string;
  label: string;
}

interface CareRecord {
  id: string;
  date: string;
  notes: {
    [fieldId: string]: string;
  };
}

export default function NutritionPage() {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [records, setRecords] = useState<CareRecord[]>([]);
  const [currentRecord, setCurrentRecord] = useState<Omit<CareRecord, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    notes: {},
  });

  const pdfRef = useRef<HTMLDivElement>(null);

  // localStorage'dan özel alanları yükle
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedFields = localStorage.getItem('customFields');
      if (savedFields) {
        try {
          setCustomFields(JSON.parse(savedFields));
        } catch (e) {
          console.error('Fields parse error:', e);
        }
      }
    }
  }, []);

  // localStorage'dan kayıtları yükle
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRecords = localStorage.getItem('careRecords');
      if (savedRecords) {
        try {
          setRecords(JSON.parse(savedRecords));
        } catch (e) {
          console.error('Records parse error:', e);
        }
      }
    }
  }, []);

  // localStorage'a özel alanları kaydet
  useEffect(() => {
    localStorage.setItem('customFields', JSON.stringify(customFields));
  }, [customFields]);

  // localStorage'a kayıtları kaydet
  useEffect(() => {
    localStorage.setItem('careRecords', JSON.stringify(records));
  }, [records]);

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim()) return;

    const field: CustomField = {
      id: Date.now().toString(),
      label: newFieldLabel.trim(),
    };

    setCustomFields([...customFields, field]);
    setNewFieldLabel('');
  };

  const handleDeleteField = (fieldId: string) => {
    if (window.confirm('Bu alanı silmek istediğinizden emin misiniz? Tüm ilgili kayıtlar da silinecektir.')) {
      setCustomFields(customFields.filter(field => field.id !== fieldId));
      setRecords(records.map(record => ({
        ...record,
        notes: Object.fromEntries(
          Object.entries(record.notes).filter(([id]) => id !== fieldId)
        ),
      })));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const record: CareRecord = {
      ...currentRecord,
      id: Date.now().toString(),
    };
    setRecords([...records, record]);
    setCurrentRecord({
      date: new Date().toISOString().split('T')[0],
      notes: {},
    });
  };

  const handleDeleteRecord = (recordId: string) => {
    if (window.confirm('Bu kaydı silmek istediğinizden emin misiniz?')) {
      setRecords(records.filter(record => record.id !== recordId));
    }
  };

  const handleDownloadPDF = () => {
    if (!pdfRef.current) return;

    const element = pdfRef.current;
    const opt = {
      margin: 1,
      filename: `bakim-takibi-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <>
      <Head>
        <title>Bakım Takibi - MamaMaria</title>
        <meta name="description" content="Özelleştirilebilir bakım takip sistemi" />
      </Head>
      <main className={`min-h-screen p-4 ${inter.className}`}>
        <div className="container mx-auto max-w-6xl">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-primary-600">
              Bakım Takip Tablosu
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
                Bakım Takip Raporu
              </h1>
              <div className="text-sm text-gray-500 text-center mb-8">
                {new Date().toLocaleDateString('tr-TR')} - {new Date().toLocaleTimeString('tr-TR')}
              </div>

              {/* Özel Alanlar */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Özel Alanlar</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {customFields.map(field => (
                    <div key={field.id} className="border p-4 rounded-lg">
                      <span className="font-medium">{field.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bakım Kayıtları */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Bakım Kayıtları</h2>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Tarih</th>
                      {customFields.map(field => (
                        <th key={field.id} className="border p-2 text-left">
                          {field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(record => (
                      <tr key={record.id}>
                        <td className="border p-2">
                          {new Date(record.date).toLocaleDateString('tr-TR')}
                        </td>
                        {customFields.map(field => (
                          <td key={`${record.id}-${field.id}`} className="border p-2">
                            {record.notes[field.id] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Özel Alan Ekleme Formu */}
          <form onSubmit={handleAddField} className="mb-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Özel Alan Ekle
            </h2>
            <div className="flex gap-4">
              <div className="flex-1">
                <label htmlFor="fieldLabel" className="block text-sm font-medium text-gray-700 mb-1">
                  Alan Adı
                </label>
                <input
                  type="text"
                  id="fieldLabel"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="örn: Sonda Değişimi"
                  required
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                >
                  Alan Ekle
                </button>
              </div>
            </div>
          </form>

          {/* Mevcut Alanlar */}
          {customFields.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Mevcut Alanlar
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {customFields.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm"
                  >
                    <span className="text-gray-700">{field.label}</span>
                    <button
                      onClick={() => handleDeleteField(field.id)}
                      className="text-red-600 hover:text-red-900"
                      aria-label={`${field.label} alanını sil`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kayıt Formu */}
          {customFields.length > 0 && (
            <form onSubmit={handleSubmit} className="mb-8 bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Günlük Kayıt
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                    Tarih
                  </label>
                  <input
                    type="date"
                    id="date"
                    value={currentRecord.date}
                    onChange={(e) => setCurrentRecord({ ...currentRecord, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                {customFields.map((field) => (
                  <div key={field.id}>
                    <label htmlFor={`note-${field.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                    </label>
                    <input
                      type="text"
                      id={`note-${field.id}`}
                      value={currentRecord.notes[field.id] || ''}
                      onChange={(e) => setCurrentRecord({
                        ...currentRecord,
                        notes: { ...currentRecord.notes, [field.id]: e.target.value },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Not giriniz"
                    />
                  </div>
                ))}
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
          )}

          {/* Kayıt Tablosu */}
          {records.length > 0 && (
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Tarih
                        </th>
                        {customFields.map((field) => (
                          <th
                            key={field.id}
                            scope="col"
                            className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                          >
                            {field.label}
                          </th>
                        ))}
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
                          </td>
                          {customFields.map((field) => (
                            <td key={`${record.id}-${field.id}`} className="px-3 py-4 text-sm text-gray-900">
                              {record.notes[field.id] || '-'}
                            </td>
                          ))}
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                            <button
                              onClick={() => handleDeleteRecord(record.id)}
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
          )}
        </div>
      </main>
    </>
  );
} 