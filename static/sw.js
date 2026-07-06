// OpenTrack push service worker. Registered on demand from the account page when
// a user enables browser notifications. Intentionally minimal — no offline cache.
self.addEventListener('push', (event) => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = {};
	}
	const title = data.title || 'OpenTrack';
	event.waitUntil(
		self.registration.showNotification(title, {
			body: data.body || '',
			icon: '/favicon.svg',
			badge: '/favicon.svg',
			tag: data.tag,
			data: { url: data.url || '/' }
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = (event.notification.data && event.notification.data.url) || '/';
	event.waitUntil(
		(async () => {
			const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const client of all) {
				if ('focus' in client) {
					try {
						await client.navigate(url);
					} catch {
						/* cross-origin or not allowed */
					}
					return client.focus();
				}
			}
			if (self.clients.openWindow) return self.clients.openWindow(url);
		})()
	);
});
