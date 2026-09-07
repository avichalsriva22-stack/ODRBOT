# 07 — Electron Security and IPC

## 1. Threat model / principle

The Anthropic API key must **never** be readable from the renderer process's
JS heap, DevTools console, or `localStorage`/`sessionStorage`. It is stored
encrypted at rest and only ever used inside the Electron **main** process,
which is the only process allowed to make the outbound HTTPS request to
`api.anthropic.com`. The renderer only ever talks to the main process over a
narrow, typed IPC contract.

This mirrors the existing pattern in this codebase: `preload.js` already
uses `contextBridge.exposeInMainWorld(...)` to expose a narrow surface
(`electronFs`, `command.spawn`, `fxp`, etc.) rather than raw Node APIs — the
AI bridge follows the exact same convention, added as one more
`contextBridge.exposeInMainWorld('aiBridge', {...})` block.

## 2. Key storage — main process (`main.js` additions)

```js
const { safeStorage } = require( 'electron' );
const fs = require( 'fs' );
const path = require( 'path' );

const AI_KEY_FILE = path.join( app.getPath( 'userData' ), 'ai-key.enc' );

function saveApiKey ( plainTextKey ) {
	if ( !safeStorage.isEncryptionAvailable() ) {
		throw new Error( 'OS-level secret storage is not available on this machine.' );
	}
	const encrypted = safeStorage.encryptString( plainTextKey );
	fs.writeFileSync( AI_KEY_FILE, encrypted );
}

function loadApiKey () {
	if ( !fs.existsSync( AI_KEY_FILE ) ) return null;
	if ( !safeStorage.isEncryptionAvailable() ) return null;
	const encrypted = fs.readFileSync( AI_KEY_FILE );
	return safeStorage.decryptString( encrypted );
}

function clearApiKey () {
	if ( fs.existsSync( AI_KEY_FILE ) ) fs.unlinkSync( AI_KEY_FILE );
}

function hasApiKey () {
	return fs.existsSync( AI_KEY_FILE );
}
```

`safeStorage` uses the OS keychain (macOS Keychain, Windows DPAPI, libsecret
on Linux) under the hood — this is the standard Electron-recommended
approach and requires no third-party dependency.

## 3. IPC handlers (`main.js` additions)

```js
const { ipcMain, net } = require( 'electron' );

ipcMain.handle( 'ai:set-api-key', ( event, plainTextKey ) => {
	saveApiKey( plainTextKey );
	return { ok: true };
} );

ipcMain.handle( 'ai:has-api-key', () => hasApiKey() );

ipcMain.handle( 'ai:clear-api-key', () => {
	clearApiKey();
	return { ok: true };
} );

// Streaming completion: renderer sends a request id, main process streams
// chunks back via webContents.send on a per-request channel, and resolves
// the handle() call when the stream is done or errors.
const activeStreams = new Map(); // requestId -> AbortController

ipcMain.handle( 'ai:chat-completion-stream', async ( event, { requestId, payload } ) => {

	const apiKey = loadApiKey();

	if ( !apiKey ) {
		event.sender.send( `ai:stream-error:${ requestId }`, { kind: 'auth', message: 'No API key configured.' } );
		return;
	}

	const controller = new AbortController();
	activeStreams.set( requestId, controller );

	try {
		const response = await fetch( 'https://api.anthropic.com/v1/messages', {
			method: 'POST',
			signal: controller.signal,
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01',
			},
			body: JSON.stringify( { ...payload, stream: true } ),
		} );

		if ( !response.ok ) {
			const kind = response.status === 401 ? 'auth' : response.status === 429 ? 'rate_limit' : 'unknown';
			event.sender.send( `ai:stream-error:${ requestId }`, { kind, message: `Anthropic API error ${ response.status }`, status: response.status } );
			return;
		}

		// Parse SSE stream, forward each parsed event as a typed AiStreamEvent (see doc 06 §1).
		for await ( const sseEvent of parseAnthropicSse( response.body ) ) {
			event.sender.send( `ai:stream-event:${ requestId }`, sseEvent );
		}

		event.sender.send( `ai:stream-done:${ requestId }` );

	} catch ( err ) {
		if ( err.name === 'AbortError' ) {
			event.sender.send( `ai:stream-done:${ requestId }` );
		} else {
			event.sender.send( `ai:stream-error:${ requestId }`, { kind: 'network', message: err.message } );
		}
	} finally {
		activeStreams.delete( requestId );
	}
} );

ipcMain.handle( 'ai:cancel-stream', ( event, requestId ) => {
	const controller = activeStreams.get( requestId );
	if ( controller ) controller.abort();
	return { ok: true };
} );
```

