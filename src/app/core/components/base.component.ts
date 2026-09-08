import { Component, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({ template: '' })
export abstract class BaseComponent implements OnDestroy {
  protected destroy$ = new Subject<void>();

  constructor(protected cdr: ChangeDetectorRef) {}

  protected safeSubscribe<T>(
    observable: any,
    next: (value: T) => void,
    error?: (err: any) => void,
  ): void {
    observable.pipe(takeUntil(this.destroy$)).subscribe({
      next: (value: T) => {
        next(value);
        this.cdr.detectChanges();
      },
      error: error || (() => {}),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
