import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';

type Status = 'Active' | 'Completed' | 'Dropout';

interface StudentDetail {
  basic: {
    id: number;
    name: string;
    enrolmentNo: string;
    status: Status;
    mobile: string;
    email: string;
    parentName: string;
    parentMobile: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  program: {
    programName: string;
    stream: string;
    duration: string;
    batchName: string;
    center: string;
    joiningDate: Date;
    mentorName: string;
  };
  attendance: {
    overallPct: number;
    lastSessions: { date: Date; session: string; status: 'Present' | 'Absent' }[];
  };
  assignments: {
    completed: number;
    total: number;
    items: { title: string; subject: string; dueDate: Date; status: 'Submitted' | 'Pending' | 'Overdue' }[];
  };
  exams: {
    averageScore: number;
    items: { name: string; date: Date; score: number; result: 'Pass' | 'Fail' }[];
  };
  fees: {
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    receipts: { receiptNo: string; date: Date; mode: string; amount: number; remarks?: string }[];
  };
}

@Component({
  selector: 'app-studentsview',
  standalone: false,
  templateUrl: './studentsview.component.html',
  styleUrl: './studentsview.component.scss'
})
export class StudentsviewComponent implements OnInit {
  student: StudentDetail | null = null;

  tabs = [
    { key: 'program',     label: 'Program' },
    { key: 'attendance',  label: 'Attendance' },
    { key: 'assignments', label: 'Assignments' },
    { key: 'exams',       label: 'Exam Results' },
    { key: 'fees',        label: 'Fees' }
  ];
  activeTab: string = 'program';

  constructor(
    private route: ActivatedRoute,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService
  ) {
    this.breadcrumb.set([
      { label: 'Students', link: '/app/students' },
      { label: 'Student Detail' }
    ]);
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? +idParam : 1;

    // For now using dummy data – later replace with API
    this.student = this.buildDummyStudent(id);
  }

  buildDummyStudent(id: number): StudentDetail {
    return {
      basic: {
        id,
        name: 'Arjun R',
        enrolmentNo: 'Z7I-JEE-2025-001',
        status: 'Active',
        mobile: '9000000001',
        email: 'arjun.r@z7iinstitute.com',
        parentName: 'Ramesh Kumar',
        parentMobile: '9888888888',
        addressLine1: '12, ABC Apartments',
        addressLine2: 'Near XYZ Signal',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
        pincode: '641004'
      },
      program: {
        programName: 'JEE 2 Year Classroom',
        stream: 'JEE',
        duration: '2 Years',
        batchName: 'JEE-2025-A',
        center: 'Gandhipuram Center',
        joiningDate: new Date(2024, 4, 10),
        mentorName: 'Arun Kumar'
      },
      attendance: {
        overallPct: 94,
        lastSessions: [
          { date: new Date(2025, 1, 10), session: 'Physics - Kinematics', status: 'Present' },
          { date: new Date(2025, 1, 9),  session: 'Maths - Quadratic',    status: 'Present' },
          { date: new Date(2025, 1, 8),  session: 'Chemistry - Thermo',   status: 'Absent' }
        ]
      },
      assignments: {
        completed: 12,
        total: 15,
        items: [
          { title: 'Physics Worksheet 5', subject: 'Physics',    dueDate: new Date(2025, 1, 12), status: 'Submitted' },
          { title: 'Maths Worksheet 4',   subject: 'Mathematics', dueDate: new Date(2025, 1, 11), status: 'Pending' },
          { title: 'Chemistry Test Prep', subject: 'Chemistry',  dueDate: new Date(2025, 1, 9),  status: 'Overdue' }
        ]
      },
      exams: {
        averageScore: 82,
        items: [
          { name: 'JEE Weekly Test 1', date: new Date(2025, 0, 25), score: 78, result: 'Pass' },
          { name: 'JEE Weekly Test 2', date: new Date(2025, 1, 1),  score: 86, result: 'Pass' }
        ]
      },
      fees: {
        totalAmount: 120000,
        paidAmount: 90000,
        outstandingAmount: 30000,
        receipts: [
          { receiptNo: 'RCPT-001', date: new Date(2024, 4, 15), mode: 'Online', amount: 50000, remarks: 'Admission' },
          { receiptNo: 'RCPT-002', date: new Date(2024, 7, 15), mode: 'Cheque', amount: 40000, remarks: '2nd Installment' }
        ]
      }
    };
  }

  setTab(key: string): void {
    this.activeTab = key;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    const first = parts[0]?.[0] ?? '';
    const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  editStudent(): void {
    this.alertService.success('Student edit flow will be implemented later.');
  }
}