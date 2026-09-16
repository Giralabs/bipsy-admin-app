import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { LayoutMode, MotionPref, Preferences, PreferencesService, TextSize } from '../../core/services/preferences.service';
import { ThemePreference, ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { adminScope } from '../../core/utils/labels';
import { Avatar } from '../../shared/components/avatar/avatar';
import { Pill } from '../../shared/components/pill/pill';
import { SegmentOption, Segmented } from '../../shared/components/segmented/segmented';

type Health = 'checking' | 'up' | 'down';
type ToggleKey = 'highContrast' | 'underlineLinks' | 'largeTargets' | 'strongFocus';

@Component({
  selector: 'app-account',
  imports: [Avatar, Pill, Segmented],
  templateUrl: './account.html',
  styleUrl: './account.scss',
})
export class Account {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly prefs = inject(PreferencesService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly scope = adminScope;
  protected readonly apiUrl = environment.apiUrl;
  protected readonly webUrl = environment.webUrl;
  protected readonly health = signal<Health>('checking');
  protected readonly latency = signal<number | null>(null);

  protected readonly themeOptions: SegmentOption<ThemePreference>[] = [
    { value: 'system', label: 'Sistema' },
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
  ];
  protected readonly textOptions: SegmentOption<TextSize>[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'large', label: 'Grande' },
    { value: 'xlarge', label: 'Muy grande' },
  ];
  protected readonly motionOptions: SegmentOption<MotionPref>[] = [
    { value: 'system', label: 'Sistema' },
    { value: 'reduce', label: 'Reducir' },
    { value: 'full', label: 'Todas' },
  ];

  protected readonly layouts: { value: LayoutMode; label: string; hint: string }[] = [
    { value: 'sidebar', label: 'Panel lateral', hint: 'Menú fijo a la izquierda con el nombre de cada sección. El de siempre.' },
    { value: 'rail', label: 'Compacto', hint: 'Menú lateral solo con iconos: más sitio para tablas. El nombre sale al pasar el ratón.' },
    { value: 'topbar', label: 'Barra superior', hint: 'Navegación arriba con un menú por sección, como la web. Todo el ancho para el contenido.' },
    { value: 'tiles', label: 'Bloques', hint: 'Inicio con bloques vivos por sección y sin menú fijo. Ideal en pantallas grandes o táctiles.' },
  ];

  protected readonly toggles: { key: ToggleKey; label: string; hint: string; icon: string }[] = [
    { key: 'highContrast', label: 'Alto contraste', hint: 'Textos secundarios más legibles y bordes alrededor de cada bloque.', icon: 'contrast' },
    { key: 'underlineLinks', label: 'Subrayar enlaces', hint: 'Para no depender del color para saber qué se puede pulsar.', icon: 'format_underlined' },
    { key: 'largeTargets', label: 'Botones más grandes', hint: 'Botones, filas y campos más altos, más fáciles de acertar.', icon: 'touch_app' },
    { key: 'strongFocus', label: 'Foco muy visible', hint: 'Marca gruesa en el elemento activo al moverte con el teclado.', icon: 'keyboard' },
  ];

  protected readonly permissions = [
    { label: 'Consultar todo el panel', scopes: ['FULL', 'SUPPORT', 'READONLY'] },
    { label: 'Responder y gestionar tickets y solicitudes', scopes: ['FULL', 'SUPPORT'] },
    { label: 'Banear, sancionar y restablecer cuentas', scopes: ['FULL'] },
    { label: 'Planes, ofertas, categorías y ajustes de Explorar', scopes: ['FULL'] },
    { label: 'Resolver reportes y moderar reseñas', scopes: ['FULL'] },
    { label: 'Crear cuentas del panel y cambiar permisos', scopes: ['FULL'] },
  ];

  constructor() {
    this.checkApi();
  }

  protected setLayout(layout: LayoutMode) {
    if (this.prefs.layout() === layout) return;
    this.prefs.set('layout', layout);
    const label = this.layouts.find((l) => l.value === layout)?.label ?? layout;
    this.toast.success(`Diseño «${label}» activado.`);
    if (layout === 'tiles') this.router.navigateByUrl('/home');
  }

  protected toggle(key: ToggleKey, value: boolean) {
    this.prefs.set(key, value as Preferences[ToggleKey]);
  }

  protected resetA11y() {
    this.prefs.resetAccessibility();
    this.toast.info('Accesibilidad restablecida.');
  }

  /** GET /plans es público y ligero: sirve de latido sin tocar datos. */
  protected checkApi() {
    this.health.set('checking');
    const started = performance.now();
    this.http.get(`${this.apiUrl}/plans`).subscribe({
      next: () => {
        this.latency.set(Math.round(performance.now() - started));
        this.health.set('up');
      },
      error: () => {
        this.latency.set(null);
        this.health.set('down');
      },
    });
  }
}
