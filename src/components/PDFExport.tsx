import { Document, Page, Text, View, StyleSheet, PDFViewer, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

// Roboto fontunu ekleyelim
Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf',
      fontWeight: 'bold',
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Roboto',
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  date: {
    fontSize: 12,
    color: '#666',
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    borderBottomStyle: 'solid',
    paddingVertical: 5,
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
  },
  tableCell: {
    flex: 1,
    padding: 5,
    fontSize: 10,
  },
  status: {
    width: 60,
    textAlign: 'center',
  },
  statusNormal: {
    color: '#22c55e',
  },
  statusWarning: {
    color: '#eab308',
  },
  statusCritical: {
    color: '#ef4444',
  },
});

interface PDFExportProps {
  data: any[];
  title: string;
  type: 'medicine' | 'device' | 'vitals' | 'summary';
}

export function PDFExport({ data, title, type }: PDFExportProps) {
  return (
    <PDFViewer style={{ width: '100%', height: '100vh' }}>
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.date}>
              {format(new Date(), 'dd MMMM yyyy HH:mm', { locale: tr })}
            </Text>
          </View>

          {type === 'summary' ? (
            data.map((day, i) => (
              <View key={day.date + i} style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 6 }}>{day.date}</Text>
                {/* Vital Tablosu */}
                {day.vitals && day.vitals.length > 0 && (
                  <>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 2 }}>Vital Değerler</Text>
                    <View style={styles.table}>
                      <View style={[styles.tableRow, styles.tableHeader]}>
                        <Text style={styles.tableCell}>Saat</Text>
                        <Text style={styles.tableCell}>Sıcaklık</Text>
                        <Text style={styles.tableCell}>Tansiyon</Text>
                        <Text style={styles.tableCell}>O2 Sat</Text>
                        <Text style={styles.tableCell}>Mama</Text>
                        <Text style={styles.tableCell}>Su</Text>
                        <Text style={styles.tableCell}>Notlar</Text>
                      </View>
                      {day.vitals.map((record: any, idx: number) => (
                        <View key={idx} style={styles.tableRow}>
                          <Text style={styles.tableCell}>{record.time}</Text>
                          <Text style={styles.tableCell}>{record.temperature}°C</Text>
                          <Text style={styles.tableCell}>{record.bloodPressure?.systolic}/{record.bloodPressure?.diastolic}</Text>
                          <Text style={styles.tableCell}>%{record.oxygenSaturation}</Text>
                          <Text style={styles.tableCell}>{record.formulaAmount} ml</Text>
                          <Text style={styles.tableCell}>{record.waterAmount} ml</Text>
                          <Text style={styles.tableCell}>{record.notes}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
                {/* Cihaz Tablosu */}
                {day.devices && day.devices.length > 0 && (
                  <>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', marginTop: 8, marginBottom: 2 }}>Cihaz Kayıtları</Text>
                    <View style={styles.table}>
                      <View style={[styles.tableRow, styles.tableHeader]}>
                        <Text style={styles.tableCell}>Saat</Text>
                        <Text style={styles.tableCell}>Cihaz</Text>
                        <Text style={styles.tableCell}>Durum</Text>
                        <Text style={styles.tableCell}>Notlar</Text>
                      </View>
                      {day.devices.map((record: any, idx: number) => (
                        <View key={idx} style={styles.tableRow}>
                          <Text style={styles.tableCell}>{record.time}</Text>
                          <Text style={styles.tableCell}>
                            {record.deviceType === 'monitor' ? 'Monitor' : 
                             record.deviceType === 'pulse' ? 'Nabız Ölçer' : 
                             record.deviceType === 'oxygen' ? 'Oksijen Ölçer' : 'Diğer'}
                          </Text>
                          <Text style={[styles.tableCell, styles.status, 
                            record.status === 'normal' ? styles.statusNormal :
                            record.status === 'warning' ? styles.statusWarning :
                            styles.statusCritical
                          ]}>
                            {record.status === 'normal' ? 'Normal' : 
                             record.status === 'warning' ? 'Uyarı' : 'Kritik'}
                          </Text>
                          <Text style={styles.tableCell}>{record.notes}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
                {/* İlaç Tablosu */}
                {day.medicines && day.medicines.length > 0 && (
                  <>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', marginTop: 8, marginBottom: 2 }}>İlaç Takibi</Text>
                    <View style={styles.table}>
                      <View style={[styles.tableRow, styles.tableHeader]}>
                        <Text style={styles.tableCell}>İlaç</Text>
                        <Text style={styles.tableCell}>Saat</Text>
                        <Text style={styles.tableCell}>Durum</Text>
                      </View>
                      {day.medicines.map((medicine: any, idx: number) => (
                        medicine.hours.map((hour: string, hidx: number) => (
                          <View key={medicine.name + hour + hidx} style={styles.tableRow}>
                            <Text style={styles.tableCell}>{medicine.name}</Text>
                            <Text style={styles.tableCell}>{hour}</Text>
                            <Text style={[styles.tableCell, styles.status, (day.medicineStatus[medicine.id]?.[hour]) ? styles.statusNormal : styles.statusCritical]}>
                              {(day.medicineStatus[medicine.id]?.[hour]) ? 'Alındı' : 'Alınmadı'}
                            </Text>
                          </View>
                        ))
                      ))}
                    </View>
                  </>
                )}
              </View>
            ))
          ) : (
            <View style={styles.table}>
              {type === 'medicine' && (
                <>
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={styles.tableCell}>Tarih</Text>
                    <Text style={styles.tableCell}>İlaç</Text>
                    <Text style={styles.tableCell}>Saat</Text>
                    <Text style={styles.tableCell}>Durum</Text>
                  </View>
                  {data.map((record) => (
                    <View key={record.id} style={styles.tableRow}>
                      <Text style={styles.tableCell}>{record.date}</Text>
                      <Text style={styles.tableCell}>{record.medicineName}</Text>
                      <Text style={styles.tableCell}>{record.hour}</Text>
                      <Text style={[styles.tableCell, styles.status, record.taken ? styles.statusNormal : styles.statusCritical]}>
                        {record.taken ? 'Alındı' : 'Alınmadı'}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              {type === 'device' && (
                <>
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={styles.tableCell}>Tarih/Saat</Text>
                    <Text style={styles.tableCell}>Cihaz</Text>
                    <Text style={styles.tableCell}>Durum</Text>
                    <Text style={styles.tableCell}>Notlar</Text>
                  </View>
                  {data.map((record) => (
                    <View key={record.id} style={styles.tableRow}>
                      <Text style={styles.tableCell}>{record.date} {record.time}</Text>
                      <Text style={styles.tableCell}>
                        {record.deviceType === 'monitor' ? 'Monitor' : 
                         record.deviceType === 'pulse' ? 'Nabız Ölçer' : 
                         record.deviceType === 'oxygen' ? 'Oksijen Ölçer' : 'Diğer'}
                      </Text>
                      <Text style={[styles.tableCell, styles.status, 
                        record.status === 'normal' ? styles.statusNormal :
                        record.status === 'warning' ? styles.statusWarning :
                        styles.statusCritical
                      ]}>
                        {record.status === 'normal' ? 'Normal' : 
                         record.status === 'warning' ? 'Uyarı' : 'Kritik'}
                      </Text>
                      <Text style={styles.tableCell}>{record.notes}</Text>
                    </View>
                  ))}
                </>
              )}

              {type === 'vitals' && (
                <>
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={styles.tableCell}>Tarih/Saat</Text>
                    <Text style={styles.tableCell}>Sıcaklık</Text>
                    <Text style={styles.tableCell}>Tansiyon</Text>
                    <Text style={styles.tableCell}>O2 Sat</Text>
                    <Text style={styles.tableCell}>Mama</Text>
                    <Text style={styles.tableCell}>Su</Text>
                    <Text style={styles.tableCell}>Notlar</Text>
                  </View>
                  {data.map((record) => (
                    <View key={record.id} style={styles.tableRow}>
                      <Text style={styles.tableCell}>{record.date} {record.time}</Text>
                      <Text style={styles.tableCell}>{record.temperature}°C</Text>
                      <Text style={styles.tableCell}>{record.bloodPressure.systolic}/{record.bloodPressure.diastolic}</Text>
                      <Text style={styles.tableCell}>%{record.oxygenSaturation}</Text>
                      <Text style={styles.tableCell}>{record.formulaAmount} ml</Text>
                      <Text style={styles.tableCell}>{record.waterAmount} ml</Text>
                      <Text style={styles.tableCell}>{record.notes}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </Page>
      </Document>
    </PDFViewer>
  );
} 