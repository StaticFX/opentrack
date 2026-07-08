// Verify the pluggable storage layer: local disk end-to-end (real fs), and S3
// dispatch (Put/Get/Delete commands + real presigning) with a stubbed transport.
process.env.ORIGIN = 'https://track.example.com';
process.env.UPLOADS_DIR = '/tmp/ot-smoke-uploads';

import '$lib/server/load-env';
import { S3Client } from '@aws-sdk/client-s3';
import { getConfig, invalidateConfig, setSetting } from '$lib/server/config';
import { deleteUpload, readUpload, saveUpload, serveUrl } from '$lib/server/uploads';
import { closeDb } from '$lib/server/db';

function assert(c: unknown, m: string) {
	if (!c) throw new Error('FAIL: ' + m);
	console.log('  ✓ ' + m);
}

async function clearS3() {
	for (const k of ['enabled', 'endpoint', 'region', 'bucket', 'accessKeyId', 'secretAccessKey', 'forcePathStyle']) {
		await setSetting(`storage.s3.${k}`, null);
	}
	invalidateConfig();
}

async function main() {
	await clearS3();

	console.log('[1] local driver (real filesystem, default)');
	assert((await getConfig()).storage.driver === 'local', 'driver resolves to local when S3 unset');
	const local = await saveUpload('hello world.txt', Buffer.from('hi there'), 'text/plain');
	assert(local.driver === 'local' && /^[0-9a-f-]+\/hello_world\.txt$/.test(local.storageKey), 'saved local with sanitized key');
	assert((await readUpload('local', local.storageKey)).toString() === 'hi there', 'reads bytes back');
	assert((await serveUrl('local', local.storageKey, { mime: 'text/plain', filename: 'a', inline: true })) === null, 'local has no presigned url');
	await deleteUpload('local', local.storageKey);
	let gone = false;
	try {
		await readUpload('local', local.storageKey);
	} catch {
		gone = true;
	}
	assert(gone, 'deleted → read fails');

	console.log('[2] S3 driver dispatch (stubbed transport)');
	const cmds: string[] = [];
	const orig = S3Client.prototype.send;
	// @ts-expect-error test stub
	S3Client.prototype.send = async function (cmd: { constructor: { name: string } }) {
		cmds.push(cmd.constructor.name);
		if (cmd.constructor.name === 'GetObjectCommand') {
			return { Body: { transformToByteArray: async () => new TextEncoder().encode('s3-bytes') } };
		}
		return {};
	};
	try {
		await setSetting('storage.s3.bucket', 'testbucket');
		await setSetting('storage.s3.accessKeyId', 'AKIATEST');
		await setSetting('storage.s3.secretAccessKey', 'shhh', true);
		await setSetting('storage.s3.region', 'auto');
		await setSetting('storage.s3.enabled', '1');
		invalidateConfig();

		const cfg = await getConfig();
		assert(cfg.storage.driver === 's3' && cfg.storage.s3?.bucket === 'testbucket', 'driver resolves to s3 when enabled + configured');

		const put = await saveUpload('report.pdf', Buffer.from('x'), 'application/pdf');
		assert(put.driver === 's3' && cmds.includes('PutObjectCommand'), 'save issues PutObjectCommand, records s3 driver');
		assert((await readUpload('s3', put.storageKey)).toString() === 's3-bytes' && cmds.includes('GetObjectCommand'), 'read issues GetObjectCommand + returns bytes');

		const url = await serveUrl('s3', put.storageKey, { mime: 'application/pdf', filename: 'report.pdf', inline: true });
		assert(!!url && url.includes('testbucket') && url.includes('X-Amz-Signature'), 'serveUrl returns a real presigned GET url');

		await deleteUpload('s3', put.storageKey);
		assert(cmds.includes('DeleteObjectCommand'), 'delete issues DeleteObjectCommand');

		console.log('[3] enabling S3 without full credentials stays local');
		await clearS3();
		await setSetting('storage.s3.enabled', '1'); // enabled but no bucket/keys
		invalidateConfig();
		assert((await getConfig()).storage.driver === 'local', 'enabled-but-unconfigured → still local (safe)');
	} finally {
		S3Client.prototype.send = orig;
		await clearS3();
	}

	console.log('\n✅ smoke-storage passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-storage failed:', err);
	await closeDb();
	process.exit(1);
});
