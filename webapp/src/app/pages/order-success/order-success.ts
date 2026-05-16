import { Component, inject, OnInit, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [NgIf, RouterLink, ButtonModule],
  templateUrl: './order-success.html',
  styleUrl: './order-success.css'
})
export class OrderSuccessComponent implements OnInit {
  route = inject(ActivatedRoute);
  orderNo = signal('');

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['order']) {
        this.orderNo.set(params['order']);
      }
    });
  }
}
