import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Catalogo } from '../../services/catalogo';
import { Auth } from '../../services/auth';
import { PeliculaPublica } from '../../interfaces/catalogo';
import { Combo } from '../../interfaces/candy';
import { TarjetaPelicula } from '../../components/tarjeta-pelicula/tarjeta-pelicula';
import { PrecioPipe } from '../../pipes/precio-pipe';

@Component({
  selector: 'app-home',
  imports: [RouterLink, TarjetaPelicula, PrecioPipe],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private catalogo = inject(Catalogo);
  protected auth = inject(Auth);

  protected cargando = signal(true);
  protected error = signal(false);
  protected peliculas = signal<PeliculaPublica[]>([]);
  protected masVendidas = signal<PeliculaPublica[]>([]);
  protected combos = signal<Combo[]>([]);
  protected descuentoRegistro = signal(20);

  protected enCartelera = computed(() => {
    const top = new Set(this.masVendidas().map((p) => p.id));
    return this.peliculas().filter((p) => !p.proximamente && p.tiene_funciones && !top.has(p.id));
  });

  protected proximamente = computed(() =>
    this.peliculas()
      .filter((p) => p.proximamente)
      .sort((a, b) => a.fecha_estreno.localeCompare(b.fecha_estreno))
      .slice(0, 4),
  );

  async ngOnInit() {
    try {
      const [peliculas, top, combos, config] = await Promise.all([
        this.catalogo.peliculas(),
        this.catalogo.masVendidas(3),
        this.catalogo.combosActivos(),
        this.catalogo.configuracion(),
      ]);
      this.peliculas.set(peliculas);
      this.masVendidas.set(top);
      this.combos.set(combos);
      this.descuentoRegistro.set(config.descuento_primera_compra);
    } catch {
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }
}
