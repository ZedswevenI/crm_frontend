import { Component, Output, EventEmitter, Input } from '@angular/core';

@Component({
  selector: 'delete',
  standalone: false,
  templateUrl: './commondelete.component.html',
  styleUrl: './commondelete.component.scss'
})
export class CommondeleteComponent {
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() visible = false;
  @Output() closed = new EventEmitter<boolean>();
  @Output() visibleChange = new EventEmitter<boolean>();

  open(message?: string, title?: string) {
    if (message) this.message = message;
    if (title) this.title = title;
    this.visible = true;
    document.body.classList.add('modal-open');
  }

  close(result: boolean) {
    this.visible = false;
    document.body.classList.remove('modal-open');
    this.closed.emit(result);
  }
}
