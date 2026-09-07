/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AiToolPreviewResult } from './ai-tool.model';

export type AiRole = 'user' | 'assistant' | 'system';

export interface AiChatMessage {
	id: string;                 // uuid
	role: AiRole;
	text: string;                // rendered markdown-lite (see doc 08 §5 for allowed subset)
	createdAt: number;           // epoch ms
	toolCalls?: AiToolCallRecord[];
	/** Present while a message is still streaming in. */
	streaming?: boolean;
	images?: AiImageAttachment[];
	/** Present if this assistant turn failed (network/API/tool error). */
	error?: AiChatError;
	planId?: string;
}

export interface AiToolCallRecord {
	id: string;                  // Anthropic tool_use id, or generated uuid for local tracking
	toolName: string;
	args: Record<string, any>;
	status: 'pending_preview' | 'pending_confirmation' | 'running' | 'succeeded' | 'failed' | 'rejected';
	summary?: string;             // set on success
	errorMessage?: string;        // set on failure
	preview?: AiToolPreviewResult;
	createdCommandIds?: string[]; // ids into CommandHistory, for debugging/telemetry only
}

export interface AiImageAttachment {
	id: string;
	base64: string;
	mediaType: 'image/png' | 'image/jpeg' | 'image/webp';
	fileName: string;
	widthPx: number;
	heightPx: number;
}

export type AiApiContentBlock =
	| { type: 'text'; text: string }
	| { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
	| { type: 'tool_use'; id: string; name: string; input: Record<string, any> }
	| { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface AiChatError {
	kind: 'network' | 'auth' | 'rate_limit' | 'invalid_tool_args' | 'unknown';
	message: string;
	retryable: boolean;
}

// ─── Error taxonomy (doc 02 §6) ──────────────────────────────────────

/** Common base for all AI-subsystem errors. */
export class AiError extends Error {
	readonly code: string;
	constructor ( message: string, code: string ) {
		super( message );
		this.name = 'AiError';
		this.code = code;
	}
}

/** Thrown by AiCommandService.execute() when ICommand.execute() throws. */
export class AiToolExecutionError extends AiError {
	constructor ( message: string ) {
		super( message, 'TOOL_EXECUTION_ERROR' );
		this.name = 'AiToolExecutionError';
	}
}

/** Thrown by AiLlmClientService on network/IPC failure. */
export class AiLlmTransportError extends AiError {
	constructor ( message: string ) {
		super( message, 'LLM_TRANSPORT_ERROR' );
		this.name = 'AiLlmTransportError';
	}
}

/** Thrown by AiLlmClientService on non-2xx from Anthropic. */
export class AiLlmApiError extends AiError {
	readonly status: number;
	readonly errorKind: AiChatError['kind'];
	constructor ( message: string, status: number, kind: AiChatError['kind'] ) {
		super( message, 'LLM_API_ERROR' );
		this.name = 'AiLlmApiError';
		this.status = status;
		this.errorKind = kind;
	}
}

/** Thrown by AiToolRegistry when the LLM requests an unknown tool name. */
export class AiToolRegistryError extends AiError {
	constructor ( message: string ) {
		super( message, 'TOOL_REGISTRY_ERROR' );
		this.name = 'AiToolRegistryError';
	}
}
