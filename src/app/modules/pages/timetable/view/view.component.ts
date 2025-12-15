import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-view',
  standalone: false,
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss'
})
export class ViewComponent {
  showUpload = false;

  periods = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

  timetable = {
    id: 'TT-001',
    program: 'JEE 2026',
    batch: 'JEE 2026 - Phase 1',
    centre: 'Gandhipuram Center',
    validFrom: '2025-01-01',
    validTo: '2025-06-30',
    version: 2,

    schedule: [
      {
        day: 'Monday',
        periods: [
          { subject: 'Physics', faculty: 'Sivakumar', room: 'A1' },
          { subject: 'Chemistry', faculty: 'Priya', room: 'B1' },
          { subject: 'Maths', faculty: 'Vignesh', room: 'C1' },
          { subject: 'Physics', faculty: 'Sivakumar', room: 'A1' },
          { subject: 'Maths', faculty: 'Vignesh', room: 'C1' },
          { subject: 'Chemistry', faculty: 'Priya', room: 'B1' }
        ]
      },
      {
        day: 'Tuesday',
        periods: [
          { subject: 'Maths', faculty: 'Vignesh', room: 'C1' },
          { subject: 'Physics', faculty: 'Sivakumar', room: 'A1' },
          { subject: 'Chemistry', faculty: 'Priya', room: 'B1' },
          { subject: 'Maths', faculty: 'Vignesh', room: 'C1' },
          { subject: 'Physics', faculty: 'Sivakumar', room: 'A1' },
          { subject: 'Chemistry', faculty: 'Priya', room: 'B1' }
        ]
      }
    ]
  };

  constructor(private router: Router) {}

  back(): void {
    this.router.navigate(['/app/timetable']);
  }

  openUpload(): void {
    this.showUpload = true;
    document.body.classList.add('modal-open');
  }

  closeUpload(): void {
    this.showUpload = false;
    document.body.classList.remove('modal-open');
  }

  upload(): void {
    // TODO: upload & parse excel
    alert('Uploaded (dummy)');
    this.closeUpload();
  }
}
