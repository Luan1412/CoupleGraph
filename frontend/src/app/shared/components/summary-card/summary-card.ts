import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common'; 

@Component({
  selector: 'app-summary-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './summary-card.html',
  styleUrl: './summary-card.scss'
})
export class SummaryCard {
  @Input() title: string = '';
  @Input() value: string = '';
  @Input() icon: string = '';
  @Input() subtitle?: string; 
  @Input() highlight: boolean = false; 
  @Input() iconBgClass: string = 'bg-green-light'; 
}