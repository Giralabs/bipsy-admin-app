import { Component, DestroyRef, ElementRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { NAV_ITEMS, NAV_SECTIONS, NavSection } from '../../core/navigation';
import { AuthService } from '../../core/services/auth.service';
import { BadgesService } from '../../core/services/badges.service';
import { LiveService } from '../../core/services/live.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { ThemeService } from '../../core/services/theme.service';
import { adminScope } from '../../core/utils/labels';
import { Avatar } from '../../shared/components/avatar/avatar';
import { CommandPalette } from '../../shared/components/command-palette/command-palette';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Avatar, CommandPalette],
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(document:mousedown)': 'onDocumentDown($event)',
  },
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly prefs = inject(PreferencesService);
  protected readonly badges = inject(BadgesService);
  private readonly live = inject(LiveService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly navOpen = signal(false);
  protected readonly paletteOpen = signal(false);
  /** Dropdown menu open in the top bar (section title). */
  protected readonly openGroup = signal<string | null>(null);
  protected readonly url = signal(this.router.url);
  protected readonly scopeLabel = adminScope;
  protected readonly sections = NAV_SECTIONS;

  protected readonly layout = this.prefs.layout;
  /** Layouts with a side menu on desktop. */
  protected readonly hasSide = computed(() => this.layout() === 'sidebar' || this.layout() === 'rail');
  protected readonly onHome = computed(() => this.path() === '/home');
  private readonly path = computed(() => this.url().split('?')[0]);

  /** The section you are in, for the tiles layout breadcrumb. */
  protected readonly current = computed(() => {
    const path = this.path();
    if (path.startsWith('/account')) return { label: 'Mi cuenta', icon: 'person' };
    return NAV_ITEMS.find((i) => path === i.path || path.startsWith(i.path + '/')) ?? null;
  });

  constructor() {
    this.auth.refreshProfile();
    this.badges.refresh(true);
    // Real time while there is a session: the shell only exists with an open session.
    this.live.start();
    inject(DestroyRef).onDestroy(() => this.live.stop());

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((e) => {
        this.url.set((e as NavigationEnd).urlAfterRedirects);
        this.navOpen.set(false);
        this.openGroup.set(null);
        this.badges.refresh();
      });
  }

  // ----- TOP BAR --------------------

  /** A section is active if any of its pages is. */
  protected groupActive(section: NavSection): boolean {
    const path = this.path();
    return section.items.some((i) => path === i.path || path.startsWith(i.path + '/'));
  }

  /** Pending items across the whole section, for the button badge. */
  protected groupBadge(section: NavSection): number {
    const counts = this.badges.counts();
    return section.items.reduce((sum, i) => sum + (i.badge ? counts[i.badge] : 0), 0);
  }

  protected toggleGroup(title: string) {
    this.openGroup.set(this.openGroup() === title ? null : title);
  }

  protected onDocumentDown(event: MouseEvent) {
    if (!this.openGroup()) return;
    const nav = this.host.nativeElement.querySelector('.topnav');
    if (nav && !nav.contains(event.target as Node)) this.openGroup.set(null);
  }

  // ----- GENERAL --------------------

  protected toggleTheme() {
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    this.theme.set(dark ? 'light' : 'dark');
  }

  protected onKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    const typing =
      !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.paletteOpen.set(!this.paletteOpen());
    } else if (event.key === '/' && !typing && !this.paletteOpen()) {
      event.preventDefault();
      this.paletteOpen.set(true);
    } else if (event.key === 'Escape' && this.openGroup()) {
      this.openGroup.set(null);
    }
  }
}
