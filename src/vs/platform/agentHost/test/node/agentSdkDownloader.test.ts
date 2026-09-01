/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { resolveSdkTarget, type IAgentSdkPackage } from '../../node/agentSdkDownloader.js';

/**
 * Unit tests for the platform/arch/libc → sdkTarget mapping. These cover
 * the cross-product the downloader can't easily exercise (Universal x64
 * launches from arm64 hosts, musl Linux from a macOS CI runner, …) by
 * passing a synthetic host directly to the pure function.
 */
suite('resolveSdkTarget', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function fakePkg(hasSeparateMuslLinuxPackage: boolean): IAgentSdkPackage {
		return { id: 'test', displayName: 'Test', devOverrideEnvVar: 'X', hasSeparateMuslLinuxPackage };
	}

	test('returns <platform>-<arch> for supported (platform, arch)', () => {
		assert.deepStrictEqual({
			'darwin-x64': resolveSdkTarget(fakePkg(false), { platform: 'darwin', arch: 'x64', libc: undefined }),
			'darwin-arm64': resolveSdkTarget(fakePkg(false), { platform: 'darwin', arch: 'arm64', libc: undefined }),
			'linux-x64': resolveSdkTarget(fakePkg(false), { platform: 'linux', arch: 'x64', libc: 'glibc' }),
			'linux-arm64': resolveSdkTarget(fakePkg(false), { platform: 'linux', arch: 'arm64', libc: 'glibc' }),
			'win32-x64': resolveSdkTarget(fakePkg(false), { platform: 'win32', arch: 'x64', libc: undefined }),
			'win32-arm64': resolveSdkTarget(fakePkg(false), { platform: 'win32', arch: 'arm64', libc: undefined }),
		}, {
			'darwin-x64': 'darwin-x64',
			'darwin-arm64': 'darwin-arm64',
			'linux-x64': 'linux-x64',
			'linux-arm64': 'linux-arm64',
			'win32-x64': 'win32-x64',
			'win32-arm64': 'win32-arm64',
		});
	});

	test('appends -musl on musl Linux iff the package has separate musl SKUs', () => {
		assert.strictEqual(
			resolveSdkTarget(fakePkg(true), { platform: 'linux', arch: 'x64', libc: 'musl' }),
			'linux-x64-musl',
			'claude-style: musl host → -musl suffix',
		);
		assert.strictEqual(
			resolveSdkTarget(fakePkg(false), { platform: 'linux', arch: 'x64', libc: 'musl' }),
			'linux-x64',
			'codex-style: musl host → no suffix (statically musl-linked, single SKU)',
		);
		assert.strictEqual(
			resolveSdkTarget(fakePkg(true), { platform: 'linux', arch: 'x64', libc: 'glibc' }),
			'linux-x64',
			'claude-style: glibc host → no suffix',
		);
	});

	test('returns undefined for unsupported (platform, arch)', () => {
		assert.strictEqual(resolveSdkTarget(fakePkg(true), { platform: 'linux', arch: 'armhf', libc: 'glibc' }), undefined);
		assert.strictEqual(resolveSdkTarget(fakePkg(true), { platform: 'freebsd' as NodeJS.Platform, arch: 'x64', libc: undefined }), undefined);
		assert.strictEqual(resolveSdkTarget(fakePkg(false), { platform: 'darwin', arch: 'ia32', libc: undefined }), undefined);
	});
});
