/**
 * ui-sdk's agent bridge (`@ui-sdk/react/agent`): an agent can read the state of the ui-sdk components on a page (the
 * theme menu, the phone menu) and call their actions directly, rather than clicking through them. `connectAgent`
 * (once, from `mountZone`) creates the bridge and registers it with the browser's own agent through WebMCP
 * (`document.modelContext`), where the browser has it; elsewhere that registration does nothing. Only ui-sdk
 * components join the bridge, not the shadcn ones. A control marked `data-agent-confirm` is left to the person.
 *
 * @module lib/agent
 */

import { createAgent, registerTools } from '@ui-sdk/react/agent';

/** Creates the bridge and registers its tools with the browser's agent. Returns what removes those tools. */
export function connectAgent(): () => void {
	const agent = createAgent();
	return registerTools(agent, { allow: (step) => !step.confirm });
}
