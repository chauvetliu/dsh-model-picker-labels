/**
 * dsh-model-picker-groups — Host half.
 *
 * Pure UI plugin: the browser half does all the work (it restyles the model
 * picker through two `conversation.input.model.label` contributions), and the
 * Host only needs this entry so the package appears in the profile's plugin
 * list and its `dsh.client` row is published by client-modules.
 *
 * Kept deliberately empty: an activation failure here would take the whole
 * boot down, and there is nothing for the Host to serve.
 *
 * @module dsh-model-picker-groups
 */

/** Config schema placeholder: the profile layer may set `enabled` from the GUI. */
export const Config = undefined

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply() {}

/** Human-readable plugin name for the Loader listing. */
export const name = 'dsh-model-picker-groups'