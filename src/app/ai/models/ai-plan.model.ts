export interface AiPlan {
	id: string;
	goalText: string;
	createdAt: number;
	status: AiPlanStatus;
	steps: AiPlanStep[];
	commandGroupId: string;
}

export type AiPlanStatus =
	| 'drafting'
	| 'awaiting_review'
	| 'running'
	| 'paused'
	| 'completed'
	| 'completed_with_errors'
	| 'aborted';

export interface AiPlanStep {
	id: string;
	index: number;
	description: string;
	toolName: string;
	args: Record<string, any>;
	dependsOn: string[];
	status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
	resultSummary?: string;
	errorMessage?: string;
	hasUnresolvedReferences: boolean;
}
