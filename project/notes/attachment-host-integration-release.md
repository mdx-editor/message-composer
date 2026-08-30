# Attachment Host Integration Release Note

This release adds typed opaque attachment data, aggregate and contextual validation, shared submit
blockers, accepted explicit-removal events, and cancellation when reset or controlled values remove
active uploads. Existing `{ url }` upload handlers remain valid.

The copied registry UI now targets `@base-ui/react`. It also adds selectable formatting controls and
authenticated attachment preview hooks. Applications that previously installed registry items must
update their copied imports and dependency from `@base-ui-components/react` as part of the upgrade.
