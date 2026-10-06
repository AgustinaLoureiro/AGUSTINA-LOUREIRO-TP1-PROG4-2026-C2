import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';
import { AvisosHost } from './components/avisos/avisos';
import { Avisos } from './services/ui';

@Component({
  imports: [RouterOutlet, AvisosHost],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private swUpdate = inject(SwUpdate);
  private avisos = inject(Avisos);

  constructor() {
    // PWA: cuando hay una versión nueva descargada, se avisa y se recarga.
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.pipe(filter((e) => e.type === 'VERSION_READY')).subscribe(() => {
        this.avisos.mostrar('Hay una versión nueva de CineCorn. Actualizando…', 'info');
        setTimeout(() => document.location.reload(), 2500);
      });
    }
  }
}
