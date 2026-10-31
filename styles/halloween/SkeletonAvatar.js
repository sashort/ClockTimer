(() => {
    'use strict';
    const entries = new WeakMap(), ns = 'http://www.w3.org/2000/svg'; let counter = 0;
    const make = (tag, attrs = {}) => {
        const e = document.createElementNS(ns,tag);
        for (const [k,v] of Object.entries(attrs)) e.setAttribute(k,v); return e;
    };
    function remove(pose) {
        const e = entries.get(pose); if (!e) return;
        e.head.setAttribute('r',e.radius);
        for (const bone of e.bones) {bone.removeAttribute('marker-start');bone.removeAttribute('marker-mid');bone.removeAttribute('marker-end');}
        e.skull.remove();e.ribs.remove();e.defs.remove();entries.delete(pose);
    }
    function update(pose) {
        const e = entries.get(pose); if (!e) return;
        e.skull.setAttribute('transform',`translate(${Number(e.head.getAttribute('cx')||0)} ${Number(e.head.getAttribute('cy')||0)})`);
        const values = e.spine?.getAttribute('d')?.match(/[-+]?\d*\.\d+|[-+]?\d+/g)?.map(Number);
        if (values?.length >= 4) {
            const a = {x:values[0],y:values[1]}, b = {x:values[2],y:values[3]};
            const top = a.y < b.y ? a : b, bottom = a.y < b.y ? b : a;
            e.ribs.setAttribute('transform',`translate(${top.x} ${top.y}) rotate(${Math.atan2(bottom.y-top.y,bottom.x-top.x)*180/Math.PI-90})`);
        }
    }
    function decorate(pose) {
        const active = globalThis.WMOFSeasonalTheme?.active === true;
        pose.closest('.goal-bar-avatar')?.classList.toggle('is-skeleton',active);
        if (!active) {remove(pose);return;}
        const previous = entries.get(pose);
        if (previous && !pose.contains(previous.head)) remove(pose);
        if (entries.has(pose)) {update(pose);return;}
        const head = pose.querySelector('circle'); if (!head) return;
        const id = 'halloween-joint-' + (++counter), defs = make('defs');
        defs.innerHTML = `<marker id="${id}" viewBox="-2 -2 4 4" markerWidth="2.5" markerHeight="2.5" refX="0" refY="0" markerUnits="userSpaceOnUse"><circle r=".8" fill="#fff2d3" stroke="#21150d" stroke-width=".2"/></marker>`;
        const skull = make('g',{'aria-hidden':'true',class:'halloween-skull'});
        skull.innerHTML = '<path d="M-3.3 0A3.5 3.5 0 1 1 3.3 0L2.2 1.4V3H-2.2V1.4Z" fill="#fff2d3" stroke="none"/><g class="skull-detail"><ellipse cx="-1.35" cy="-.9" rx=".85" ry="1"/><ellipse cx="1.35" cy="-.9" rx=".85" ry="1"/><path d="M0 .1l-.6 1h1.2Z"/></g><path d="M-1.1 1.7v1.2M0 1.7v1.2M1.1 1.7v1.2" fill="none" stroke="#21150d" stroke-width=".4"/>';
        const ribs = make('g',{class:'rib-bones','aria-hidden':'true'});
        ribs.innerHTML = '<path d="M0 2Q-4 1-3.5 4Q-2 5.5 0 5Q2 5.5 3.5 4Q4 1 0 2M0 5Q-3.5 4-2.8 7Q-2 8 0 8Q2 8 2.8 7Q3.5 4 0 5M-2.5 10L0 12L2.5 10"/>';
        const spine = pose.querySelector('.rig-spine,.run-cycle>path:not([class]),.moon-body>path:not([class])') || [...pose.children].find(e => e.localName === 'path');
        const bones = [...pose.querySelectorAll('.run-arm,.run-leg,.moon-arm,.moon-leg,.rig-leg-0,.rig-leg-1,.rig-arm-0,.rig-arm-1,.gesture-upper,.fist path')];
        for (const bone of bones) for (const name of ['marker-start','marker-mid','marker-end']) bone.setAttribute(name,`url(#${id})`);
        const radius = head.getAttribute('r'); head.setAttribute('r','0');
        head.parentElement.append(skull); (spine?.parentElement || head.parentElement).append(ribs); pose.prepend(defs);
        entries.set(pose,{head,spine,skull,ribs,defs,bones,radius}); update(pose);
    }
    globalThis.WMOFHalloweenAvatar = Object.freeze({decorate,update,get scale(){return globalThis.WMOFSeasonalTheme?.active===true?2:1;}});
})();
