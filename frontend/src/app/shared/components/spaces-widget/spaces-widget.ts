import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-spaces-widget',
  standalone: true,
  templateUrl: './spaces-widget.html',
  styleUrl: './spaces-widget.scss'
})
export class SpacesWidget {
  @Input() espacos: any[] = [];
}