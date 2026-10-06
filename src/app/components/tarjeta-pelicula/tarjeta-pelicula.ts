import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PeliculaPublica } from '../../interfaces/catalogo';
import { Estrellas } from '../estrellas/estrellas';
import { DuracionPipe } from '../../pipes/duracion-pipe';
import { ImagenRespaldo } from '../../directives/imagen-respaldo';

@Component({
  selector: 'app-tarjeta-pelicula',
  imports: [RouterLink, DatePipe, Estrellas, DuracionPipe, ImagenRespaldo],
  templateUrl: './tarjeta-pelicula.html',
  styleUrl: './tarjeta-pelicula.css',
})
export class TarjetaPelicula {
  pelicula = input.required<PeliculaPublica>();
  /** Número de ranking (para el podio de más vendidas). */
  puesto = input<number | null>(null);
}
