/** What a tab's form actions can send back. */
export type TabForm = {
	error?: string | null;
	kidError?: string;
	circleError?: string;
	[key: string]: unknown;
} | null;
