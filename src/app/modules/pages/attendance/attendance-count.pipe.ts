import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'presentCount', standalone: false })
export class PresentCountPipe implements PipeTransform {
  transform(students: any[]): number {
    return (students || []).filter(s => s.status === 'PRESENT').length;
  }
}

@Pipe({ name: 'absentCount', standalone: false })
export class AbsentCountPipe implements PipeTransform {
  transform(students: any[]): number {
    return (students || []).filter(s => s.status === 'ABSENT').length;
  }
}

@Pipe({ name: 'absentStudentsFilter', standalone: false })
export class AbsentStudentsFilterPipe implements PipeTransform {
  transform(students: any[]): any[] {
    return (students || []).filter(s => s.status === 'ABSENT');
  }
}

@Pipe({ name: 'notMarkedCount', standalone: false })
export class NotMarkedCountPipe implements PipeTransform {
  transform(students: any[]): number {
    return (students || []).filter(s => s.status === 'NOT_MARKED').length;
  }
}
