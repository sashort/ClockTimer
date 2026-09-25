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

    const readCached = async (cache, request) => {
        try {
            return await cache?.match(request);
        }
        catch {
            return undefined;
        }
    };

    const rememberResponse = async (cache, request, response) => {
        if (
            response.ok &&
            (
                response.type === "basic" ||
                response.type === "cors"
            )
        ) {
            try {
                await cache?.put(
                    request,
                    response.clone()
                );
            }
            catch {}
        }

        return response;
    };

    const loadAsset = async request => {
        let cache;

        try {
            cache = await caches.open(
                cacheName
            );
        }
        catch {}

        const runtimeScript =
            new URL(
                request.url
            )
                .pathname
                .endsWith(
                    ".js"
                );

        if (!runtimeScript) {
            const cached =
                await readCached(
                    cache,
                    request
                );

            if (cached) {
                return cached;
            }

            return rememberResponse(
                cache,
                request,
                await fetch(
                    request
                )
            );
        }

        try {
            const response =
                await fetch(
                    request,
                    {
                        cache:
                            "no-cache"
                    }
                );

            if (response.ok) {
                return rememberResponse(
                    cache,
                    request,
                    response
                );
            }

            return (
                await readCached(
                    cache,
                    request
                )
            ) || response;
        }
        catch (error) {
            const cached =
                await readCached(
                    cache,
                    request
                );

            if (cached) {
                return cached;
            }

            throw error;
        }
    };

    self.addEventListener(
        "fetch",
        event => {
            if (
                isCacheableRequest(
                    event.request
                )
            ) {
                event.respondWith(
                    loadAsset(
                        event.request
                    )
                );
            }
        }
    );
})();
