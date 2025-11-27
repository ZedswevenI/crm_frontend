import { Component, Input, Output, EventEmitter, forwardRef, ViewChild, ElementRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, AbstractControl } from '@angular/forms';

@Component({
  selector: 'taginput',
  standalone: false,
  templateUrl: './taginput.component.html',
  styleUrl: './taginput.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TaginputComponent),
      multi: true
    }
  ]
})
export class TaginputComponent implements ControlValueAccessor {
  @Input() label: string = '';
  @Input() placeholder: string = 'Add tags...';
  @Input() required: boolean = false;
  @Input() control: AbstractControl | null = null;
  @Input() disabled: boolean = false;
  @Output() tagsChange = new EventEmitter<string[]>();
  @ViewChild('tagInput') tagInputRef!: ElementRef<HTMLInputElement>;

  tags: string[] = [];
  inputValue: string = '';

  onChange = (_: any) => {};
  onTouched = () => {};

  writeValue(value: any): void {
    this.tags = Array.isArray(value) ? value : [];
  }
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  onInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
      event.preventDefault();
      this.addTagFromInput();
    } else if (event.key === 'Backspace' && !this.inputValue && this.tags.length) {
      this.removeTag(this.tags.length - 1);
    }
  }

  addTagFromInput() {
    const tag = this.inputValue.trim();
    if (tag && !this.tags.includes(tag)) {
      this.tags.push(tag);
      this.emitChanges();
    }
    this.inputValue = '';
  }

  removeTag(index: number) {
    this.tags.splice(index, 1);
    this.emitChanges();
  }

  emitChanges() {
    this.onChange(this.tags);
    this.tagsChange.emit(this.tags);
  }

  focusInput() {
    if (this.tagInputRef) this.tagInputRef.nativeElement.focus();
  }
}
