const CACHE_PREFIX =
    "wmof-sherpa-";

const workerUrl =
    new URL(
        self.location.href
    );

const cacheVersion =
    workerUrl.search
        ? encodeURIComponent(
            workerUrl.search
        )
        : "unversioned";

const CACHE_NAME =
    CACHE_PREFIX +
    cacheVersion;

const scopeUrl =
    new URL(
        self.registration.scope
    );

const scopePath =
    scopeUrl.pathname.endsWith("/")
        ? scopeUrl.pathname
        : scopeUrl.pathname + "/";

function versionedUrl(path) {
    const url =
        new URL(
            path,
            scopeUrl
        );

    if (workerUrl.search) {
        url.search =
            workerUrl.search;
    }

    return url.href;
}

function isSherpaAsset(request) {
    if (
        request.method !== "GET" ||
        request.headers.has("range")
    ) {
        return false;
    }

    const url =
        new URL(
            request.url
        );

    if (
        url.origin !==
        scopeUrl.origin
    ) {
        return false;
    }

    return (
        url.pathname ===
            scopePath +
                "SherpaRecognizer.js" ||
        url.pathname ===
            scopePath +
                "speech/SherpaWorker.js" ||
        url.pathname.startsWith(
            scopePath +
                "speech/sherpa/runtime/"
        )
    );
}

self.addEventListener(
    "install",
    event => {
        event.waitUntil(
            (async () => {
                const cache =
                    await caches.open(
                        CACHE_NAME
                    );

                await Promise.allSettled(
                    [
                        versionedUrl(
                            "SherpaRecognizer.js"
                        ),
                        versionedUrl(
                            "speech/SherpaWorker.js"
                        )
                    ].map(
                        async url => {
                            const response =
                                await fetch(
                                    url,
                                    {
                                        cache:
                                            "reload"
                                    }
                                );

                            if (response.ok) {
                                await cache.put(
                                    url,
                                    response
                                );
                            }
                        }
                    )
                );

                await self.skipWaiting();
            })()
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
                                    CACHE_PREFIX
                                ) &&
                                name !==
                                    CACHE_NAME
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
            !isSherpaAsset(
                event.request
            )
        ) {
            return;
        }

        event.respondWith(
            (async () => {
                const cache =
                    await caches.open(
                        CACHE_NAME
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
                    response.type !==
                        "opaque"
                ) {
                    await cache.put(
                        event.request,
                        response.clone()
                    );
                }

                return response;
            })()
        );
    }
);
