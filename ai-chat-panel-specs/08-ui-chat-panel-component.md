# 08 — UI: Chat Panel Component

## 1. Placement in the editor shell

Modify `src/app/views/editor/editor.component.html`. Current structure has a
right sidebar `fxFlex="24"` containing `app-object-inspector` +
`app-graph-viewport`. Add the AI panel as a **new top-level column**, not
nested in the existing sidebar (keeps inspector behavior untouched):

```html
<div fxFlex fxLayout="row" fxLayoutAlign="space-around" fxLayoutGap="0px" style="height: 500px; overflow: auto;">

	<div fxFlex="76" fxLayout="column" fxLayoutAlign="space-around" fxLayoutGap="0px">
		<app-viewport fxFlex="70"></app-viewport>
		<mat-tab-group fxFlex="30">
			<mat-tab label="Project Browser"><app-project-browser></app-project-browser></mat-tab>
			<mat-tab [label]="consoleLabel"><app-console></app-console></mat-tab>
		</mat-tab-group>
	</div>

	<div fxFlex="24" fxLayout="column" style="background: #333333;">
		<app-object-inspector class="app-object-inspector" [fxFlex]="inspectorHeight"></app-object-inspector>
		<app-graph-viewport *ngIf="isElevationToolOpened" [fxFlex]="graphHeight"></app-graph-viewport>
	</div>

	<!-- NEW: AI chat panel, collapsible, feature-flagged -->
	<app-ai-chat-panel
		*ngIf="aiFeatureEnabled"
		fxFlex="0 0 auto"
		[class.collapsed]="!aiPanelExpanded"
		[style.width.px]="aiPanelExpanded ? 340 : 40">
	</app-ai-chat-panel>

</div>
```

`editor.component.ts` additions: `aiFeatureEnabled = AiFeatureFlag.enabled;`
and `aiPanelExpanded` boolean (default `true`), toggled by a small collapse
tab rendered inside `AiChatPanelComponent` itself (component owns its own
collapse chevron in its top-left corner, emits `(collapsedChange)` the host
binds to `aiPanelExpanded`).

A menu-bar toggle is also added: `src/app/views/editor/menu-bar/menu-bar.component.html`
gets a new "AI Assistant" toggle button (icon: `smart_toy` or similar Material
icon) that flips `aiPanelExpanded`, wired the same way existing menu-bar
toggles work in that component.

## 2. `AiChatPanelComponent` structure

```
ai-chat-panel.component.html
├── header
│   ├── collapse/expand chevron button
│   ├── title "AI Assistant"
│   └── settings gear icon button (opens AiSettingsDialogComponent)
├── body (scrollable, auto-scrolls to bottom on new content unless user has scrolled up)
│   └── *ngFor message of messages$ | async
│       └── <app-ai-message-bubble [message]="message">
│           └── *ngFor toolCall of message.toolCalls
│               └── <app-ai-tool-call-card [record]="toolCall" (confirm)="..." (reject)="...">
│                   └── <app-ai-diff-preview *ngIf="toolCall.preview" [preview]="toolCall.preview">
├── empty state (shown when messages$ is empty) — see §5
├── inline error/status banner (network/auth issues) — see §6
└── footer
    ├── <textarea> auto-growing input, Enter to send / Shift+Enter for newline
    ├── send button (disabled while a turn is streaming; becomes "Stop" button while streaming, per doc 06 §7)
    └── small hint text: "AI can make mistakes — review actions before confirming."
```

```ts
@Component( {
	selector: 'app-ai-chat-panel',
	templateUrl: './ai-chat-panel.component.html',
	styleUrls: [ './ai-chat-panel.component.scss' ],
} )
export class AiChatPanelComponent implements OnInit, OnDestroy {

	@Output() collapsedChange = new EventEmitter<boolean>();

	messages$ = this.conversation.messages;
	inputText = '';
	isStreaming$ = this.messages$.pipe( map( msgs => !!msgs[ msgs.length - 1 ]?.streaming ) );
	settings$ = this.settingsService.settings;

	constructor (
		private conversation: AiConversationService,
		private settingsService: AiSettingsService,
		private dialog: MatDialog,
	) {}

	async send (): Promise<void> {
		const text = this.inputText.trim();
		if ( !text ) return;
		this.inputText = '';
		await this.conversation.sendMessage( text );
	}

	stop (): void {
		this.conversation.cancelCurrentTurn();
	}

	openSettings (): void {
		this.dialog.open( AiSettingsDialogComponent, { width: '420px' } );
	}
}
```

`AiModule` declares all five UI components and imports `MatDialogModule`,
`MatButtonModule`, `MatIconModule`, `MatTooltipModule`, `MatFormFieldModule`,
`MatInputModule`, `MatSelectModule`, `MatSlideToggleModule`,
`ReactiveFormsModule` (only the ones not already globally available — check
`app.module.ts`'s existing Material imports first to avoid duplicate module
imports).

## 3. `AiMessageBubbleComponent`

