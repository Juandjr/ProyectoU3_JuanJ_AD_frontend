import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { clearJwt } from '../../utils/auth-utils';
import { getBackendBaseUrl } from '../../utils/backend-config';

@Component({
  selector: 'app-scoreboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scoreboard.component.html',
  styleUrls: ['./scoreboard.component.css']
})
export class ScoreboardComponent implements OnInit {
  private router = inject(Router);

  selectedDifficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'EASY';
  entries: any[] = [];
  loading = true;
  errorMessage: string | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  selectDifficulty(diff: 'EASY' | 'MEDIUM' | 'HARD'): void {
    if (this.selectedDifficulty === diff) return;
    this.selectedDifficulty = diff;
    this.load();
  }

  async load() {
    this.loading = true;
    this.errorMessage = null;
    this.entries = [];

    try {
      const token = localStorage.getItem('jwt');
      const res = await fetch(`${getBackendBaseUrl()}/api/scoreboard?difficulty=${this.selectedDifficulty}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      const data = await res.json();

      if (res.status === 401) {
        clearJwt();
        this.router.navigate(['/login']);
        return;
      }

      if (!res.ok) {
        const message = data?.error || 'Failed to load scoreboard';
        throw new Error(message);
      }

      this.entries = Array.isArray(data) ? data.slice(0, 10) : [];
    } catch (err: any) {
      this.errorMessage = err?.message || 'Error cargando los resultados';
      console.error('Scoreboard load failed:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  back(): void {
    this.router.navigate(['/start']);
  }
}
