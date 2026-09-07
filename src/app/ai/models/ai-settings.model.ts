/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

export interface AiSettings {
	provider: 'anthropic' | 'openrouter';
	openRouterModel: string;
	/** Never holds the raw key — only whether one is configured. Raw key lives in Electron safeStorage, see doc 07. */
	apiKeyConfigured: boolean;
	model: AiModelId;
	/** Soft cap on tool round-trips per user message (doc 06 §4). */
	maxToolRoundTrips: number;
	/** User-level opt-in: whether Tier 2/3 (spatial/destructive) tools are enabled at all. Default false until doc 09 ships. */
	advancedToolsEnabled: boolean;
	planStepConfirmationPolicy: 'batch' | 'always_confirm_creates';
}

export type AiModelId = 'claude-sonnet-5' | 'claude-opus-4-8' | 'claude-haiku-4-5-20251001';

export const DEFAULT_AI_SETTINGS: AiSettings = {
	provider: 'anthropic',
	openRouterModel: 'google/gemini-2.5-flash',
	apiKeyConfigured: false,
	model: 'claude-sonnet-5',
	maxToolRoundTrips: 8,
	advancedToolsEnabled: false,
	planStepConfirmationPolicy: 'batch',
};
