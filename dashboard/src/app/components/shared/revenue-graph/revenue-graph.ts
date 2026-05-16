import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-revenue-graph',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="graph-wrapper" *ngIf="data().length > 0; else noData">
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none">
        <!-- Area under the line -->
        <path [attr.d]="areaPath()" fill="rgba(55, 125, 255, 0.1)" />
        
        <!-- Main Line -->
        <path [attr.d]="linePath()" fill="none" stroke="#377dff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

        <!-- Data Points (Dots) -->
        <circle *ngFor="let point of points(); let i = index"
                [attr.cx]="point.x" 
                [attr.cy]="point.y"
                r="4"
                [attr.fill]="hoveredIndex() === i ? '#fff' : '#377dff'"
                [attr.stroke]="hoveredIndex() === i ? '#377dff' : 'none'"
                stroke-width="2"
                (mouseenter)="hoveredIndex.set(i)"
                (mouseleave)="hoveredIndex.set(-1)">
        </circle>

        <!-- X-Axis Labels -->
        <text *ngFor="let label of xLabels()"
              [attr.x]="label.x" 
              [attr.y]="height - 5" 
              text-anchor="middle"
              fill="#9b9b9b" 
              font-size="10"
              font-weight="600">
          {{ label.text }}
        </text>
      </svg>
      
      <!-- Tooltip -->
      <div class="yelo-tooltip" *ngIf="hoveredIndex() !== -1" 
           [style.left.px]="points()[hoveredIndex()].x"
           [style.top.px]="points()[hoveredIndex()].y - 45">
        <span class="tooltip-date">{{ points()[hoveredIndex()].label }}</span>
        <span class="tooltip-value">₹{{ points()[hoveredIndex()].value | number:'1.0-0' }}</span>
      </div>
    </div>
    <ng-template #noData>
      <div class="no-data-msg">
        <i class="pi pi-chart-line" style="font-size: 2rem; margin-bottom: 12px; opacity: 0.3;"></i>
        <span>No trend data available</span>
      </div>
    </ng-template>
  `,
  styles: [`
    .graph-wrapper {
      position: relative;
      width: 100%;
      height: 250px;
      padding: 20px 0;
    }
    svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .yelo-tooltip {
      position: absolute;
      transform: translateX(-50%);
      background: #212529;
      color: #fff;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 10;
      box-shadow: 0 4px 15px rgba(0,0,0,0.15);
    }
    .tooltip-date { opacity: 0.7; font-size: 10px; margin-bottom: 2px; }
    .tooltip-value { font-weight: 700; }
    .no-data-msg {
      height: 250px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #9b9b9b;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px dashed #eaedf3;
      font-weight: 600;
    }
    circle { cursor: pointer; transition: r 0.2s ease; }
    circle:hover { r: 6; }
  `]
})
export class RevenueGraphComponent {
  @Input({ required: true }) set rawData(val: any[]) {
    this.data.set(val || []);
  }

  data = signal<any[]>([]);
  hoveredIndex = signal(-1);

  width = 800;
  height = 250;
  paddingX = 50;
  paddingY = 40;

  points = computed(() => {
    const d = this.data();
    if (d.length === 0) return [];
    
    const maxVal = Math.max(...d.map((i: any) => i.value), 10);
    const chartHeight = this.height - (this.paddingY * 2);
    const chartWidth = this.width - (this.paddingX * 2);
    
    return d.map((item: any, i: number) => {
      const x = this.paddingX + (i * (chartWidth / Math.max(1, d.length - 1)));
      const y = this.height - this.paddingY - ((item.value / maxVal) * chartHeight);
      return { x, y, value: item.value, label: item.label };
    });
  });

  linePath = computed(() => {
    const pts = this.points();
    if (pts.length === 0) return '';
    return pts.reduce((path, p, i) => i === 0 ? `M ${p.x},${p.y}` : `${path} L ${p.x},${p.y}`, '');
  });

  areaPath = computed(() => {
    const pts = this.points();
    if (pts.length === 0) return '';
    const first = pts[0];
    const last = pts[pts.length - 1];
    const baseline = this.height - this.paddingY;
    
    let path = `M ${first.x},${baseline} L ${first.x},${first.y}`;
    pts.forEach((p, i) => { if (i > 0) path += ` L ${p.x},${p.y}`; });
    path += ` L ${last.x},${baseline} Z`;
    return path;
  });

  xLabels = computed(() => {
    const d = this.data();
    if (d.length === 0) return [];
    
    const pts = this.points();
    const step = Math.max(1, Math.floor(d.length / 8));
    const labels = [];
    
    for (let i = 0; i < d.length; i += step) {
      if (pts[i]) {
        labels.push({
          x: pts[i].x,
          text: d[i].label.split('-').slice(-2).join('/')
        });
      }
    }
    return labels;
  });
}
