import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Catalogo } from '../../services/catalogo';
import { Clasificacion, PeliculaPublica } from '../../interfaces/catalogo';
import { TarjetaPelicula } from '../../components/tarjeta-pelicula/tarjeta-pelicula';

/** Normaliza para buscar sin importar tildes ni mayúsculas. */
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

@Component({
  selector: 'app-cartelera',
  imports: [FormsModule, TarjetaPelicula],
  templateUrl: './cartelera.html',
  styleUrl: './cartelera.css',
})
export class Cartelera implements OnInit {
  private catalogo = inject(Catalogo);
  private router = inject(Router);

  /** Filtros iniciales desde la URL (?q=…&genero=…), así se pueden compartir. */
  q = input<string>('');
  genero = input<string | string[]>('');

  protected cargando = signal(true);
  protected peliculas = signal<PeliculaPublica[]>([]);
  protected busqueda = signal('');
  protected generosElegidos = signal<ReadonlySet<string>>(new Set());
  protected clasificacion = signal<Clasificacion | null>(null);
  protected incluirProximas = signal(false);

  protected readonly clasificaciones: Clasificacion[] = ['ATP', '+13', '+18'];

  /** Solo se ofrecen géneros que tienen alguna película publicada. */
  protected generos = computed(() =>
    [...new Set(this.peliculas().flatMap((p) => p.generos))].sort((a, b) => a.localeCompare(b)),
  );

  protected resultado = computed(() => {
    const texto = normalizar(this.busqueda().trim());
    const generos = this.generosElegidos();
    const clasif = this.clasificacion();
    return this.peliculas().filter((p) => {
      if (!this.incluirProximas() && (p.proximamente || !p.tiene_funciones) && !p.en_preventa)
        return false;
      if (texto && !normalizar(p.titulo + ' ' + p.sinopsis).includes(texto)) return false;
      // Una película tiene varios géneros: debe tener TODOS los elegidos.
      for (const g of generos) if (!p.generos.includes(g)) return false;
      if (clasif && p.clasificacion !== clasif) return false;
      return true;
    });
  });

  protected hayFiltros = computed(
    () => !!this.busqueda() || this.generosElegidos().size > 0 || !!this.clasificacion(),
  );

  async ngOnInit() {
    this.busqueda.set(this.q() ?? '');
    const g = this.genero();
    this.generosElegidos.set(new Set(Array.isArray(g) ? g : g ? [g] : []));
    try {
      this.peliculas.set(await this.catalogo.peliculas());
    } finally {
      this.cargando.set(false);
    }
  }

  protected alternarGenero(g: string) {
    this.generosElegidos.update((s) => {
      const nuevo = new Set(s);
      nuevo.has(g) ? nuevo.delete(g) : nuevo.add(g);
      return nuevo;
    });
    this.sincronizarUrl();
  }

  protected buscar(texto: string) {
    this.busqueda.set(texto);
    this.sincronizarUrl();
  }

  protected limpiar() {
    this.busqueda.set('');
    this.generosElegidos.set(new Set());
    this.clasificacion.set(null);
    this.sincronizarUrl();
  }

  private sincronizarUrl() {
    this.router.navigate([], {
      queryParams: {
        q: this.busqueda() || null,
        genero: this.generosElegidos().size ? [...this.generosElegidos()] : null,
      },
      replaceUrl: true,
    });
  }
}
