import { ExportFieldGroup } from '../../../ui-elements/elements/export-field-picker/export-field-picker.component';

// Mirrors the field list accepted by POST /api/crm/student/export.
// Array fields (ayHistory, boardExams) are intentionally left out — they
// don't map cleanly to a single Excel cell.
export const STUDENT_EXPORT_FIELD_GROUPS: ExportFieldGroup[] = [
  {
    title: 'Basic Info',
    fields: [
      { key: 'admissionNo', label: 'Enrollment No', locked: true },
      { key: 'registrationNumber', label: 'Registration Number' },
      { key: 'portalStudentId', label: 'Portal Student ID' },
      { key: 'studentSchoolId', label: 'Student School ID' },
      { key: 'status', label: 'Status' },
      { key: 'isTabletBlocked', label: 'Tablet Blocked' },
      { key: 'batchRemovalRemarks', label: 'Batch Removal Remarks' },
      { key: 'createdAt', label: 'Created At' },
      { key: 'updatedAt', label: 'Updated At' },
    ],
  },
  {
    title: 'Contact',
    fields: [
      { key: 'student.name', label: 'Name' },
      { key: 'student.phone', label: 'Phone' },
      { key: 'student.phone1', label: 'Phone 1' },
      { key: 'student.phone2', label: 'Phone 2' },
      { key: 'student.email', label: 'Email' },
      { key: 'student.email1', label: 'Email 1' },
      { key: 'student.email2', label: 'Email 2' },
      { key: 'student.parentName', label: 'Parent Name' },
      { key: 'student.parentPhone', label: 'Parent Phone' },
      { key: 'student.address', label: 'Address' },
      { key: 'student.city', label: 'City' },
      { key: 'student.state', label: 'State' },
      { key: 'student.pincode', label: 'Pincode' },
    ],
  },
  {
    title: 'Academic',
    fields: [
      { key: 'academicYear', label: 'Academic Year' },
      { key: 'currentAcademicYear', label: 'Current Academic Year' },
      { key: 'programId', label: 'Program ID' },
      { key: 'programCode', label: 'Program Code' },
      { key: 'programName', label: 'Program Name' },
      { key: 'centerId', label: 'Center ID' },
      { key: 'centerCode', label: 'Center Code' },
      { key: 'centerName', label: 'Center Name' },
      { key: 'batchId', label: 'Batch ID' },
      { key: 'batchCode', label: 'Batch Code' },
      { key: 'courseStartYear', label: 'Course Start Year' },
      { key: 'yearNo', label: 'Year No' },
      { key: 'classNo', label: 'Class No' },
    ],
  },
];
