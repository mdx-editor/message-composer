# Attachment Ingestion And Host Upload Contract

Status: accepted
Date: 2026-06-12

## Context

Stage 7 adds attachments. The value model already carries `MessageComposerAttachment` (id, name, mimeType, size, status, url, progress, error, file) from stage 1, and the plan keeps upload handling host-supplied. Open points: the host upload contract — including whether cancellation is required of hosts (an Open Questions item) — the plugin configuration shape, how attachment state changes interact with strict-controlled mode, and where validation failures surface.

## Decision

**Plugin configuration.** `attachmentsPlugin({ upload, accept, maxFileSize, maxTotalFileSize, maxCount, multiple, validate })`. `upload` is the only required field. `accept` is a file-input accept string applied both to the picker input and to drop/paste validation; `maxFileSize`, `maxTotalFileSize`, and `maxCount` bound individual files and the draft aggregate; `multiple` (default true) controls the picker. `validate(file, context)` receives an immutable draft and accepted-batch snapshot. The plugin is headless: list and picker UI attach through slots or custom components over the exported nodes.

**Upload contract.** `upload(file, { attachment, signal, onProgress }) => Promise<{ url, data? }>`. `data` is opaque typed host state that the package preserves without interpretation. The promise resolving marks the attachment `success` with the latest returned `url` and `data`; rejecting marks it `error` with the message. `onProgress(fraction)` updates `progress` (clamped 0–1, ignored once the attachment left `uploading`). Returning only `{ url }` remains valid.

**Cancellation is provided, not required.** The plugin creates an `AbortController` per upload and aborts it on explicit removal, reset, controlled reconciliation that removes the attachment ID, or engine disposal. Settlements of aborted or disposed uploads are discarded. Correctness therefore never depends on the host honoring `signal` — ignoring it only wastes the transfer.

**State changes are draft edits.** Ingestion, upload transitions, retry, and remove all route through `editorChange$`, exactly like agent-settings selections: committed to the draft when uncontrolled, emitted through `onValueChange` for the host to echo when controlled. Async transitions (progress, settlement) patch the attachment by id against the draft current at that moment; if the id is no longer present — removed, or never echoed by a strict-controlled host — the transition is dropped. Attachments in host-authored values without a local `file` render and submit normally; they simply cannot be retried.

**Validation failures are plugin state, not value state.** Rejected files never become attachments; they land in the `attachmentRejections$` cell as `{ file, code, message }` (codes: `file-too-large`, `total-file-size-exceeded`, `type-not-accepted`, `too-many-files`, `custom`). Aggregate validation counts existing draft bytes plus candidates accepted earlier in the batch. Each ingestion replaces the cell, and `dismissAttachmentRejections$` clears it. Keeping rejections out of the value spares hosts from filtering garbage records on submit.

**Ingestion surfaces.** `addAttachmentFiles$` is the single validated entry; the picker (`openAttachmentPicker$` clicking a plugin-managed hidden input mounted next to the editor root) and the Lexical `DROP_COMMAND`/`PASTE_COMMAND` handlers (registered at high priority when the clipboard or data transfer carries files) all feed it. Accepted files enter as `uploading` and the handler starts immediately; the `pending` status stays reserved for host-authored values.

**Retry.** `retryAttachmentUpload$` re-runs the handler for an attachment that is in `error` and still has its local `file`; anything else is a no-op so UIs can disable the affordance instead of guarding.

**Submission readiness.** The attachments plugin owns one entry in the core submit-blocker registry while any attachment is `pending`, `uploading`, or `error`. The core submit pipeline checks the registry, so Enter, imperative `submit()`, and direct `submit$` publication cannot diverge.

**Removal intent.** `removeAttachment$` remains the command. An accepted explicit removal publishes `attachmentRemoved$` once with the complete pre-removal attachment and an `explicit-removal` reason. Reset, controlled reconciliation, and disposal cancel transfers silently because the package cannot know whether the host has bound an uploaded resource to a sent message. Durable orphan cleanup remains host-owned.

## Consequences

Hosts implement exactly one async function and get progress, retry, remove, and cancellation semantics from the plugin. The signal-in-signature contract means hosts that want real cancellation wire `fetch(..., { signal })` and are done.

Strict-controlled hosts must echo attachment emissions like any other edit; a non-echoing host sees uploads start but never land in the value, which is consistent with ADR 0003's input-revert semantics.

Because transitions patch by id against the live draft, a controlled host that rewrites attachment ids breaks in-flight transition delivery — ids are the identity contract.

The attachment data generic is trailing and defaulted, so untyped values and `{ url }` upload handlers remain source compatible.
