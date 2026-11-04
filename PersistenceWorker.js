"use strict";
let database;
function openDatabase() {
    return database ??= new Promise((resolve, reject) => {
        const request = indexedDB.open("clocktimer-persistence", 2);
        request.onupgradeneeded = () => {
            const store = request.result.objectStoreNames.contains("values")
                ? request.transaction.objectStore("values")
                : request.result.createObjectStore("values");
            store.delete("wmof-recognizer-names-v1");
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("Browser storage is blocked by another tab."));
        request.onsuccess = () => {
            const db = request.result;
            db.onversionchange = () => {db.close(); database = undefined;};
            resolve(db);
        };
    }).catch(error => {database = undefined;throw error;});
}
async function operate({operation, key, value}) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("values", operation === "entries" ? "readonly" : "readwrite");
        const store = transaction.objectStore("values");
        let result;
        if (operation === "entries") {
            result = [];
            const cursor = store.openCursor();
            cursor.onsuccess = () => {
                const entry = cursor.result;
                if (entry) {result.push([entry.key, entry.value]); entry.continue();}
            };
        } else if (operation === "batch") {
            for (const [entryKey, entryValue] of value) store.put(entryValue, entryKey);
        }
        else if (operation === "set") store.put(value, key);
        else if (operation === "delete") store.delete(key);
        else {transaction.abort(); reject(new Error("Unknown storage operation.")); return;}
        // A request succeeding does not imply that its transaction committed.
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error("Browser storage write failed."));
    });
}
let queue = Promise.resolve();
self.onmessage = ({data}) => {
    const work = queue.then(() => operate(data));
    queue = work.catch(() => {});
    work.then(result => self.postMessage({id: data.id, result}),
        error => self.postMessage({id: data.id, error: error.message || String(error), errorName: error.name,
            retryable: !["DataCloneError", "SecurityError", "NotSupportedError"].includes(error.name)}));
};
