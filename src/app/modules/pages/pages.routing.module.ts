import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'dashboard',
    loadChildren: () => import('./dashboard/dashboard.module').then(m => m.DashboardModule)
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
  },
  {
    path: 'admissions',
    loadChildren: () => import('./admissions/admissions.module').then(m => m.AdmissionsModule)
  },
  {
    path: 'fees',
    loadChildren: () => import('./fees/fees.module').then(m => m.FeesModule)
  },
  {
    path: 'attendance',
    loadChildren: () => import('./attendence/attendence.module').then(m => m.AttendenceModule)
  },
  {
    path: 'batches',
    loadChildren: () => import('./batch/batch.module').then(m => m.BatchModule)
  },
  {
    path: 'classes',
    loadChildren: () => import('./classes/classes.module').then(m => m.ClassesModule)
  },
  {
    path: 'enrollment',
    loadChildren: () => import('./enrollment/enrollment.module').then(m => m.EnrollmentModule)
  },
  {
    path: 'exams',
    loadChildren: () => import('./exam/exam.module').then(m => m.ExamModule)
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./faculty/faculty.module').then(m => m.FacultyModule)
  },
  {
    path: 'students',
    loadChildren: () => import('./students/students.module').then(m => m.StudentsModule)
  },
  {
    path: 'timetable',
    loadChildren: () => import('./timetable/timetable.module').then(m => m.TimetableModule)
  },
  {
    path: 'faculty-assignment',
    loadChildren: () => import('./faculty/faculty.module').then(m => m.FacultyModule)
  },
  {
    path: 'feedback',
    loadChildren: () => import('./feedback/feedback.module').then(m => m.FeedbackModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PagesRoutingModule {}
