import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, AbstractControl } from '@angular/forms';

@Component({
  selector: 'doceditor',
  standalone: false,
  templateUrl: './doceditor.component.html',
  styleUrl: './doceditor.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DoceditorComponent),
      multi: true
    }
  ]
})
export class DoceditorComponent implements ControlValueAccessor {
  @Input() label: string = '';
  @Input() required: boolean = false;
  @Input() placeholder: string = '';
  @Input() control: AbstractControl | null = null;
  @Input() id: string = 'quillEditor';

  value: any = '';
  onChange = (_: any) => {};
  onTouched = () => {};

  writeValue(obj: any): void {
    this.value = obj || '';
  }
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  onEditorChanged(content: any) {
    this.value = content.html;
    this.onChange(this.value);
  }
}
