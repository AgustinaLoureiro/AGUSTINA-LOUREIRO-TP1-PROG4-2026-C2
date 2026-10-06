import { inject, Service } from '@angular/core';
import { Supabase } from './supabase';
import { FilaReporte, RankingPelicula, RankingProducto } from '../interfaces/usuario';

/** Reportes del admin (RPC en la base) y exportación a PDF / Excel. */
@Service()
export class Reportes {
  private sup = inject(Supabase);

  async facturacion(desde: string, hasta: string): Promise<FilaReporte[]> {
    const { data, error } = await this.sup.Supabase.rpc('reporte_facturacion', {
      p_desde: desde,
      p_hasta: hasta,
    });
    if (error) throw error;
    return (data as FilaReporte[]).map((f) => ({
      ...f,
      facturado: Number(f.facturado),
      cobrado_tarjeta: Number(f.cobrado_tarjeta),
      credito_aplicado: Number(f.credito_aplicado),
    }));
  }

  async rankingPeliculas(desde: string, hasta: string): Promise<RankingPelicula[]> {
    const { data, error } = await this.sup.Supabase.rpc('ranking_peliculas', {
      p_desde: desde,
      p_hasta: hasta,
      p_limite: 8,
    });
    if (error) throw error;
    return data as RankingPelicula[];
  }

  async rankingProductos(desde: string, hasta: string): Promise<RankingProducto[]> {
    const { data, error } = await this.sup.Supabase.rpc('ranking_productos', {
      p_desde: desde,
      p_hasta: hasta,
    });
    if (error) throw error;
    return data as RankingProducto[];
  }

  async exportarPdf(filas: FilaReporte[], desde: string, hasta: string) {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();
    const moneda = (n: number) => `$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
    const totales = this.totales(filas);

    doc.setFillColor(20, 23, 28);
    doc.rect(0, 0, 210, 26, 'F');
    doc.setTextColor(232, 144, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('CINECORN · Reporte de facturación', 14, 16);
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${this.fechaAr(desde)} al ${this.fechaAr(hasta)}`, 14, 36);
    doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, 14, 42);

    autoTable(doc, {
      startY: 50,
      head: [
        ['Fecha', 'Compras', 'Entradas', 'Facturado', 'Cobrado con tarjeta', 'Crédito aplicado'],
      ],
      body: filas.map((f) => [
        this.fechaAr(f.fecha),
        f.compras,
        f.entradas,
        moneda(f.facturado),
        moneda(f.cobrado_tarjeta),
        moneda(f.credito_aplicado),
      ]),
      foot: [
        [
          'Total',
          totales.compras,
          totales.entradas,
          moneda(totales.facturado),
          moneda(totales.tarjeta),
          moneda(totales.credito),
        ],
      ],
      headStyles: { fillColor: [20, 23, 28] },
      footStyles: { fillColor: [232, 144, 42], textColor: [20, 23, 28] },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
      styles: { fontSize: 9 },
    });
    doc.save(`cinecorn-facturacion-${desde}-a-${hasta}.pdf`);
  }

  async exportarExcel(filas: FilaReporte[], desde: string, hasta: string) {
    const { default: ExcelJS } = await import('exceljs');
    const libro = new ExcelJS.Workbook();
    libro.creator = 'CineCorn';
    const hoja = libro.addWorksheet('Facturación');
    hoja.columns = [
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Compras', key: 'compras', width: 11 },
      { header: 'Entradas', key: 'entradas', width: 11 },
      { header: 'Facturado', key: 'facturado', width: 16, style: { numFmt: '"$"#,##0.00' } },
      {
        header: 'Cobrado con tarjeta',
        key: 'cobrado_tarjeta',
        width: 20,
        style: { numFmt: '"$"#,##0.00' },
      },
      {
        header: 'Crédito aplicado',
        key: 'credito_aplicado',
        width: 18,
        style: { numFmt: '"$"#,##0.00' },
      },
    ];
    filas.forEach((f) => hoja.addRow({ ...f, fecha: new Date(f.fecha + 'T00:00:00') }));
    hoja.getColumn('fecha').numFmt = 'dd/mm/yyyy';
    const ultima = filas.length + 1;
    const total = hoja.addRow({
      fecha: 'Total',
      compras: { formula: `SUM(B2:B${ultima})` },
      entradas: { formula: `SUM(C2:C${ultima})` },
      facturado: { formula: `SUM(D2:D${ultima})` },
      cobrado_tarjeta: { formula: `SUM(E2:E${ultima})` },
      credito_aplicado: { formula: `SUM(F2:F${ultima})` },
    });
    total.font = { bold: true };
    const encabezado = hoja.getRow(1);
    encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14171C' } };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await libro.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cinecorn-facturacion-${desde}-a-${hasta}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  totales(filas: FilaReporte[]) {
    return filas.reduce(
      (t, f) => ({
        compras: t.compras + Number(f.compras),
        entradas: t.entradas + Number(f.entradas),
        facturado: t.facturado + f.facturado,
        tarjeta: t.tarjeta + f.cobrado_tarjeta,
        credito: t.credito + f.credito_aplicado,
      }),
      { compras: 0, entradas: 0, facturado: 0, tarjeta: 0, credito: 0 },
    );
  }

  private fechaAr(iso: string) {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
}
