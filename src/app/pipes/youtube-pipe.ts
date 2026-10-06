import { inject, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/**
 * Convierte el ID de un video de YouTube en una URL segura para un iframe.
 * Solo acepta IDs válidos, así nunca se marca como confiable una URL arbitraria.
 */
@Pipe({ name: 'youtube' })
export class YoutubePipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(id: string | null | undefined): SafeResourceUrl | null {
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
    );
  }
}
