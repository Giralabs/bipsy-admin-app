import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { Category } from './category.model';
import { CategoriesService } from './categories.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './categories.html',
  styleUrl: './categories.scss',
})
export class Categories {
  private readonly categoriesService = inject(CategoriesService);
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);

  readonly categories = signal<Category[]>([]);
  readonly loading = signal(false);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly togglingId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_]{2,50}$/)]],
    name: ['', Validators.required],
    description: [''],
  });

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.categoriesService.list().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  submit() {
    if (this.form.invalid || this.saving()) return;
    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.categoriesService
      .create({ code: raw.code.toUpperCase(), name: raw.name, description: raw.description || null })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showForm.set(false);
          this.form.reset();
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  toggleActive(c: Category) {
    this.togglingId.set(c.id);
    this.categoriesService.update(c.id, { name: c.name, description: c.description, active: !c.active }).subscribe({
      next: () => {
        this.togglingId.set(null);
        this.load();
      },
      error: () => this.togglingId.set(null),
    });
  }
}