- User messages: right-aligned, accent-colored background.
- Assistant messages: left-aligned, neutral background, small "AI" avatar
  icon.
- Renders `message.text` through a **restricted markdown subset**: bold,
  italic, inline code, bullet lists, numbered lists, line breaks. No raw
  HTML, no images, no links auto-rendered as clickable without a
  `rel="noopener noreferrer" target="_blank"` (external links only ever come
  from the LLM's text, not from tool results, and even then should be
  rare — do not build a full markdown renderer, hand-roll the 5 patterns
  above with regex/simple parsing to avoid pulling in a markdown dependency
  for this small a surface).
- If `message.streaming`, render a blinking cursor at the end of the text.
- If `message.error`, render `AiMessageErrorComponent`-style inline banner
  (share styling with §6) instead of/alongside the partial text.

## 4. `AiToolCallCardComponent`

One card per `AiToolCallRecord` inside a message, rendered chronologically
as they arrive (even while the assistant text is still streaming above/below
them, matching how the tool-use loop interleaves text and tool calls per
doc 06 §3).

Visual states (drive off `record.status`):
- `pending_preview` — spinner + "Preparing preview…"
- `pending_confirmation` — shows `AiDiffPreviewComponent` + two buttons:
  **Confirm** (primary) and **Cancel** (secondary). Clicking either resolves
  the promise `AiPreviewService.awaitUserConfirmation` is waiting on (doc 09
  §4).
- `running` — spinner + "Applying…"
- `succeeded` — green check icon + `record.summary` text, plus a small
  "Undo this" text-button that calls `CommandHistory.undo()` directly IF
  and only if this is still the most recent undo entry (compare
  `CommandHistory.getUndosCount()` before/after to avoid undoing a later,
  unrelated user edit — if it's no longer the top of the stack, hide the
  per-card undo button and rely on the global Ctrl+Z instead).
- `failed` — red icon + `record.errorMessage`.
- `rejected` — grey icon + "Not applied."

Each card also shows a small header line: `toolName` humanized (e.g.
`set_lane_width` → "Set Lane Width") + a category icon (map
`AiToolCategory` → Material icon: road→`add_road`, lane→`straighten`,
junction→`merge`, marking→`format_paint`, prop→`park`, signal→`traffic`,
terrain→`terrain`, query→`search`, project→`folder`).

## 5. Empty state

When `messages$` is empty, show:
- Short heading: "Ask me to edit your map"
- 3–4 example prompt chips (clickable, populate the input but don't
  auto-send): "Widen the selected lane to 4m", "Add a crosswalk here",
  "Create a 4-way roundabout", "Set this road's speed to 60".
- If `!settings.apiKeyConfigured`, replace the example chips with a single
  "Add your Anthropic API key to get started" button opening
  `AiSettingsDialogComponent`.

## 6. Inline error/status banner states

| Condition | Banner text | Action offered |
|---|---|---|
| `!apiKeyConfigured` | "No API key configured." | "Add key" button → settings dialog |
| offline / `AiChatError.kind === 'network'` | "Can't reach the AI service. Check your connection." | "Retry" button (re-sends the last user message) |
| `kind === 'auth'` | "Your API key was rejected. Please check it in settings." | "Open settings" button |
| `kind === 'rate_limit'` | "Rate limit reached — please wait a moment and try again." | none (informational) |
| advanced tools disabled and user's request likely needs one (heuristic: assistant text mentions "would need to create/add a road/junction") | (no separate banner — handled by system prompt instructing the model to say so in its own words per system prompt rule 7; no special UI needed) | n/a |

## 7. `AiSettingsDialogComponent`

Simple Material dialog:
- API key input (`type="password"`, masked, with a show/hide toggle),
  "Save" button → `AiSettingsService.setApiKey()`, "Clear" button →
  `AiSettingsService.clearApiKey()`.
- Model select dropdown (`claude-sonnet-5` / `claude-opus-4-8` /
  `claude-haiku-4-5-20251001`), bound to `AiSettings.model`.
- "Enable advanced tools (create roads, junctions, roundabouts)" slide
  toggle, bound to `AiSettings.advancedToolsEnabled`, default off — this is
  the user-facing opt-in gate referenced throughout doc 03/04.
- Footnote text: "Your API key is stored encrypted on this device and is
  only used to talk to Anthropic's API directly from this app."

## 8. Styling

Follow the existing dark editor theme (`#333333` panel background, as seen
in the current sidebar). No new design tokens — reuse existing SCSS
variables from `src/assets/styles/scss/` (inspect and reuse whatever
variables `object-inspector` uses for panel background/border/text colors,
for visual consistency rather than introducing a new palette).

## 9. Accessibility

- Input textarea has `aria-label="Message the AI assistant"`.
- Tool call card Confirm/Cancel buttons are real `<button>` elements
  (keyboard-operable), not click-handlers on `<div>`s.
- Streaming text updates use `aria-live="polite"` on the message body
  container so screen readers announce new content without interrupting.
