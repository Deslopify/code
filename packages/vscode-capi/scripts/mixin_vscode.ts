/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import * as path from 'path';
import { LICENSE_AGREEMENT } from '../src/licenseAgreement.js';

// Path configurations
const vscodeSourcePath = process.env.BUILD_SOURCESDIRECTORY;
const fileToReplace = 'src/vs/platform/endpoint/common/licenseAgreement.ts';

function error(message: string): never {
	console.error(message);
	process.exit(1);
}

if (!vscodeSourcePath) {
	error('BUILD_SOURCESDIRECTORY environment variable is not set');
}

const targetPath = path.resolve(vscodeSourcePath, fileToReplace);

// Create new file content
const newContent = `/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const COPILOT_LICENSE_AGREEMENT = \`${LICENSE_AGREEMENT}\`;
export const COPILOT_INTEGRATION_ID = 'vscode-chat';
`;

// Check if the target file exists. We are overwriting it, so it should
if (!fs.existsSync(targetPath)) {
	error(`Target file does not exist: ${targetPath}`);
}

fs.writeFileSync(targetPath, newContent, 'utf8');
console.log(`Successfully updated ${targetPath}`);
