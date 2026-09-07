# 13 — Vision Input Pipeline (Image → Map)

## 1. Purpose

Let the user attach a reference image (hand sketch, satellite screenshot,
photo of a real intersection, a rough diagram) alongside or instead of text,
and have goal-mode planning (doc 12) use it as an input to the plan it
generates. This does not do pixel-precise geometry extraction — it uses
Claude's native multimodal understanding to produce a **reasonable
approximation** described in the plan summary for the user to confirm/
correct before anything is built (doc 14 §2), consistent with doc 12 §4.3
rule 7.

## 2. UI: attaching an image

`AiChatPanelComponent` footer (doc 08 §2) gains an attach button
(paperclip icon) next to the send button:
- Click → native file picker via the existing Electron `electronFs` bridge
  pattern already exposed in `preload.js` (reuse, do not build a new file
  dialog bridge) filtered to `image/png, image/jpeg, image/webp`.
- Drag-and-drop onto the chat panel body is also supported — add a
  `(dragover)/(drop)` handler on `ai-chat-panel.component.ts` that reads
  `DataTransfer.files`.
- Selected image renders as a thumbnail chip above the input textarea
  (small, ~64px, with an ✕ to remove before sending). Multiple images may be
  attached to one message (cap: **4 images per message** — matches
  reasonable per-message payload size and avoids excessive token cost).
- On send, images travel with the message as `AiImageAttachment[]` and are
  cleared from the input area.

## 3. Data model additions

`src/app/ai/models/ai-message.model.ts` additions:

```ts
export interface AiImageAttachment {
	id: string;
	/** Base64-encoded, no data: prefix — matches Anthropic's image content block format. */
	base64: string;
	mediaType: 'image/png' | 'image/jpeg' | 'image/webp';
	/** For the thumbnail chip and for referencing "the second image" in follow-up text. */
	fileName: string;
	widthPx: number;
	heightPx: number;
}
```

`AiChatMessage.images?: AiImageAttachment[]` added (optional field, existing
message rendering paths unaffected when absent).

## 4. Preprocessing (renderer side, before the image ever reaches the LLM)

`AiImageProcessingService` (`src/app/ai/services/ai-image-processing.service.ts`):

```ts
@Injectable( { providedIn: 'root' } )
export class AiImageProcessingService {

	/** Downscale + compress before sending — keeps token cost and IPC payload size sane. */
	async prepareForUpload ( file: File ): Promise<AiImageAttachment> {

		const bitmap = await createImageBitmap( file );

		const MAX_DIM = 1568; // Anthropic's documented long-edge recommendation for image inputs
		const scale = Math.min( 1, MAX_DIM / Math.max( bitmap.width, bitmap.height ) );
		const targetW = Math.round( bitmap.width * scale );
		const targetH = Math.round( bitmap.height * scale );

		const canvas = document.createElement( 'canvas' );
		canvas.width = targetW;
		canvas.height = targetH;
		canvas.getContext( '2d' )!.drawImage( bitmap, 0, 0, targetW, targetH );

		const blob: Blob = await new Promise( resolve => canvas.toBlob( b => resolve( b! ), 'image/jpeg', 0.85 ) );
		const base64 = await blobToBase64( blob );

		return {
			id: uuid(),
			base64,
			mediaType: 'image/jpeg',
			fileName: file.name,
			widthPx: targetW,
			heightPx: targetH,
		};
	}
}
```

- Runs entirely client-side (Canvas API), no IPC round-trip needed for
  resizing itself.
- Reject files over **10MB before decoding** (hard cap, shown as a toast/
  inline error, not silently truncated) and reject anything that fails
  `createImageBitmap` (corrupt/unsupported file) with a clear message.
- EXIF orientation: `createImageBitmap(file, { imageOrientation: 'from-image' })`
  to avoid sideways-rendered photos being sent to the model.

## 5. Transport

`AiCompletionRequest` (doc 06 §1) gains an optional `images` field on each
`AiApiMessage`'s content, following Anthropic's native multi-block message
format:

```ts
export type AiApiContentBlock =
	| { type: 'text'; text: string }
	| { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }  // NEW
	| { type: 'tool_use'; id: string; name: string; input: Record<string, any> }
	| { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
```

`AiConversationService.sendMessage()` (doc 06 §3) is extended to accept
`images?: AiImageAttachment[]` and prepend `image` content blocks before the
`text` block in the user message, per Anthropic's recommended ordering
(images before the text that references them).

No changes needed in `main.js`'s IPC handler (doc 07 §3) — it already
forwards `payload` opaquely to the Anthropic API; base64 image blocks pass
through unchanged. Confirm the existing IPC message size limits (Electron's
default `ipcRenderer.invoke` payload ceiling) are not exceeded — 4 images at
~1568px JPEG q0.85 are typically well under 1MB each, safely inside default
limits; no special chunking is required in v1.

## 6. How the planner uses images

Per doc 12 §4.1/§4.3, images are passed straight through into the **planning
call** (`AiPlannerService.generatePlan`), not the per-step execution calls —
individual tool steps never need to re-see the image, they operate on
already-planned concrete numeric args. This keeps per-step execution calls
(doc 12 §5) cheap and image-cost bounded to once per plan generation.

The planning prompt (doc 12 §4.3) rule 7 already covers the required
behavior: describe what was inferred from the image in the plan summary
before listing steps. Add one more explicit instruction, appended to that
prompt when images are present:

```
One or more reference images are attached. Use them to infer: approximate
number of roads/arms, rough relative angles and lengths, presence of
features like crosswalks, medians, or roundabouts, and lane counts if
visible. Convert relative/visual proportions into concrete meters and
degrees using reasonable real-world road-design defaults (e.g. a standard
lane is ~3.5m wide, a typical urban block face is 80-150m) — state these
assumptions in the summary. If the image is ambiguous or you are not
confident in a specific measurement, say so in the summary rather than
inventing false precision.
```

## 7. UI feedback during/after planning with images

- While `AiPlannerService.generatePlan` is running with images attached,
  the loading state (doc 08's streaming indicator) shows "Analyzing
  image(s) and drafting a plan…" instead of the generic label, so the user
  understands the extra latency of a vision call.
- The resulting plan-review card (doc 14 §2) renders the attached image
  thumbnails alongside the plan summary text, so the user can visually
  cross-check "this is what I meant" before confirming.

## 8. What this does NOT do (explicit non-goals, not gaps)

- No pixel-level computer-vision extraction (edge detection, road
  segmentation models, OCR of dimensions written on a sketch) — this relies
  entirely on Claude's own multimodal reasoning, which is good at rough
  layout inference but not exact measurement. If a user needs precise
  dimensions, the planning summary asks them to confirm/correct rather than
  the system pretending to have measured precisely.
- No support for importing a georeferenced satellite image with real-world
  coordinate calibration (i.e. "this image is centered at lat/long X, scale
  1:500") — v1 always builds relative to either the origin or the current
  selection, per doc 12 §4.3 rule 5. Real-world georeferencing is a
  reasonable future addition but requires a calibration UI step this spec
  does not include.
- No video/multi-frame input — single static images only.
