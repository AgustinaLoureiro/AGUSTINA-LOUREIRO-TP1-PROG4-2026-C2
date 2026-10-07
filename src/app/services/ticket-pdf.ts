import { Service } from '@angular/core';
import { CompraDetalle } from '../interfaces/compra';
import { formatearCodigo } from '../pipes/codigo-pipe';
import { cargarQr } from '../utils/qr';

const COLOR = {
  fondo: [18, 12, 8] as const,
  oro: [240, 180, 76] as const,
  rojo: [179, 24, 13] as const,
  tinta: [34, 22, 15] as const,
  suave: [120, 98, 76] as const,
};

/**
 * Genera la entrada en PDF con el QR. Las librerías se importan bajo demanda
 * (import dinámico) para no sumar peso a la carga inicial de la app.
 */
@Service()
export class TicketPdf {
  async descargar(compra: CompraDetalle) {
    const [{ jsPDF }, QRCode, logo] = await Promise.all([
      import('jspdf'),
      cargarQr(),
      this.imagenComoDataUrl('/marca/isotipo-256.png'),
    ]);

    const qr = await QRCode.toDataURL(compra.codigo, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 480,
      color: { dark: '#120C08', light: '#FFFFFF' },
    });

    const doc = new jsPDF({ unit: 'mm', format: [100, 210] });
    const ancho = 100;
    const m = 8;
    let y = 0;

    // Encabezado
    doc.setFillColor(...COLOR.fondo);
    doc.rect(0, 0, ancho, 30, 'F');
    doc.addImage(logo, 'PNG', m, 6, 18, 18);
    doc.setTextColor(...COLOR.oro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('CINECORN', m + 22, 15);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('NO ES SOLO UN CINE, ES EL PLAN PERFECTO', m + 22, 21);
    doc.setFillColor(...COLOR.rojo);
    doc.rect(0, 30, ancho, 2, 'F');
    y = 42;

    // Película y función
    const inicio = new Date(compra.funcion.inicio);
    const fecha = inicio.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const hora = inicio.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    doc.setTextColor(...COLOR.tinta);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    const titulo = doc.splitTextToSize(compra.pelicula.titulo.toUpperCase(), ancho - m * 2 - 14);
    doc.text(titulo, m, y);
    this.etiqueta(doc, compra.pelicula.clasificacion, ancho - m - 12, y - 4.5);
    y += titulo.length * 6 + 2;

    const datos: [string, string][] = [
      ['FECHA', fecha.charAt(0).toUpperCase() + fecha.slice(1)],
      ['HORA', `${hora} hs`],
      ['SALA', compra.funcion.sala],
      [
        'FORMATO',
        `${compra.funcion.formato} · ${compra.funcion.idioma === 'CAST' ? 'Castellano' : 'Subtitulada'}`,
      ],
    ];
    doc.setFontSize(9);
    for (const [clave, valor] of datos) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR.suave);
      doc.text(clave, m, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR.tinta);
      doc.text(valor, m + 22, y);
      y += 5.5;
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR.suave);
    doc.text('BUTACAS', m, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR.tinta);
    const butacas = compra.entradas
      .map(
        (e) =>
          e.butaca + (e.tipo === 'vip' ? ' (VIP)' : e.tipo === 'accesible' ? ' (accesible)' : ''),
      )
      .join(', ');
    const lineasButacas = doc.splitTextToSize(butacas, ancho - m * 2 - 22);
    doc.text(lineasButacas, m + 22, y);
    y += lineasButacas.length * 5 + 3;

    // Línea troquelada
    this.troquel(doc, y, ancho);
    y += 6;

    // QR
    const lado = 46;
    doc.addImage(qr, 'PNG', (ancho - lado) / 2, y, lado, lado);
    y += lado + 5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.text(formatearCodigo(compra.codigo), ancho / 2, y, { align: 'center' });
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR.suave);
    doc.text('Mostrá este QR en el ingreso a la sala. Se invalida al usarse.', ancho / 2, y, {
      align: 'center',
    });
    y += 7;

    // Candy
    if (compra.items.length) {
      this.troquel(doc, y, ancho);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...COLOR.rojo);
      doc.text('CANDY BAR · retirá con el mismo QR', m, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR.tinta);
      for (const item of compra.items) {
        doc.text(`${item.cantidad} × ${item.nombre}`, m, y);
        y += 4.6;
      }
      y += 2;
    }

    // Avisos
    const avisos: string[] = [];
    if (compra.pelicula.clasificacion === '+18') {
      avisos.push('Película +18: ingreso exclusivo para adultos. Se solicitará DNI.');
    } else if (compra.pelicula.clasificacion === '+13') {
      avisos.push(
        'Película +13: menores de 13 años no pueden ingresar. Debe asistir un adulto responsable.',
      );
    }
    if (compra.entradas.some((e) => e.tipo === 'vip')) {
      avisos.push('Incluye butacas VIP (filas R, S y T).');
    }
    for (const aviso of avisos) {
      const lineas = doc.splitTextToSize(aviso, ancho - m * 2 - 6);
      const alto = lineas.length * 4 + 4;
      doc.setDrawColor(...COLOR.rojo);
      doc.setFillColor(253, 240, 236);
      doc.roundedRect(m, y, ancho - m * 2, alto, 1.5, 1.5, 'FD');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR.rojo);
      doc.setFont('helvetica', 'bold');
      doc.text(lineas, m + 3, y + 4.6);
      y += alto + 3;
    }

    // Pie
    y = Math.max(y + 2, 188);
    doc.setFillColor(...COLOR.fondo);
    doc.rect(0, y, ancho, 210 - y, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.oro);
    doc.text(compra.nombre || compra.email, m, y + 7);
    doc.text(`Total: $ ${Number(compra.total).toLocaleString('es-AR')}`, ancho - m, y + 7, {
      align: 'right',
    });
    doc.setTextColor(200, 180, 150);
    doc.setFontSize(6.5);
    doc.text(`Compra ${new Date(compra.creada_en).toLocaleString('es-AR')}`, m, y + 12);

    doc.save(`cinecorn-${compra.codigo}.pdf`);
  }

  private etiqueta(doc: import('jspdf').jsPDF, texto: string, x: number, y: number) {
    const [r, g, b] = texto === 'ATP' ? COLOR.suave : COLOR.rojo;
    doc.setFillColor(r, g, b);
    doc.roundedRect(x, y, 12, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(texto, x + 6, y + 4.2, { align: 'center' });
    doc.setTextColor(...COLOR.tinta);
  }

  private troquel(doc: import('jspdf').jsPDF, y: number, ancho: number) {
    doc.setDrawColor(...COLOR.suave);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.line(6, y, ancho - 6, y);
    doc.setLineDashPattern([], 0);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...COLOR.suave);
    doc.circle(0, y, 3, 'FD');
    doc.circle(ancho, y, 3, 'FD');
  }

  private async imagenComoDataUrl(url: string): Promise<string> {
    const blob = await (await fetch(url)).blob();
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result as string);
      lector.onerror = reject;
      lector.readAsDataURL(blob);
    });
  }
}
