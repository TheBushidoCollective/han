/**
 * GraphQL SlotStatus type
 *
 * Global slot pool status.
 */

import { builder } from "../builder.ts";
import { type ActiveSlotData, ActiveSlotType } from "./active-slot.ts";

/**
 * Slot status data
 */
export interface SlotStatusData {
	total: number;
	available: number;
	active: ActiveSlotData[];
}

/**
 * Slot status type ref
 */
const SlotStatusRef = builder.objectRef<SlotStatusData>("SlotStatus");

/**
 * Slot status type implementation
 */
export const SlotStatusType = SlotStatusRef.implement({
	description: "Global slot pool status",
	fields: (t) => ({
		total: t.exposeInt("total", { description: "Total number of slots" }),
		available: t.exposeInt("available", {
			description: "Number of available slots",
		}),
		active: t.field({
			type: [ActiveSlotType],
			description: "Currently active slots",
			resolve: (parent) => parent.active,
		}),
	}),
});
