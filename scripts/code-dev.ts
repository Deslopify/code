/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const path = require('node:path');
const { spawn } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';

const codeScript = path.join(
	repoRoot,
	'scripts',
	isWin ? 'code.bat' : 'code.sh',
);

const appData = process.env.APPDATA || process.env.HOME;
if (!appData) {
	throw new Error('Missing APPDATA/HOME environment variable');
}

const userDataDir = path.join(appData, 'Code');

const userHome = isWin ? process.env.USERPROFILE : process.env.HOME;
if (!userHome) {
	throw new Error('Missing USERPROFILE/HOME environment variable');
}

const extensionsDir = path.join(userHome, '.vscode', 'extensions');

spawn(
	codeScript,
	[`--user-data-dir=${userDataDir}`, `--extensions-dir=${extensionsDir}`],
	{
		cwd: repoRoot,
		stdio: 'inherit',
		shell: true,
	},
);
