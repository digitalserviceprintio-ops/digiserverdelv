import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { IncomeRecord } from '../types';
import { formatDateID, formatIDR, MONTHS_ID } from './utils';

export interface ReportSummary {
  year: number;
  month: number; // 1-12 or 0 for full year
  totalPendapatan: number;
  pendapatanLunas: number;
  belumLunas: number;
  jumlahTransaksi: number;
  records: IncomeRecord[];
  appTitle?: string;
}

function getPeriodLabel(year: number, month: number): string {
  if (month === 0) return `Tahun ${year}`;
  return `${MONTHS_ID[month - 1]} ${year}`;
}

export function exportMonthlyReportPDF(summary: ReportSummary): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const periodLabel = getPeriodLabel(summary.year, summary.month);

  // Header
  doc.setFillColor(23, 37, 84); // #172554 Navy Blue
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text((summary.appTitle || 'DIGIVAULT').toUpperCase(), 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(186, 230, 253);
  doc.text('LAPORAN PENDAPATAN FREELANCE', 14, 21);
  doc.text(`Periode: ${periodLabel}`, 14, 27);

  // Summary Block
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);

  const summaryY = 42;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, summaryY, 182, 28, 3, 3, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Total Pendapatan', 20, summaryY + 8);
  doc.text('Pendapatan Lunas', 68, summaryY + 8);
  doc.text('Belum Lunas', 116, summaryY + 8);
  doc.text('Jumlah Transaksi', 160, summaryY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(formatIDR(summary.totalPendapatan), 20, summaryY + 18);
  doc.setTextColor(22, 163, 74);
  doc.text(formatIDR(summary.pendapatanLunas), 68, summaryY + 18);
  doc.setTextColor(217, 119, 6);
  doc.text(formatIDR(summary.belumLunas), 116, summaryY + 18);
  doc.setTextColor(15, 23, 42);
  doc.text(`${summary.jumlahTransaksi} transaksi`, 160, summaryY + 18);

  // Table
  const rows = summary.records.map((item, idx) => [
    String(idx + 1),
    formatDateID(item.transactionDate),
    item.clientName,
    item.serviceType,
    formatIDR(item.amount),
    item.paymentStatus === 'lunas' ? 'Lunas' : 'Belum Lunas',
  ]);

  autoTable(doc, {
    startY: summaryY + 35,
    head: [['No', 'Tanggal', 'Klien', 'Jenis Jasa', 'Nominal', 'Status']],
    body: rows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 3,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [23, 37, 84],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { cellWidth: 24 },
      4: { halign: 'right', cellWidth: 34 },
      5: { halign: 'center', cellWidth: 26 },
    },
    didDrawPage: (data) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Dicetak melalui DigiVault.', 14, pageHeight - 10);
      doc.text(`Halaman ${data.pageNumber}`, 196, pageHeight - 10, { align: 'right' });
    },
  });

  const safeFilePeriod = periodLabel.toLowerCase().replace(/\s+/g, '-');
  doc.save(`digivault-laporan-${safeFilePeriod}.pdf`);
}

export function exportMonthlyReportExcel(summary: ReportSummary): void {
  const periodLabel = getPeriodLabel(summary.year, summary.month);

  const summaryRows = [
    ['DIGIVAULT - LAPORAN PENDAPATAN FREELANCE'],
    ['Periode', periodLabel],
    ['Total Pendapatan', summary.totalPendapatan],
    ['Pendapatan Lunas', summary.pendapatanLunas],
    ['Belum Lunas', summary.belumLunas],
    ['Jumlah Transaksi', summary.jumlahTransaksi],
    [],
    ['No', 'Tanggal', 'Klien', 'Jenis Jasa', 'Deskripsi', 'Metode Pembayaran', 'Nominal (IDR)', 'Status'],
  ];

  const txRows = summary.records.map((item, idx) => [
    idx + 1,
    formatDateID(item.transactionDate),
    item.clientName,
    item.serviceType,
    item.description || '-',
    item.paymentMethod,
    item.amount,
    item.paymentStatus === 'lunas' ? 'Lunas' : 'Belum Lunas',
  ]);

  const footerRows = [[], ['Dicetak melalui DigiVault.']];

  const worksheet = XLSX.utils.aoa_to_sheet([...summaryRows, ...txRows, ...footerRows]);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 24 },
    { wch: 26 },
    { wch: 32 },
    { wch: 18 },
    { wch: 18 },
    { wch: 15 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Pendapatan');

  const safeFilePeriod = periodLabel.toLowerCase().replace(/\s+/g, '-');
  XLSX.writeFile(workbook, `digivault-laporan-${safeFilePeriod}.xlsx`);
}
