# Attachment Ingestion And Host Upload Contract

Status: accepted
Date: 2026-06-12

## Context

Stage 7 adds attachments. The value model already carries `MessageComposerAttachment` (id, name, mimeType, size, status, url, progress, error, file) from stage 1, and the plan keeps upload handling host-supplied. Open points: the host upload contract — including whether cancellation is required of hosts (an Open Questions item) — the plugin configuration shape, how attachment state changes interact with strict-controlled mode, and where validation failures surface.

## Decision

**Plugin configuration.** `attachmentsPlugin({ upload, accept, maxFileSize, maxCount, multiple, validate })`. `upload` is the only required field. `accept` is a file-input accept string applied both to the picker input and to drop/paste validation; `maxFileSize` (bytes) and `maxCount` bound individual files and the draft total; `multiple` (default true) controls the picker; `validate` is a per-file hook returning an error message to reject. The plugin is headless: list and picker UI attach through slots or custom components over the exported nodes.

**Upload contract.** `upload(file, { attachment, signal, onProgress }) => Promise<{ url }>`. The promise resolving marks the attachment `success` with the returned `url`; rejecting marks it `error` with the message. `onProgress(fraction)` updates `progress` (clamped 0–1, ignored once the attachment left `uploading`).

**Cancellation is provided, not required.** The plugin creates an `AbortController` per upload and aborts it when the attachment is removed or the engine disposes; settlements of aborted or disposed uploads are discarded. Correctness therefore never depends on the host honoring `signal` — ignoring it only wastes the transfer. This resolves the plan's open question without locking hosts in: making abort mandatory later (e.g. for quota accounting) would be additive, while removing a mandatory requirement would be breaking.

**State changes are draft edits.** Ingestion, upload transitions, retry, and remove all route through `editorChange$`, exactly like agent-settings selections: committed to the draft when uncontrolled, emitted through `onValueChange` for the host to echo when controlled. Async transitions (progress, settlement) patch the attachment by id against the draft current at that moment; if the id is no longer present — removed, or never echoed by a strict-controlled host — the transition is dropped. Attachments in host-authored values without a local `file` render and submit normally; they simply cannot be retried.

**Validation failures are plugin state, not value state.** Rejected files never become attachments; they land in the `attachmentRejections$` cell as `{ file, code, message }` (codes: `file-too-large`, `type-not-accepted`, `too-many-files`, `custom`). Each ingestion replaces the cell, and `dismissAttachmentRejections$` clears it. Keeping rejections out of the value spares hosts from filtering garbage records on submit.

**Ingestion surfaces.** `addAttachmentFiles$` is the single validated entry; the picker (`openAttachmentPicker$` clicking a plugin-managed hidden input mounted next to the editor root) and the Lexical `DROP_COMMAND`/`PASTE_COMMAND` handlers (registered at high priority when the clipboard or data transfer carries files) all feed it. Accepted files enter as `uploading` and the handler starts immediately; the `pending` status stays reserved for host-authored values.

**Retry.** `retryAttachmentUpload$` re-runs the handler for an attachment that is in `error` and still has its local `file`; anything else is a no-op so UIs can disable the affordance instead of guarding.

## Consequences

Hosts implement exactly one async function and get progress, retry, remove, and cancellation semantics from the plugin. The signal-in-signature contract means hosts that want real cancellation wire `fetch(..., { signal })` and are done.

Strict-controlled hosts must echo attachment emissions like any other edit; a non-echoing host sees uploads start but never land in the value, which is consistent with ADR 0003's input-revert semantics.

Because transitions patch by id against the live draft, a controlled host that rewrites attachment ids breaks in-flight transition delivery — ids are the identity contract.
