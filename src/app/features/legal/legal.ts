import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { BUSINESS_LEGAL_DOCUMENTS } from '../../core/legal/business-legal.content';
import { LEGAL_DOCUMENTS } from '../../core/legal/legal.content';
import { LEGAL_COMPANY, LEGAL_COMPANY_INCOMPLETE, LegalDocument, LegalSection } from '../../core/legal/legal.models';
import { ToastService } from '../../core/services/toast.service';

interface DocGroup {
  label: string;
  docs: LegalDocument[];
}

// Shortcut to a specific section: what is looked up most often while helping someone.
interface QuickLink {
  icon: string;
  label: string;
  hint: string;
  slug: string;
  section: string;
}

/**
 * The published legal texts, at hand for the team.
 *
 * They are a copy of the ones in bipsy-web-app and bipsy-business-web-app
 * (`core/legal/`). They are read from here to answer a customer or a
 * business with the exact text they accepted, without leaving the panel.
 */
@Component({
  selector: 'app-legal',
  templateUrl: './legal.html',
  styleUrl: './legal.scss',
})
export class Legal {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly reader = viewChild<ElementRef<HTMLElement>>('reader');

  protected readonly company = LEGAL_COMPANY;
  protected readonly companyIncomplete = LEGAL_COMPANY_INCOMPLETE;

  protected readonly groups: DocGroup[] = [
    {
      label: 'Clientes y negocios',
      docs: ['terminos', 'privacidad', 'aviso-legal', 'cookies'].map((s) => LEGAL_DOCUMENTS[s]),
    },
    {
      label: 'Solo negocios',
      docs: ['condiciones-suscripcion', 'encargo-tratamiento'].map((s) => BUSINESS_LEGAL_DOCUMENTS[s]),
    },
    {
      label: 'Empresa',
      docs: ['quienes-somos', 'contacto', 'seguridad'].map((s) => LEGAL_DOCUMENTS[s]),
    },
  ];

  protected readonly quick: QuickLink[] = [
    { icon: 'event_busy', label: 'Cancelaciones y penalizaciones', hint: 'Qué se cobra al cancelar, cambiar o no acudir', slug: 'terminos', section: 'reservas' },
    { icon: 'currency_exchange', label: 'Baja y reembolsos del plan', hint: 'Qué se devuelve a un negocio que cancela', slug: 'condiciones-suscripcion', section: 'cancelacion' },
    { icon: 'badge', label: 'Derechos sobre sus datos', hint: 'Acceso, borrado, portabilidad…', slug: 'privacidad', section: 'derechos' },
    { icon: 'schedule', label: 'Plazos de respuesta', hint: 'Cuánto tardamos en contestar', slug: 'contacto', section: 'plazos' },
    { icon: 'report', label: 'Contenido ilícito', hint: 'Cómo se tramita un aviso', slug: 'terminos', section: 'ilicitos' },
    { icon: 'gavel', label: 'Reclamaciones de consumo', hint: 'Hojas de reclamación y arbitraje', slug: 'terminos', section: 'consumidores' },
    { icon: 'block', label: 'Suspender o dar de baja', hint: 'Cuándo se puede restringir una cuenta', slug: 'terminos', section: 'baja' },
    { icon: 'inventory_2', label: 'Cuánto guardamos los datos', hint: 'Plazos de conservación', slug: 'privacidad', section: 'conservacion' },
  ];

  private readonly allDocs = this.groups.flatMap((g) => g.docs);

  protected readonly slug = signal(this.route.snapshot.queryParamMap.get('doc') || 'terminos');
  protected readonly search = signal('');

  protected readonly doc = computed(() => this.allDocs.find((d) => d.slug === this.slug()) ?? this.allDocs[0]);

  protected readonly isBusinessDoc = computed(() => this.doc().slug in BUSINESS_LEGAL_DOCUMENTS);

  protected readonly publicUrl = computed(() =>
    this.isBusinessDoc() ? null : `${environment.webUrl}/legal/${this.doc().slug}`,
  );

  /** Search results across ALL documents, grouped by section. */
  protected readonly results = computed(() => {
    const q = this.normalize(this.search().trim());
    if (q.length < 3) return null;
    const hits: { doc: LegalDocument; section: LegalSection; snippet: string }[] = [];
    for (const doc of this.allDocs) {
      for (const section of doc.sections) {
        const text = [section.title, ...section.paragraphs, ...(section.bullets ?? []), ...(section.closingParagraphs ?? [])].join(' ');
        const at = this.normalize(text).indexOf(q);
        if (at >= 0) {
          const start = Math.max(0, at - 60);
          hits.push({ doc, section, snippet: (start > 0 ? '…' : '') + text.slice(start, at + q.length + 90) + '…' });
        }
      }
    }
    return hits.slice(0, 30);
  });

  protected open(slug: string, section?: string) {
    this.slug.set(slug);
    this.search.set('');
    this.router.navigate([], { queryParams: { doc: slug }, fragment: section, replaceUrl: true });
    setTimeout(() => {
      const target = section ? document.getElementById('legal-' + section) : this.reader()?.nativeElement;
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (section) {
        target?.classList.add('is-flash');
        setTimeout(() => target?.classList.remove('is-flash'), 1600);
      }
    });
  }

  protected async copySection(section: LegalSection) {
    const doc = this.doc();
    const text = [
      `${doc.title} — ${section.title}`,
      ...section.paragraphs,
      ...(section.bullets ?? []).map((b) => `• ${b}`),
      ...(section.closingParagraphs ?? []),
      this.publicUrl() ? `${this.publicUrl()}#${section.id}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success('Apartado copiado. Puedes pegarlo en la respuesta.');
    } catch {
      this.toast.error('El navegador no ha dejado copiar.', 'No se ha podido copiar');
    }
  }

  protected print() {
    window.print();
  }

  private normalize(s: string) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
}
