import { Component, Input } from '@angular/core';
import { AiToolPreviewResult } from '../../models/ai-tool.model';

@Component({
	selector: 'app-ai-diff-preview',
	template: `
		<div class="diff-container" *ngIf="preview">
			<div class="diff-desc">{{ preview.description }}</div>
			
			<div *ngIf="preview.irreversibleWarning" class="diff-warning">
				<mat-icon>warning</mat-icon>
				<span>{{ preview.irreversibleWarning }}</span>
			</div>

			<table class="diff-table" *ngIf="preview.diff?.length">
				<thead>
					<tr>
						<th>Field</th>
						<th>Before</th>
						<th>After</th>
					</tr>
				</thead>
				<tbody>
					<tr *ngFor="let row of preview.diff">
						<td class="diff-field">{{ row.field }}</td>
						<td class="diff-before" [class.empty]="row.before === null">{{ row.before !== null ? row.before : '-' }}</td>
						<td class="diff-after" [class.empty]="row.after === null">{{ row.after !== null ? row.after : '-' }}</td>
					</tr>
				</tbody>
			</table>
		</div>
	`,
	styles: [`
		.diff-container {
			background: #2a2a2a;
			border: 1px solid #444;
			border-radius: 4px;
			padding: 8px;
			margin-top: 8px;
			font-size: 12px;
		}
		.diff-desc {
			color: #eee;
			margin-bottom: 8px;
		}
		.diff-warning {
			display: flex;
			align-items: center;
			color: #ffb74d;
			background: rgba(255, 183, 77, 0.1);
			padding: 4px 8px;
			border-radius: 4px;
			margin-bottom: 8px;
		}
		.diff-warning mat-icon {
			font-size: 16px;
			width: 16px;
			height: 16px;
			margin-right: 4px;
		}
		.diff-table {
			width: 100%;
			border-collapse: collapse;
		}
		.diff-table th, .diff-table td {
			border: 1px solid #444;
			padding: 4px;
			text-align: left;
		}
		.diff-table th {
			background: #333;
			color: #aaa;
			font-weight: 500;
		}
		.diff-before {
			color: #ef5350;
			background: rgba(239, 83, 80, 0.1);
		}
		.diff-after {
			color: #66bb6a;
			background: rgba(102, 187, 106, 0.1);
		}
		.empty {
			color: #666;
			background: transparent;
			font-style: italic;
		}
	`]
})
export class AiDiffPreviewComponent {
	@Input() preview!: AiToolPreviewResult;
}
