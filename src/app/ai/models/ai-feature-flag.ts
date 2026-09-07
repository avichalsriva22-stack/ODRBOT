/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { environment } from 'environments/environment';

export abstract class AiFeatureFlag {
	static get enabled (): boolean {
		return !!( environment as any ).aiChatPanelEnabled;
	}
}
