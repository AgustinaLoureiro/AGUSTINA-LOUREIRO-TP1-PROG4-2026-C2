import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-no-encontrada',
  imports: [RouterLink],
  template: `
    <section class="nada rayos">
      <p class="nada__codigo">404</p>
      <h1>Esta función no está en cartelera</h1>
      <p class="texto-suave">La página que buscás no existe o cambió de sala.</p>
      <a routerLink="/" class="btn btn--primario">Volver al inicio</a>
    </section>
  `,
  styles: `
    .nada {
      display: grid;
      justify-items: center;
      align-content: center;
      gap: 0.5rem;
      min-height: 70dvh;
      padding: 2rem 16px;
      text-align: center;
    }
    .nada__codigo {
      margin: 0;
      font-family: var(--font-display);
      font-size: clamp(6rem, 25vw, 12rem);
      line-height: 0.9;
      color: var(--primary);
      text-shadow: 0 0 40px rgb(240 180 76 / 0.5);
    }
    h1 {
      font-size: clamp(2rem, 5vw, 3rem);
    }
  `,
})
export class NoEncontrada {}
