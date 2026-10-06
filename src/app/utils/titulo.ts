import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/** Título de la pestaña: "Cartelera · CineCorn". */
@Injectable({ providedIn: 'root' })
export class TituloCinecorn extends TitleStrategy {
  private title = inject(Title);

  override updateTitle(estado: RouterStateSnapshot) {
    const titulo = this.buildTitle(estado);
    this.title.setTitle(
      titulo ? `${titulo} · CineCorn` : 'CineCorn · No es solo un cine, es el plan perfecto',
    );
  }
}
