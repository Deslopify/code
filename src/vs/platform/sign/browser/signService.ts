/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { importAMDNodeModule } from '../../../amdX.js';
import { WindowIntervalTimer } from '../../../base/browser/dom.js';
import { mainWindow } from '../../../base/browser/window.js';
import { memoize } from '../../../base/common/decorators.js';
import { AbstractSignService, IVsdaValidator } from '../common/abstractSignService.js';
import { ISignService } from '../common/sign.js';

declare namespace vsdaWeb {
	export function sign(salted_message: string): string;

	// eslint-disable-next-line @typescript-eslint/naming-convention
	export class validator {
		free(): void;
		constructor();
		createNewMessage(original: string): string;
		validate(signed_message: string): 'ok' | 'error';
	}

	export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;
	export function init(module_or_path?: InitInput | Promise<InitInput>): Promise<unknown>;
}

// Initialized if/when vsda is loaded
declare const vsda_web: {
	default: typeof vsdaWeb.init;
	sign: typeof vsdaWeb.sign;
	validator: typeof vsdaWeb.validator;
};

export class SignService extends AbstractSignService implements ISignService {
	constructor() {
		super();
	}
	protected override getValidator(): Promise<IVsdaValidator> {
		return this.vsda().then(vsda => {
			const v = new vsda.validator();
			return {
				createNewMessage: arg => v.createNewMessage(arg),
				validate: arg => v.validate(arg),
			};
		});
	}

	protected override signValue(arg: string): Promise<string> {
		return this.vsda().then(vsda => vsda.sign(arg));
	}

	@memoize
	private async vsda(): Promise<typeof vsda_web> {
		const checkInterval = new WindowIntervalTimer();
		await new Promise<void>((resolve, reject) => {
			importAMDNodeModule('vsda', 'out/web/vsda.js').then(() => resolve(), reject);

			// todo@connor4312: there seems to be a bug(?) in vscode-loader with
			// require() not resolving in web once the script loads, so check manually
			checkInterval.cancelAndSet(() => {
				if (typeof vsda_web !== 'undefined') {
					resolve();
				}
			}, 50, mainWindow);
		}).finally(() => checkInterval.dispose());

		return vsda_web;
	}
}
