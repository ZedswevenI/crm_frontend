import { Component, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements AfterViewInit {
  kpis = [
    { label: 'Students', value: 1240, sub: 'Active' },
    { label: 'Batches', value: 28, sub: 'Running' },
    { label: 'Attendance', value: '92%', sub: 'Today' },
    { label: 'Fees (MTD)', value: '₹48.6L', sub: 'Collected' },
    { label: 'Exams', value: 18, sub: 'This Month' },
    { label: 'Avg Score', value: '64%', sub: 'Performance' }
  ];

  constructor(private router: Router, private breadcrumb: BredcrumpService) {
    this.breadcrumb.set([{ label: 'Dashboard' }]);
  }

  ngAfterViewInit(): void {
    this.performanceTrend();
    this.attendanceTrend();
    this.subjectComparison();
    this.feeSplit();
  }

  go(path: string): void {
    this.router.navigate([path]);
  }

  // ---------------- Charts ----------------

  performanceTrend(): void {
    new Chart('performanceTrend', {
      type: 'line',
      data: {
        labels: ['UT1', 'UT2', 'WT1', 'UT3', 'Model'],
        datasets: [
          {
            label: 'Avg %',
            data: [58, 62, 60, 66, 69],
            borderColor: '#2563EB',
            tension: 0.3,
            fill: false
          }
        ]
      }
    });
  }

  attendanceTrend(): void {
    new Chart('attendanceTrend', {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'Attendance %',
            data: [90, 92, 91, 93, 94, 89, 95],
            borderColor: '#16A34A',
            tension: 0.3
          }
        ]
      }
    });
  }

  subjectComparison(): void {
    new Chart('subjectComparison', {
      type: 'bar',
      data: {
        labels: ['Physics', 'Chemistry', 'Maths'],
        datasets: [
          {
            label: 'Avg Marks',
            data: [62, 58, 66],
            backgroundColor: ['#2563EB', '#F59E0B', '#10B981']
          }
        ]
      }
    });
  }

  feeSplit(): void {
    new Chart('feeSplit', {
      type: 'doughnut',
      data: {
        labels: ['Collected', 'Pending'],
        datasets: [
          {
            data: [78, 22],
            backgroundColor: ['#16A34A', '#DC2626']
          }
        ]
      }
    });
  }
}
