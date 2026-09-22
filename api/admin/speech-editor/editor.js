(() => {
    "use strict";
    const $ = id => document.getElementById(id);
    const frame = $("appFrame");
    const form = $("attributeForm");
    const fields = ["speech-pattern", "speech-function", "speech-preproc", "speech-preproc-context", "speech-preproc-field"];
    const names = [...fields, "speech-modal"];
    const endpoint = "../../speech-editor-config/";
    let saved = [], draft = [], revision = "empty", selectedTarget = "", selectedId = "", overlay = true, highlighted;
    let frameDocument;

    const status = (message, error = false) => { $("status").textContent = message; $("status").classList.toggle("error", error); };
    const dirty = () => JSON.stringify(draft) !== JSON.stringify(saved);
    const updateButtons = () => { $("saveButton").disabled = $("discardButton").disabled = !dirty(); };
    const selectorFor = element => {
        if (element.id) return `#${CSS.escape(element.id)}`;
        const parts = [];
        for (let node = element; node && node !== frameDocument.body; node = node.parentElement) {
            if (node.id) { parts.unshift(`#${CSS.escape(node.id)}`); break; }
            const siblings = [...node.parentElement.children].filter(sibling => sibling.tagName === node.tagName);
            parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
        }
        return parts.join(" > ");
    };
    const findControl = element => element.closest("button,a,input,select,textarea,summary,dialog,[popover],[role=button],[onclick],[onpointerdown],[ondblclick],[speech-pattern]") || element;
    const targetElement = () => {
        try { return selectedTarget ? frameDocument?.querySelector(selectedTarget) : null; }
        catch { return null; }
    };
    const snapshot = element => Object.fromEntries(names.filter(name => element.hasAttribute(name)).map(name => [name, element.getAttribute(name)]));
    const builtins = () => {
        if (!frameDocument || !selectedTarget) return [];
        const result = [];
        const control = targetElement();
        for (const element of frameDocument.querySelectorAll("[data-speech-editor-id][data-speech-target]")) {
            if (element.dataset.speechEditorId.startsWith("edit:")) continue;
            try { if (!control?.matches(element.dataset.speechTarget)) continue; }
            catch { continue; }
            result.push({id:element.dataset.speechEditorId, kind:"existing", target:selectedTarget, attrs:snapshot(element)});
        }
        return result;
    };
    const available = () => {
        const map = new Map(builtins().map(entry => [entry.id, entry]));
        for (const entry of draft.filter(item => item.target === selectedTarget)) map.set(entry.id, entry);
        const control = targetElement();
        if (control?.hasAttribute("speech-pattern") && ![...map.values()].some(entry => entry.kind === "attribute")) {
            const id = control.dataset.speechEditorId || `attribute:${selectedTarget.replace(/[^A-Za-z0-9_-]/g, "_")}`;
            map.set(id, {id, kind:"attribute", target:selectedTarget, attrs:snapshot(control)});
        }
        return [...map.values()];
    };
    const activeEntry = () => available().find(entry => entry.id === selectedId);
    const writableEntry = () => {
        let entry = draft.find(item => item.id === selectedId);
        if (!entry) {
            const baseline = activeEntry();
            if (!baseline) return null;
            entry = structuredClone(baseline);
            draft.push(entry);
        }
        return entry;
    };
    const labelFor = entry => entry.kind === "modal" ? "<speech-modal>" : entry.kind === "attribute" ? "Control attributes" : entry.id.startsWith("builtin:") ? entry.id.split(":")[1] : "<speech-command>";
    const renderList = () => {
        const list = $("elementList");
        list.replaceChildren();
        if (!selectedTarget) return;
        const entries = available();
        if (!entries.length) { const empty = document.createElement("span"); empty.className = "empty"; empty.textContent = "No speech elements yet."; list.append(empty); }
        for (const entry of entries) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = labelFor(entry);
            button.classList.toggle("selected", entry.id === selectedId);
            button.addEventListener("click", () => { selectedId = entry.id; render(); });
            list.append(button);
        }
    };
    const renderForm = () => {
        const entry = activeEntry();
        form.hidden = !entry;
        if (!entry) return;
        for (const name of fields) form.elements.namedItem(name).value = entry.attrs[name] ?? "";
        const modalValue = Object.hasOwn(entry.attrs, "speech-modal") ? entry.attrs["speech-modal"] : null;
        $("modalValue").value = modalValue === null ? "__absent__" : modalValue === "" ? "__empty__" : modalValue === "top-level" ? "top-level" : "__custom__";
        $("modalCustom").hidden = $("modalValue").value !== "__custom__";
        $("modalCustom").value = $("modalValue").value === "__custom__" ? modalValue : "";
        const isModal = entry.kind === "modal";
        for (const label of form.querySelectorAll("[data-for]")) label.hidden = isModal;
        $("moreAttributes").hidden = isModal;
        $("parentField").hidden = entry.kind !== "command";
        const parent = $("parentSelect");
        parent.replaceChildren(new Option("None", ""));
        for (const group of available().filter(item => item.kind === "modal" && item.id !== entry.id)) parent.add(new Option(group.id, group.id));
        parent.value = entry.parentId || "";
        $("removeButton").textContent = entry.kind === "existing" ? "Disable this command" : "Remove selected element";
    };
    const render = () => { renderList(); renderForm(); updateButtons(); };
    const select = element => {
        if (highlighted?.isConnected) highlighted.style.removeProperty("outline");
        highlighted = element;
        highlighted.style.setProperty("outline", "4px dashed #a9ddf7", "important");
        selectedTarget = selectorFor(element);
        selectedId = "";
        $("selectedTitle").textContent = element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 40) || element.tagName.toLowerCase();
        $("selectedPath").textContent = selectedTarget;
        $("addButton").disabled = false;
        render();
    };
    const intercept = event => {
        if (!overlay) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.type === "pointerdown" || event.type === "click") select(findControl(event.target));
    };
    const attachFrame = () => {
        frameDocument = frame.contentDocument;
        if (!frameDocument) return;
        for (const type of ["pointerdown", "pointerup", "click", "dblclick"]) frameDocument.addEventListener(type, intercept, true);
        highlighted = undefined;
        selectedTarget = selectedId = "";
        $("selectedTitle").textContent = "Select a control";
        $("selectedPath").textContent = "Click a control in the preview.";
        $("addButton").disabled = true;
        frame.classList.toggle("editor-overlay-on", overlay);
        frame.classList.toggle("editor-overlay-off", !overlay);
        render();
    };
    if (frame.contentDocument?.readyState === "complete") attachFrame();
    frame.addEventListener("load", attachFrame);
    $("overlayToggle").addEventListener("click", () => {
        overlay = !overlay;
        $("overlayToggle").textContent = `Overlay: ${overlay ? "On" : "Off"}`;
        $("overlayToggle").setAttribute("aria-pressed", String(overlay));
        frame.classList.toggle("editor-overlay-on", overlay);
        frame.classList.toggle("editor-overlay-off", !overlay);
    });
    $("addButton").addEventListener("click", () => {
        if (!selectedTarget) return;
        const kind = $("elementType").value;
        const id = `edit:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        const insideScopedContainer = !!targetElement()?.closest("dialog,[popover]");
        const attrs = kind === "modal" || (kind === "command" && !insideScopedContainer) ? {"speech-modal":"top-level"} : {};
        const entry = {id, kind, target:selectedTarget, attrs};
        draft.push(entry);
        selectedId = id;
        render();
        form.elements.namedItem(kind === "modal" ? "speech-modal" : "speech-pattern")?.focus?.();
        status(`Added ${kind === "attribute" ? "control attributes" : `<speech-${kind}>`} to the draft.`);
    });
    for (const name of fields) form.elements.namedItem(name).addEventListener("input", event => {
        const entry = writableEntry();
        if (!entry) return;
        if (event.target.value) entry.attrs[name] = event.target.value;
        else delete entry.attrs[name];
        updateButtons();
    });
    const updateModal = () => {
        const entry = writableEntry();
        if (!entry) return;
        const choice = $("modalValue").value;
        $("modalCustom").hidden = choice !== "__custom__";
        if (choice === "__absent__") delete entry.attrs["speech-modal"];
        else entry.attrs["speech-modal"] = choice === "__empty__" ? "" : choice === "__custom__" ? $("modalCustom").value : choice;
        updateButtons();
    };
    $("modalValue").addEventListener("change", updateModal);
    $("modalCustom").addEventListener("input", updateModal);
    $("parentSelect").addEventListener("change", event => {
        const entry = writableEntry();
        if (!entry) return;
        if (event.target.value) { entry.parentId = event.target.value; delete entry.attrs["speech-modal"]; }
        else { delete entry.parentId; entry.attrs["speech-modal"] = "top-level"; }
        renderForm(); updateButtons();
    });
    $("removeButton").addEventListener("click", () => {
        const entry = activeEntry();
        if (!entry) return;
        if (entry.id.startsWith("builtin:")) {
            const item = writableEntry();
            item.attrs = {};
            status("Command disabled in the draft.");
        } else if (entry.kind === "attribute" && !entry.id.startsWith("edit:")) {
            const item = writableEntry();
            item.attrs = {};
            status("Control speech attributes removed in the draft.");
        } else {
            draft = draft.filter(item => item.id !== entry.id && item.parentId !== entry.id);
            selectedId = "";
            status("Element removed from the draft.");
        }
        render();
    });
    $("discardButton").addEventListener("click", () => {
        draft = structuredClone(saved);
        location.reload();
    });
    const validate = () => {
        const resolvesFunction = path => {
            let value = frame.contentWindow;
            for (const part of path.split(".")) value = value?.[part];
            return typeof value === "function";
        };
        for (const entry of draft) {
            if (entry.kind === "modal") continue;
            if (!entry.attrs["speech-pattern"] && !entry.id.startsWith("builtin:") && Object.keys(entry.attrs).length) return "New commands need speech-pattern.";
            if (entry.attrs["speech-pattern"] && !entry.attrs["speech-function"]) return "Commands with a pattern need speech-function.";
            if (entry.attrs["speech-pattern"]) {
                try { new RegExp(entry.attrs["speech-pattern"], "i"); }
                catch { return `Invalid pattern: ${entry.attrs["speech-pattern"]}`; }
            }
            for (const name of ["speech-function", "speech-preproc"]) {
                if (entry.attrs[name] && !resolvesFunction(entry.attrs[name])) return `${name} was not found: ${entry.attrs[name]}`;
            }
        }
        return "";
    };
    $("saveButton").addEventListener("click", async () => {
        const error = validate();
        if (error) { status(error, true); return; }
        $("saveButton").disabled = true;
        try {
            const response = await fetch(endpoint, {method:"PUT", credentials:"same-origin", headers:{"Content-Type":"application/json", "X-CSRF-Token":document.body.dataset.csrf}, body:JSON.stringify({entries:draft, revision})});
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Save failed.");
            saved = structuredClone(data.entries);
            draft = structuredClone(saved);
            revision = data.revision;
            frame.contentWindow.location.reload();
            status("Speech commands saved.");
        } catch (error) { status(error.message, true); }
        updateButtons();
    });
    addEventListener("beforeunload", event => { if (dirty()) { event.preventDefault(); event.returnValue = ""; } });
    fetch(endpoint, {credentials:"same-origin", cache:"no-store"}).then(response => response.json()).then(data => {
        if (!Array.isArray(data.entries)) throw new Error(data.message || "Configuration unavailable.");
        saved = structuredClone(data.entries);
        draft = structuredClone(saved);
        revision = data.revision;
        render();
    }).catch(error => status(error.message, true));
})();
