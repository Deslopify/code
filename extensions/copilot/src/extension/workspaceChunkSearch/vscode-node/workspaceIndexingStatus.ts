/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { t } from '@vscode/l10n';
import * as vscode from 'vscode';
import { ResolvedRepoRemoteInfo } from '../../../platform/git/common/gitService';
import { ILogService } from '../../../platform/log/common/logService';
import { ICodeSearchAuthenticationService } from '../../../platform/remoteCodeSearch/node/codeSearchRepoAuth';
import { coalesce } from '../../../util/vs/base/common/arrays';
import { Disposable, DisposableStore, IDisposable } from '../../../util/vs/base/common/lifecycle';


const reauthenticateCommandId = '_copilot.workspaceIndex.signInAgain';

const codebaseSemanticSearchDocsLink = 'https://aka.ms/vscode-copilot-workspace-remote-index';

interface ChatStatusItemState {
	readonly primary: {
		readonly message: string;
		readonly icon?: string;
		readonly busy?: boolean;
	};
	readonly details?: {
		readonly message: string;
		readonly busy: boolean;
	};
	readonly tooltip?: string;
}

const spinnerCodicon = '$(loading~spin)';
const statusTitle = t`Codebase Semantic Index`;

export class ChatStatusWorkspaceIndexingStatus extends Disposable {

	private readonly _statusItem: vscode.ChatStatusItem;

	constructor(
		@ICodeSearchAuthenticationService private readonly _codeSearchAuthService: ICodeSearchAuthenticationService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();

		this._statusItem = this._register(vscode.window.createChatStatusItem('copilot.workspaceIndexStatus'));
		this._statusItem.title = statusTitle;

		this._register(this.registerCommands());

		// Write an initial status
		this._writeStatusItem({
			primary: {
				message: t`Checking...`,
				icon: spinnerCodicon,
			},
			details: undefined,
			tooltip: t`Checking the current index status...`,
		});
	}

	private _writeStatusItem(values: ChatStatusItemState | undefined) {
		this._logService.trace(`ChatStatusWorkspaceIndexingStatus::_writeStatusItem()`);

		if (!values) {
			this._statusItem.hide();
			return;
		}

		this._statusItem.show();

		this._statusItem.title = {
			label: statusTitle,
			link: codebaseSemanticSearchDocsLink,
			helpText: t`Indexes your codebase for more relevant AI results.`,
		};

		this._statusItem.description = coalesce([
			values.primary.icon,
			values.primary.message,
			values.primary.busy ? spinnerCodicon : undefined,
		]).join(' ');

		if (values.details) {
			this._statusItem.detail = coalesce([
				values.details.message,
				values.details.busy ? spinnerCodicon : undefined
			]).join(' ');
		} else {
			this._statusItem.detail = '';
		}

		this._statusItem.tooltip = values.tooltip;
	}

	private registerCommands(): IDisposable {
		const disposables = new DisposableStore();

		disposables.add(vscode.commands.registerCommand(reauthenticateCommandId, async (repo: ResolvedRepoRemoteInfo | undefined) => {
			if (!repo) {
				return;
			}

			return this._codeSearchAuthService.tryReauthenticating(repo);
		}));

		return disposables;
	}
}
