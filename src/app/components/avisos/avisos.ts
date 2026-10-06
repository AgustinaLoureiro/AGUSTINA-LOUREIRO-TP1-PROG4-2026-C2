import { Component, inject } from '@angular/core';
import { Avisos, Carga } from '../../services/ui';

/** Contenedor global de avisos flotantes y barra de carga (se monta una vez en App). */
@Component({
  selector: 'app-avisos',
  templateUrl: './avisos.html',
  styleUrl: './avisos.css',
})
export class AvisosHost {
  protected avisos = inject(Avisos);
  protected carga = inject(Carga);
}
