import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface PeliculaPlaceholder {
  id: number;
  titulo: string;
  genero: string;
  color: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {
  busqueda = signal('');

  //
  //
  //
  // PRUEBA: reemplazar por consulta a supabase!!!!!!!!!!!!!!!!!!!!!
  //
  //
  //

  peliculas: PeliculaPlaceholder[] = [
    { id: 1, titulo: 'PELI A', genero: 'Drama', color: '#4A2A1A' },
    { id: 2, titulo: 'PELI B', genero: 'Drama', color: '#4A2A1A' },
    { id: 3, titulo: 'PELI C', genero: 'Drama', color: '#4A2A1A' },
  ];
}