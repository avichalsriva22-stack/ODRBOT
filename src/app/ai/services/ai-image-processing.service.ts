/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Injectable } from '@angular/core';
import { AiImageAttachment } from '../models/ai-message.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable({ providedIn: 'root' })
export class AiImageProcessingService {

	/** Downscale + compress before sending — keeps token cost and IPC payload size sane. */
	async prepareForUpload(file: File): Promise<AiImageAttachment> {
		if (file.size > 10 * 1024 * 1024) {
			throw new Error(`File ${file.name} exceeds the 10MB limit.`);
		}

		const bitmap = await createImageBitmap(file);

		const MAX_DIM = 1568; // Anthropic's documented long-edge recommendation for image inputs
		const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
		const targetW = Math.round(bitmap.width * scale);
		const targetH = Math.round(bitmap.height * scale);

		const canvas = document.createElement('canvas');
		canvas.width = targetW;
		canvas.height = targetH;
		canvas.getContext('2d')!.drawImage(bitmap, 0, 0, targetW, targetH);

		const blob: Blob = await new Promise((resolve, reject) => {
			canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/jpeg', 0.85);
		});
		
		const base64 = await this.blobToBase64(blob);
		// Remove data URL prefix
		const cleanBase64 = base64.replace(/^data:image\/[a-z]+;base64,/, '');

		return {
			id: uuidv4(),
			base64: cleanBase64,
			mediaType: 'image/jpeg',
			fileName: file.name,
			widthPx: targetW,
			heightPx: targetH,
		};
	}

	private blobToBase64(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}
}
