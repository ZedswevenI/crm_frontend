import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, AbstractControl } from '@angular/forms';

@Component({
  selector: 'importfiles',
  standalone: false,
  templateUrl: './importfiles.component.html',
  styleUrl: './importfiles.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ImportfilesComponent),
      multi: true
    }
  ]
})
export class ImportfilesComponent implements ControlValueAccessor {
  @Input() label: string = '';
  @Input() required: boolean = false;
  @Input() multiple: boolean = false;
  @Input() accept: string = '*/*';
  @Input() control: AbstractControl | null = null;
  @Input() id: string = 'fileInput';

  @Output() filesChanged = new EventEmitter<File[]>();

  files: File[] = [];

  onChange = (_: any) => { };
  onTouched = () => { };

  writeValue(obj: any): void {
    this.files = Array.isArray(obj) ? obj : [];
  }
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  // onFileChange(event: any) {
  //   const selectedFiles: FileList = event.target.files;
  //   this.files = Array.from(selectedFiles);
  //   this.onChange(this.multiple ? this.files : this.files[0]);
  //   this.filesChanged.emit(selectedFiles);
  //   this.onTouched();
  // }

  // removeFile(index: number) {
  //   this.files.splice(index, 1);
  //   this.onChange(this.multiple ? this.files : this.files[0] || null);
  // }

  maxFileSize = 20 * 1024 * 1024; // 20MB in bytes
  allowedExtensions = [
    '.pdf',
    '.jpg',
    '.jpeg',
    '.png',
    '.svg',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx'
  ];
  onFilesSelected(event: any) {
    const file: File = event.target.files[0];

    if (!file) return;

    // ✅ Check by extension
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!this.allowedExtensions.includes(fileExtension)) {
      alert(`Invalid file format: ${fileExtension}. Allowed formats: ${this.allowedExtensions.join(', ')}`);
      return;
    }

    // ✅ Check by MIME type
    if (!this.allowedExtensions.includes(file.type)) {
      alert(`Invalid MIME type: ${file.type}`);
      return;
    }

    console.log('Valid file:', file);
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const selectedFiles: File[] = Array.from(input.files);
    const validFiles: File[] = [];

    for (let file of selectedFiles) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!this.allowedExtensions.includes(ext)) {
        alert(`❌ Invalid file format: ${file.name}`);
        continue;
      }
      if (file.size > this.maxFileSize) {
        alert(`❌ File too large (max 20MB): ${file.name}`);
        continue;
      }
      validFiles.push(file);
    }

    this.files = this.multiple ? [...this.files, ...validFiles] : validFiles.slice(0, 1);

    // Update form control
    const valueToEmit = this.multiple ? this.files : this.files[0] || null;
    if (this.control) {
      this.control.setValue(valueToEmit);
      this.control.markAsTouched();
    }

    this.onChange(valueToEmit);
    this.filesChanged.emit(this.files);
    this.onTouched();
  }

  removeFile(index: number) {
    this.files.splice(index, 1);
    if (this.control) this.control.setValue(this.files);
  }

}
