/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Injectable, InjectionToken } from '@angular/core';
import { AiChatMessage } from '../models/ai-message.model';

/**
 * Persistence extension point (doc 02 §5).
 * Not implemented in v1 — interface reserved for future file-backed store.
 * Swapping in a real implementation is a one-line DI change.
 */
export interface AiTranscriptStore {
	save( projectId: string, messages: AiChatMessage[] ): Promise<void>;
	load( projectId: string ): Promise<AiChatMessage[]>;
}

export const AI_TRANSCRIPT_STORE = new InjectionToken<AiTranscriptStore>( 'AI_TRANSCRIPT_STORE' );

/**
 * In-memory no-op implementation for v1.
 * Satisfies the interface so AiConversationService can depend on the token
 * without requiring persistence to ship.
 */
@Injectable()
export class InMemoryTranscriptStore implements AiTranscriptStore {

	private store = new Map<string, AiChatMessage[]>();

	async save ( projectId: string, messages: AiChatMessage[] ): Promise<void> {
		this.store.set( projectId, [ ...messages ] );
	}

	async load ( projectId: string ): Promise<AiChatMessage[]> {
		return this.store.get( projectId ) || [];
	}

}
