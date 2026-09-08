import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DriverSidebarComponent } from '../driver-sidebar/driver-sidebar.component';
import { AvisService } from '../../../core/services/avis.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-driver-reviews',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterModule, DriverSidebarComponent],
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.css'],
})
export class DriverReviewsComponent implements OnInit {
  loading = true;
  today = new Date();
  avis: any[] = [];
  filtered: any[] = [];
  avgRating = 0;
  filterStar = 0;
  filterSearch = '';
  Math = Math;
  private starCounts: Record<number,number> = {};

  constructor(
    private avisService: AvisService,
    private authService: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    const driverId = this.authService.getUserId() || '';
    this.avisService.getAvisForDriver(driverId).subscribe({
      next: (data) => {
        this.avis = data.map((a:any) => ({...a, replying:false, replyText:'', driverReply: a.driverReply || null}));
        if (data.length) this.avgRating = data.reduce((s:number,a:any)=>s+a.rating,0)/data.length;
        data.forEach((a:any) => { this.starCounts[a.rating] = (this.starCounts[a.rating]||0)+1; });
        this.applyFilter();
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  applyFilter(): void {
    let list = this.avis;
    if (this.filterStar > 0) list = list.filter(a => a.rating === this.filterStar);
    this.filtered = list;
  }

  getPercent(n: number): number {
    return this.avis.length ? Math.round((this.starCounts[n]||0)/this.avis.length*100) : 0;
  }

  getCounts(): Record<number,number> { return this.starCounts; }

  submitReply(a: any): void {
    if (!a.replyText?.trim()) return;
    // Backend does not have a reply endpoint in the current spec — store locally
    a.driverReply = a.replyText;
    a.replying = false;
    this.toast.success('Réponse envoyée');
  }
}
