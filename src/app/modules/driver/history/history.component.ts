import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DriverSidebarComponent } from '../driver-sidebar/driver-sidebar.component';
import { TrajetService } from '../../../core/services/trajet.service';
import { Trajet } from '../../../core/models/trajet.model';

@Component({
  selector: 'app-driver-history',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterModule, DriverSidebarComponent],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css'],
})
export class DriverHistoryComponent implements OnInit {
  loading = true;
  today = new Date();
  history: Trajet[] = [];
  filtered: Trajet[] = [];
  filterTab = 'all';
  filterSearch = '';
  totalRevenue = 0;
  totalPassengers = 0;
  fillRate = 82;
  destinationStats: {label:string;count:number;color:string}[] = [];

  constructor(private trajetService: TrajetService) {}

  ngOnInit(): void {
    this.trajetService.getMyTrajets().subscribe({
      next: (data) => {
        this.history = data.filter(t => t.status === 'DEPARTED' || t.status === 'CANCELLED');
        this.filtered = [...this.history];
        this.totalRevenue = this.history.reduce((s,t) => s + ((t.totalSeats - t.availableSeats) * t.pricePerSeat), 0);
        this.totalPassengers = this.history.reduce((s,t) => s + (t.totalSeats - t.availableSeats), 0);
        this.buildDestStats();
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  buildDestStats(): void {
    const map = new Map<string,number>();
    this.history.forEach(t => {
      const key = `${t.departureCity} → ${t.arrivalCity}`;
      map.set(key, (map.get(key)||0) + 1);
    });
    const colors = ['#12b76a','#1e3a6b','#f59e0b','#d0d5dd'];
    let i = 0;
    this.destinationStats = Array.from(map.entries()).map(([label,count]) => ({label,count,color:colors[i++%colors.length]}));
  }

  applyFilter(): void {
    let list = this.history;
    if (this.filterTab === 'done') list = list.filter(t => t.status === 'DEPARTED');
    if (this.filterTab === 'cancelled') list = list.filter(t => t.status === 'CANCELLED');
    if (this.filterSearch.trim()) {
      const q = this.filterSearch.toLowerCase();
      list = list.filter(t => t.departureCity.toLowerCase().includes(q) || t.arrivalCity.toLowerCase().includes(q));
    }
    this.filtered = list;
  }

  getFillPct(t: Trajet): number { return t.totalSeats > 0 ? Math.round((t.totalSeats - t.availableSeats) / t.totalSeats * 100) : 0; }
  getRevenue(t: Trajet): number { return (t.totalSeats - t.availableSeats) * t.pricePerSeat; }
}
