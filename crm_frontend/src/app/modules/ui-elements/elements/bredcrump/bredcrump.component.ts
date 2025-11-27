import { Component } from '@angular/core';
import { BredcrumpService, BreadcrumbItem } from '../../../../service/bredcrump/bredcrump.service';
// import { ThemeService } from '../../../../sevices/theme/theme.service';

@Component({
  selector: 'app-bredcrump',
  standalone: false,
  templateUrl: './bredcrump.component.html',
  styleUrl: './bredcrump.component.scss'
})
export class BredcrumpComponent {
  items: BreadcrumbItem[] = [];
  isDarkMode = false;

  constructor(private BredcrumpService: BredcrumpService) {
    this.BredcrumpService.items$.subscribe((items) => (this.items = items));
  }

  //  ngOnInit(): void {
  //   this.themeService.isDarkMode$.subscribe(mode => {
  //     this.isDarkMode = mode;
  //   });
  // }
}
