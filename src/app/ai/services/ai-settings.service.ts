/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AiSettings, AiModelId, DEFAULT_AI_SETTINGS } from '../models/ai-settings.model';

/**
 * AiSettingsService (doc 07 §6).
 *
 * Wraps `window.aiBridge.setApiKey/hasApiKey/clearApiKey` and exposes
 * `AiSettings.apiKeyConfigured` reactively.
 *
 * The raw key value is WRITE-ONLY from the renderer's perspective — there
 * is no `getApiKey()` on the bridge at all, by design, so it's structurally
 * impossible for renderer code to read the key back out.
 */
@Injectable( { providedIn: 'root' } )
export class AiSettingsService {

	private settings$ = new BehaviorSubject<AiSettings>( { ...DEFAULT_AI_SETTINGS } );

	readonly settings: Observable<AiSettings> = this.settings$.asObservable();

	get current (): AiSettings {
		return this.settings$.value;
	}

	/** Call once on app startup to check if a key is already configured. */
	async initialize (): Promise<void> {
		if ( this.isBridgeAvailable() ) {
			const hasKey = await window.aiBridge.hasApiKey(this.current.provider);
			this.updateSettings( { apiKeyConfigured: hasKey } );
		}
	}

	async setApiKey ( key: string ): Promise<void> {
		if ( !this.isBridgeAvailable() ) {
			throw new Error( 'AI bridge not available — running outside Electron?' );
		}
		await window.aiBridge.setApiKey( this.current.provider, key );
		this.updateSettings( { apiKeyConfigured: true } );
	}

	async hasApiKey (): Promise<boolean> {
		if ( !this.isBridgeAvailable() ) return false;
		return window.aiBridge.hasApiKey(this.current.provider);
	}

	async clearApiKey (): Promise<void> {
		if ( !this.isBridgeAvailable() ) {
			throw new Error( 'AI bridge not available — running outside Electron?' );
		}
		await window.aiBridge.clearApiKey(this.current.provider);
		this.updateSettings( { apiKeyConfigured: false } );
	}

	async setProvider ( provider: 'anthropic' | 'openrouter' ): Promise<void> {
		this.updateSettings( { provider } );
		if ( this.isBridgeAvailable() ) {
			const hasKey = await window.aiBridge.hasApiKey(provider);
			this.updateSettings( { apiKeyConfigured: hasKey } );
		}
	}

	setOpenRouterModel ( openRouterModel: string = 'google/gemini-2.0-flash-001' ): void {
		this.updateSettings( { openRouterModel } );
	}

	setModel ( model: AiModelId ): void {
		this.updateSettings( { model } );
	}

	setMaxToolRoundTrips ( max: number ): void {
		this.updateSettings( { maxToolRoundTrips: max } );
	}

	setAdvancedToolsEnabled ( enabled: boolean ): void {
		this.updateSettings( { advancedToolsEnabled: enabled } );
	}

	private updateSettings ( partial: Partial<AiSettings> ): void {
		this.settings$.next( { ...this.settings$.value, ...partial } );
	}

	private isBridgeAvailable (): boolean {
		return typeof window !== 'undefined' && !!window.aiBridge;
	}
}
