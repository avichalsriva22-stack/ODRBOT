import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AiPreviewService {

	private pendingConfirmations = new Map<string, { resolve: (val: boolean) => void, timeoutId: any }>();

	/**
	 * Pauses execution until the user clicks Confirm or Cancel on the tool preview UI.
	 * @param toolUseId The id of the tool call awaiting confirmation.
	 * @returns True if the user confirmed the action, false if rejected or timed out.
	 */
	async awaitUserConfirmation(toolUseId: string): Promise<boolean> {
		return new Promise<boolean>(resolve => {
			const timeoutId = setTimeout(() => {
				if (this.pendingConfirmations.has(toolUseId)) {
					this.pendingConfirmations.get(toolUseId)!.resolve(false);
					this.pendingConfirmations.delete(toolUseId);
				}
			}, 300000); // 5 minutes

			this.pendingConfirmations.set(toolUseId, { resolve, timeoutId });
		});
	}

	confirm(toolUseId: string): void {
		if (this.pendingConfirmations.has(toolUseId)) {
			const pending = this.pendingConfirmations.get(toolUseId)!;
			clearTimeout(pending.timeoutId);
			pending.resolve(true);
			this.pendingConfirmations.delete(toolUseId);
		}
	}

	reject(toolUseId: string): void {
		if (this.pendingConfirmations.has(toolUseId)) {
			const pending = this.pendingConfirmations.get(toolUseId)!;
			clearTimeout(pending.timeoutId);
			pending.resolve(false);
			this.pendingConfirmations.delete(toolUseId);
		}
	}
}