`parseAnthropicSse` is a small helper (new file `src/electron/anthropic-sse-parser.js`,
plain Node, no Angular) that turns the raw `text/event-stream` body into the
typed `AiStreamEvent` union from doc 06 §1 (`text_delta`, `tool_use_start`,
`tool_use_input_delta`, `tool_use_end`, `message_stop`) by mapping
Anthropic's `content_block_start` / `content_block_delta` /
`content_block_stop` / `message_stop` SSE event types.

## 4. `preload.js` additions

```js
const { contextBridge, ipcRenderer } = require( 'electron' );

contextBridge.exposeInMainWorld( 'aiBridge', {

	setApiKey: ( key ) => ipcRenderer.invoke( 'ai:set-api-key', key ),
	hasApiKey: () => ipcRenderer.invoke( 'ai:has-api-key' ),
	clearApiKey: () => ipcRenderer.invoke( 'ai:clear-api-key' ),

	streamChatCompletion: ( payload, onEvent, onError, onDone ) => {

		const requestId = `${ Date.now() }-${ Math.random().toString( 36 ).slice( 2 ) }`;

		const eventChannel = `ai:stream-event:${ requestId }`;
		const errorChannel = `ai:stream-error:${ requestId }`;
		const doneChannel = `ai:stream-done:${ requestId }`;

		const onEventFn = ( _e, data ) => onEvent( data );
		const onErrorFn = ( _e, data ) => onError( data );
		const onDoneFn = () => { onDone(); cleanup(); };

		function cleanup () {
			ipcRenderer.removeListener( eventChannel, onEventFn );
			ipcRenderer.removeListener( errorChannel, onErrorFn );
			ipcRenderer.removeListener( doneChannel, onDoneFn );
		}

		ipcRenderer.on( eventChannel, onEventFn );
		ipcRenderer.on( errorChannel, onErrorFn );
		ipcRenderer.on( doneChannel, onDoneFn );

		ipcRenderer.invoke( 'ai:chat-completion-stream', { requestId, payload } );

		// returns an unsubscribe fn used for cancellation (doc 06 §7)
		return () => {
			ipcRenderer.invoke( 'ai:cancel-stream', requestId );
			cleanup();
		};
	},
} );
```

## 5. Renderer-side TypeScript ambient declaration

Add `src/app/ai/models/ai-bridge.d.ts`:

```ts
export interface AiBridgeStreamEvent { /* mirrors AiStreamEvent, doc 06 §1 */ }
export interface AiBridgeError { kind: string; message: string; status?: number }

declare global {
	interface Window {
		aiBridge: {
			setApiKey( key: string ): Promise<{ ok: boolean }>;
			hasApiKey(): Promise<boolean>;
			clearApiKey(): Promise<{ ok: boolean }>;
			streamChatCompletion(
				payload: unknown,
				onEvent: ( e: AiBridgeStreamEvent ) => void,
				onError: ( e: AiBridgeError ) => void,
				onDone: () => void,
			): () => void; // unsubscribe
		};
	}
}
```

## 6. Settings dialog ↔ bridge

`AiSettingsService` (`src/app/ai/services/ai-settings.service.ts`) wraps
`window.aiBridge.setApiKey/hasApiKey/clearApiKey` and exposes
`AiSettings.apiKeyConfigured` reactively (`BehaviorSubject<boolean>`,
refreshed after any `setApiKey`/`clearApiKey` call). The raw key value is
**write-only** from the renderer's perspective — there is no
`getApiKey()` on the bridge at all, by design, so it's structurally
impossible for renderer code (including any future AI-authored code, or a
compromised dependency) to read the key back out.

## 7. Network egress

No changes needed to this repo's own network configuration beyond what
Electron's main process already does (`fetch` to `api.anthropic.com` runs in
main, which is unrestricted Node — same trust level as the existing
`fbx2gltf`/`child_process.spawn` bridges already present in `preload.js`).
If the team later sandboxes the main process's egress, `api.anthropic.com`
must be allow-listed there.

## 8. What this section deliberately does NOT do

- No local proxy server, no separate backend service — the Electron main
  process *is* the backend for this feature, consistent with this app being
  a desktop-only Electron app with no existing server component.
- No token-usage metering/billing UI in v1 (out of scope; user brings their
  own API key, doc 08 §7 settings dialog just stores it).
