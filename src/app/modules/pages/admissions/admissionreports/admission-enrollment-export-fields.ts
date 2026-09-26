import { ExportFieldGroup } from '../../../ui-elements/elements/export-field-picker/export-field-picker.component';

// Mirrors the field list accepted by POST /api/crm/reports/admission/enrollment
// (StudentProfile records — dotted paths under `student.*` are supported).
export const ENROLLMENT_EXPORT_FIELD_GROUPS: ExportFieldGroup[] = [
  {
    title: 'Basic',
    fields: [
      { key: 'admissionNo', label: 'Enrollment No', locked: true },
      { key: 'courseStartYear', label: 'Course Start Year' },
      { key: 'academicYear', label: 'Academic Year' },
      { key: 'programId', label: 'Program ID' },
      { key: 'programCode', label: 'Program Code' },
      { key: 'programName', label: 'Program Name' },
      { key: 'centerId', label: 'Center ID' },
      { key: 'centerCode', label: 'Center Code' },
      { key: 'batchId', label: 'Batch ID' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Created At' },
    ],
  },
  {
    title: 'Student Contact',
    fields: [
      { key: 'student.name', label: 'Name' },
      { key: 'student.email', label: 'Email' },
      { key: 'student.phone', label: 'Phone' },
      { key: 'student.dateOfBirth', label: 'Date of Birth' },
      { key: 'student.gender', label: 'Gender' },
      { key: 'student.fatherName', label: "Father's Name" },
      { key: 'student.motherName', label: "Mother's Name" },
      { key: 'student.address', label: 'Address' },
      { key: 'student.city', label: 'City' },
      { key: 'student.state', label: 'State' },
      { key: 'student.pincode', label: 'Pincode' },
    ],
  },
];
