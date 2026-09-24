(() => {
    "use strict";

    const params =
        new URL(
            self.location.href
        ).searchParams;

    const version =
        params.get("sherpa") ||
        "default";

    const cacheName =
        "wmof-sherpa-" +
        version;

    const cacheablePaths = [
        "/speech/",
        "/SherpaRecognizer.js",
        "/SpeechMenu.js",
        "/SpeechMicBar.js",
        "/SileroVad.js"
    ];

    const isCacheableRequest =
        request => {
            if (
                request.method !==
                "GET"
            ) {
                return false;
            }

            const url =
                new URL(
                    request.url
                );

            if (
                url.origin !==
                self.location.origin
            ) {
                return false;
            }

            if (
                request.headers.has(
                    "range"
                )
            ) {
                return false;
            }

            return cacheablePaths.some(
                path =>
                    path.endsWith("/")
                        ? url.pathname
                            .startsWith(
                                path
                            )
                        : url.pathname ===
                            path
            );
        };

    self.addEventListener(
        "install",
        event => {
            event.waitUntil(
                self.skipWaiting()
            );
        }
    );

    self.addEventListener(
        "activate",
        event => {
            event.waitUntil(
                (async () => {
                    const names =
                        await caches.keys();

                    await Promise.all(
                        names
                            .filter(
                                name =>
                                    name.startsWith(
                                        "wmof-sherpa-"
                                    ) &&
                                    name !==
                                        cacheName
                            )
                            .map(
                                name =>
                                    caches.delete(
                                        name
                                    )
                            )
                    );

                    await self.clients.claim();
                })()
            );
        }
    );

    self.addEventListener(
        "fetch",
        event => {
            if (
                !isCacheableRequest(
                    event.request
                )
            ) {
                return;
            }

            event.respondWith(
                (async () => {
                    const cache =
                        await caches.open(
                            cacheName
                        );

                    const cached =
                        await cache.match(
                            event.request
                        );

                    if (cached) {
                        return cached;
                    }

                    const response =
                        await fetch(
                            event.request
                        );

                    if (
                        response.ok &&
                        (
                            response.type ===
                                "basic" ||
                            response.type ===
                                "cors"
                        )
                    ) {
                        void cache.put(
                            event.request,
                            response.clone()
                        );
                    }

                    return response;
                })()
            );
        }
    );
})();
