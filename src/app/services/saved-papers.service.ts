import { Injectable } from '@angular/core';
import { ResearchPaper } from '../models/research-paper';

const STORAGE_KEY = 'core-atlas:saved-papers:v1';

@Injectable({ providedIn: 'root' })
export class SavedPapersService {
  getAll(): ResearchPaper[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(stored) ? stored as ResearchPaper[] : [];
    } catch {
      return [];
    }
  }

  contains(id: string): boolean {
    return this.getAll().some((paper) => paper.id === id);
  }

  toggle(paper: ResearchPaper): ResearchPaper[] {
    const current = this.getAll();
    const next = current.some((item) => item.id === paper.id)
      ? current.filter((item) => item.id !== paper.id)
      : [paper, ...current];

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage can be disabled or full. Keep the current interaction usable.
      }
    }
    return next;
  }
}
