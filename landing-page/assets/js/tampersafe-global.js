function initGlobalAttributes() {
    gsap.utils.toArray("[global]").forEach((e => {
        e.getAttribute("global").split(",").map((e => e.trim())).forEach((t => {
            const n = GLOBAL_HANDLERS[t];
            n?.(e)
        }))
    }))
}

function initGridsReveal(e) {
    gsap.utils.toArray(e).forEach((e => {
        const t = e.querySelectorAll("[global-grid-target]"),
            n = t.length > 0 ? gsap.utils.toArray(t) : gsap.utils.toArray(e.children);
        gsap.set(n, {
            opacity: 0,
            y: 24,
            willChange: "opacity, transform"
        }), gsap.to(n, {
            opacity: 1,
            y: 0,
            duration: .4,
            stagger: .1,
            ease: "DeepBook",
            scrollTrigger: {
                trigger: e,
                start: "top bottom-=20%",
                once: !0
            }
        })
    }))
}

function initTextStagger(e) {
    if (_isMobile && !e.hasAttribute("global-mobile")) return;
    const t = e.querySelector("[global-target]") || e;
    if (!t.hasAttribute("data-weglot-text")) {
        const e = t.textContent.trim();
        t.setAttribute("data-weglot-text", e)
    }
    e._splitInstance && e._splitInstance.revert();
    const n = t.getAttribute("data-weglot-text");
    t.textContent = n;
    const o = !0,
        r = new SplitText(t, {
            type: o ? "words" : "chars"
        });
    e._splitInstance = r;
    const i = o ? r.words : r.chars;
    gsap.set(i, {
        y: 0,
        opacity: 1
    }), e._mouseEnterHandler && e.removeEventListener("mouseenter", e._mouseEnterHandler), e._mouseLeaveHandler && e.removeEventListener("mouseleave", e._mouseLeaveHandler), e._mouseEnterHandler = () => {
        gsap.to(i, {
            y: "-100%",
            stagger: o ? .02 : .01,
            duration: .2,
            ease: o ? "DeepBook" : "expo.out"
        })
    }, e._mouseLeaveHandler = () => {
        gsap.to(i, {
            y: "0%",
            stagger: o ? .02 : .01,
            duration: .2,
            ease: o ? "DeepBook" : "expo.out"
        })
    }, e.addEventListener("mouseenter", e._mouseEnterHandler), e.addEventListener("mouseleave", e._mouseLeaveHandler)
}

function initContinuousCarousel() {
    const e = document.querySelectorAll("[data-carousel]");
    if (!e.length) return;
    let t = null,
        n = null;
    const o = [];
    window.addEventListener("mousemove", (e => {
        t = e.clientX, n = e.clientY
    })), lenis.on("scroll", (() => {
        o.forEach((e => e()))
    })), e.forEach(((e, r) => {
        const i = e.querySelector("[data-carousel-track]"),
            a = i?.querySelector("[data-carousel-item]");
        if (!i || !a) return;
        const s = parseFloat(e.dataset.carouselSpeed || 15),
            l = parseFloat(e.dataset.carouselSpeedMobile || s),
            c = window.matchMedia("(max-width: 768px)").matches,
            d = c ? l : s,
            u = parseInt(e.dataset.carouselDuplicate || 2, 10),
            g = document.createDocumentFragment();
        for (let e = 0; e < u; e++) g.appendChild(a.cloneNode(!0));
        i.appendChild(g);
        const p = Array.from(i.querySelectorAll("[data-carousel-item]")),
            h = p.length,
            m = new Array(h).fill(0);
        let f = !1;
        const y = 100 * h,
            b = gsap.utils.wrap(-100, y - 100),
            w = e => {
                for (let t = 0; t < h; t++) {
                    const n = 100 * t,
                        o = b(n + m[t] + e);
                    m[t] = o - n, gsap.set(p[t], {
                        xPercent: m[t]
                    })
                }
            },
            v = 100 / d;
        let C = performance.now();
        const E = () => {
            const e = performance.now(),
                t = (e - C) / 1e3;
            C = e, f || w(-v * t)
        };
        gsap.ticker.add(E);
        const x = {
            pause: () => {
                f = !0
            },
            resume: () => {
                f = !1
            }
        };
        if (c) {
            const t = document.createElement("div");
            let n = i.getBoundingClientRect().width,
                o = n / h;
            return window.addEventListener("resize", (() => {
                n = i.getBoundingClientRect().width, o = n / h
            })), void Draggable.create(t, {
                type: "x",
                trigger: e,
                inertia: !0,
                allowNativeTouchScrolling: !1,
                dragResistance: 0,
                onPressInit() {
                    x.pause(), gsap.killTweensOf(t), gsap.set(t, {
                        x: 0
                    }), this.lastDragX = 0
                },
                onDrag() {
                    const e = this.x - this.lastDragX;
                    this.lastDragX = this.x, w(e / o * 100 * .1)
                },
                onThrowUpdate() {
                    const e = this.x - this.lastDragX;
                    this.lastDragX = this.x, w(e / o * 100 * .1)
                },
                onThrowComplete() {
                    x.resume()
                },
                onRelease() {
                    this.tween && this.tween.isActive() || x.resume()
                }
            })
        }
        const S = 1.25 * parseFloat(getComputedStyle(e).fontSize),
            A = Array.from(i.querySelectorAll(".carousel__marquee-item"));
        if (!A.length) return;
        const T = A[0].getBoundingClientRect().width,
            k = 3 * T,
            q = 0 === r ? 2 : 3,
            L = A.map((e => {
                const t = getComputedStyle(e);
                return {
                    bg: t.backgroundColor,
                    color: t.color,
                    border: t.borderColor
                }
            })),
            B = A.map((e => gsap.quickTo(e, "y", {
                duration: .25,
                ease: "power3.out"
            })));
        let R = null,
            _ = -1;
        const D = e => {
                gsap.to(A[e], {
                    backgroundColor: "#1E6EF3",
                    color: "#FFFFFF",
                    borderColor: "#1E6EF3",
                    duration: .2,
                    ease: "power2.out",
                    overwrite: "auto"
                })
            },
            O = e => {
                gsap.to(A[e], {
                    backgroundColor: L[e].bg,
                    color: L[e].color,
                    borderColor: L[e].border,
                    duration: .2,
                    ease: "power2.out",
                    overwrite: "auto"
                })
            },
            F = () => {
                if (null === t) return;
                const o = e.getBoundingClientRect();
                n >= o.top && n <= o.bottom && t >= o.left && t <= o.right ? R = t : null !== R && (R = null, B.forEach((e => e(0))), -1 !== _ && (O(_), _ = -1))
            },
            M = () => {
                if (null === R) return;
                let e = -1,
                    t = 1 / 0;
                for (let n = 0; n < A.length; n++) {
                    const o = A[n].getBoundingClientRect(),
                        r = o.left + o.width / 2,
                        i = Math.abs(R - r);
                    if (i >= k) B[n](0);
                    else {
                        const o = i / k,
                            r = Math.pow(1 - o, q);
                        B[n](-S * r), i < t && i < T / 2 && (t = i, e = n)
                    }
                }
                e !== _ && (-1 !== _ && O(_), -1 !== e && D(e), _ = e)
            };
        e.addEventListener("mousemove", (t => {
            const n = e.getBoundingClientRect();
            t.clientY >= n.top && t.clientY <= n.bottom && t.clientX >= n.left && t.clientX <= n.right && (R = t.clientX)
        })), e.addEventListener("mouseleave", (() => {
            null !== R && (R = null, B.forEach((e => e(0))), -1 !== _ && (O(_), _ = -1))
        })), o.push(F), gsap.ticker.add(M)
    }))
}

function initMobileDropdown() {
    function e(e) {
        const t = e.querySelector("[global-dd-content]");
        e.classList.remove("is-open"), gsap.to(t, {
            height: 0,
            duration: .4,
            ease: "power2.inOut",
            onStart: () => {
                t.style.overflow = "hidden"
            }
        })
    }

    function t(e) {
        const t = e.querySelector("[global-dd-content]");
        e.classList.add("is-open"), gsap.set(t, {
            overflow: "hidden"
        }), gsap.fromTo(t, {
            height: 0
        }, {
            height: t.scrollHeight,
            duration: .4,
            ease: "power2.inOut",
            onComplete: () => {
                t.style.height = "auto"
            }
        })
    }

    function n() {
        r.forEach((n => {
            const r = n.querySelectorAll("[global-dd-wrapper]");
            r.forEach(((n, i) => {
                const a = n.querySelector("[global-dd-toggle]"),
                    s = n.querySelector("[global-dd-content]");
                if (a && s) return o.matches ? void(n.classList.contains("is-init") || (n.classList.add("is-init"), s.style.overflow = "hidden", 0 === i ? (n.classList.add("is-open"), s.style.height = "auto") : s.style.height = "0px", a.addEventListener("click", (() => {
                    const o = n.classList.contains("is-open");
                    r.forEach((t => {
                        t !== n && e(t)
                    })), o ? e(n) : t(n)
                })))) : (gsap.killTweensOf(s), s.style.height = "", s.style.overflow = "", void n.classList.remove("is-open"))
            }))
        }))
    }
    const o = window.matchMedia("(max-width: 767px)"),
        r = document.querySelectorAll("[global-dd]");
    n(), o.addEventListener("change", n)
}

function initInfoCount() {
    const e = document.querySelectorAll(".global_info-item"),
        t = [],
        n = e => {
            const t = e.querySelector(".global_info-number");
            if (!t) return null;
            t.hasAttribute("data-original") || t.setAttribute("data-original", t.textContent.trim());
            const n = t.getAttribute("data-original"),
                o = /\d/g;
            if (!n.match(o)) return null;
            t.textContent = n, t.style.display = "";
            const r = getComputedStyle(t),
                i = parseFloat(r.lineHeight) || 1.2 * parseFloat(r.fontSize),
                a = [];
            let s = 0;
            n.replace(o, ((e, t) => {
                t > s && a.push({
                    type: "static",
                    text: n.slice(s, t)
                }), a.push({
                    type: "digit",
                    value: parseInt(e, 10)
                }), s = t + 1
            })), s < n.length && a.push({
                type: "static",
                text: n.slice(s)
            }), t.innerHTML = "", t.style.display = "inline-flex";
            const l = [];
            a.forEach((e => {
                if ("static" === e.type) {
                    const n = document.createElement("span");
                    n.textContent = e.text, n.style.whiteSpace = "pre", t.appendChild(n)
                } else {
                    const n = document.createElement("span");
                    n.style.cssText = `display:inline-block;height:${i}px;overflow:hidden;vertical-align:top;`;
                    const o = document.createElement("span");
                    o.style.cssText = `display:flex;flex-direction:column;line-height:${i}px;`;
                    const r = 11;
                    for (let t = 0; t < r; t++) {
                        const n = document.createElement("span");
                        n.textContent = 0 === t ? e.value : (e.value + t) % 10, n.style.cssText = `height:${i}px;display:flex;align-items:center;justify-content:center;`, o.appendChild(n)
                    }
                    n.appendChild(o), t.appendChild(n);
                    const a = document.createElement("span");
                    a.textContent = e.value, a.style.cssText = "visibility:hidden;position:absolute;white-space:pre;", t.appendChild(a);
                    const s = a.getBoundingClientRect().width;
                    t.removeChild(a), n.style.width = `${s}px`, l.push({
                        inner: o
                    })
                }
            }));
            const c = l.map((e => e.inner)),
                d = -10 * i;
            gsap.set(c, {
                y: d
            });
            const u = e.querySelector(".global_info-desc");
            let g = null,
                p = null,
                h = null,
                m = null;
            return u && (u.hasAttribute("data-original") || u.setAttribute("data-original", u.textContent.trim()), u.textContent = u.getAttribute("data-original"), h = getComputedStyle(u).color, m = new SplitText(u, {
                type: "chars"
            }), g = m.chars, p = g.map((e => e.textContent)), g.forEach(((e, t) => {
                const n = e.getBoundingClientRect().width;
                e.style.display = "inline-block", e.style.width = `${n}px`, e.style.textAlign = "center", " " !== p[t] && (e.textContent = "0")
            }))), {
                item: e,
                numberEl: t,
                innerEls: c,
                startY: d,
                descEl: u,
                descChars: g,
                descOriginals: p,
                descOriginalColor: h,
                descSplit: m
            }
        },
        o = e => {
            const {
                innerEls: t,
                startY: n,
                descChars: o,
                descOriginals: r,
                descOriginalColor: i
            } = e;
            if (gsap.killTweensOf(t), gsap.set(t, {
                    y: n
                }), gsap.to(t, {
                    y: 0,
                    duration: .9,
                    ease: "power3.out",
                    stagger: .04,
                    overwrite: !0
                }), o) {
                const e = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`",
                    t = 1.6 / o.length;
                o.forEach(((n, o) => {
                    gsap.killTweensOf(n);
                    const a = o * t;
                    if (" " === r[o]) return void(n.textContent = " ");
                    n.style.color = "#1E6EF3";
                    const s = {
                        t: 0
                    };
                    gsap.to(s, {
                        t: 1,
                        duration: a + .01,
                        ease: "none",
                        onUpdate: () => {
                            n.textContent = e[Math.floor(Math.random() * e.length)]
                        },
                        onComplete: () => {
                            n.textContent = r[o], n.style.color = i
                        }
                    })
                }))
            }
        },
        r = e => {
            e && (gsap.killTweensOf(e.innerEls), e.descChars && gsap.killTweensOf(e.descChars), e.descSplit && e.descSplit.revert(), e.descEl && e.descEl.hasAttribute("data-original") && (e.descEl.textContent = e.descEl.getAttribute("data-original")), e.st && e.st.kill())
        },
        i = r => {
            e.forEach(((e, i) => {
                const a = n(e);
                if (a) {
                    if (t[i] = a, r) {
                        const t = e.getBoundingClientRect();
                        if (t.top < .85 * window.innerHeight && t.bottom > 0) return void o(a)
                    }
                    a.st = ScrollTrigger.create({
                        trigger: e,
                        start: "top 85%",
                        once: !0,
                        onEnter: () => o(a)
                    })
                }
            }))
        };
    let a;
    i(!1);
    let s = window.innerWidth;
    window.addEventListener("resize", (() => {
        window.innerWidth !== s && (s = window.innerWidth, clearTimeout(a), a = setTimeout((() => {
            t.forEach((e => r(e))), t.length = 0, i(!0)
        }), 200))
    }))
}

function initGlobalTabDropdown() {
    document.querySelectorAll("[global-tab-dd]").forEach((e => {
        const t = e.querySelectorAll("[global-tab-dd-item]");
        t.length && (t[0].classList.add("dd-active"), t.forEach((e => {
            const n = e.querySelector("[global-tab-dd-toggle]");
            n?.addEventListener("click", (() => {
                const n = e.classList.contains("dd-active");
                t.forEach((e => {
                    e.classList.remove("dd-active")
                })), n || e.classList.add("dd-active")
            }))
        })))
    }))
}

function getBreakpoint() {
    return window.innerWidth < 768 ? "mobile" : "desktop"
}

function cleanupNav() {
    marqueeAnimation && (marqueeAnimation.kill(), marqueeAnimation = null);
    const e = document.querySelector("[data-wrapper-banner]"),
        t = e?.querySelector('div[style*="display: flex"]');
    if (t && e) {
        const n = t.querySelector("[data-banner]");
        n && e.insertBefore(n, t), t.remove()
    }
    const n = document.querySelector("[nav-banner]");
    n && gsap.set(n, {
        clearProps: "display"
    })
}

function initNav() {
    if ("mobile" === getBreakpoint()) {
        const e = document.querySelector("[data-wrapper-banner]"),
            t = document.querySelector("[data-banner]");
        if (!e || !t) return;
        e.style.willChange = "transform", e.style.backfaceVisibility = "hidden";
        const n = document.createElement("div");
        n.style.display = "flex", n.style.gap = "0.5em", n.style.willChange = "transform", n.style.backfaceVisibility = "hidden", n.style.perspective = "1000px", n.style.width = "fit-content", e.insertBefore(n, e.firstChild), n.appendChild(t);
        const o = parseFloat(getComputedStyle(n).gap) || 0,
            r = t.offsetWidth + o,
            i = e.offsetWidth,
            a = Math.ceil(i / r) + 2;
        for (let e = 0; e < a; e++) {
            const e = t.cloneNode(!0);
            n.appendChild(e)
        }
        marqueeAnimation = gsap.to(n, {
            x: -r,
            duration: 10,
            ease: "none",
            repeat: -1,
            modifiers: {
                x: gsap.utils.unitize((e => parseFloat(e) % r))
            }
        });
        const s = document.querySelector("[nav-banner]"),
            l = s.querySelector(".icon-x");
        if (l) {
            const e = l.cloneNode(!0);
            document.querySelector(".hamburger-component");
            l.parentNode.replaceChild(e, l), e.addEventListener("click", (() => {
                gsap.set(s, {
                    display: "none"
                })
            }))
        }
    } else {
        const e = document.querySelector("[nav-banner]");
        if (!e) return;
        e.querySelectorAll("[data-nav-link]").forEach((e => {
            const t = document.createElement("span");
            t.style.cssText = "\n        position: absolute;\n        bottom: 0;\n        left: 0;\n        width: 100%;\n        height: 1px;\n        background: currentColor;\n        transform: scaleX(0);\n        transform-origin: left center;\n      ", "static" === getComputedStyle(e).position && (e.style.position = "relative"), e.appendChild(t), e.addEventListener("mouseenter", (() => {
                gsap.to(t, {
                    scaleX: 1,
                    duration: .45,
                    transformOrigin: "left center"
                })
            })), e.addEventListener("mouseleave", (() => {
                gsap.to(t, {
                    scaleX: 0,
                    duration: .45,
                    transformOrigin: "right center"
                })
            }))
        }));
        const t = e.querySelector(".icon-x");
        if (t) {
            const n = t.cloneNode(!0);
            t.parentNode.replaceChild(n, t), n.addEventListener("click", (() => {
                gsap.set(e, {
                    display: "none"
                })
            }))
        }
    }
}

function handleResizes() {
    const e = getBreakpoint();
    e !== currentBreakpoint && (cleanupNav(), currentBreakpoint = e, initNav())
}
const lenis = new Lenis({
    autoRaf: !1,
    anchors: !0,
    stopInertiaOnNavigate: !0
});
lenis.on("scroll", ScrollTrigger.update), gsap.ticker.add((e => {
    lenis.raf(1e3 * e)
})), gsap.ticker.lagSmoothing(0), ScrollTrigger.config({
    ignoreMobileResize: !0
}), CustomEase.create("DeepBook", "M0,0 C0.65,0 0.35,1 1,1"), gsap.defaults({
    ease: "DeepBook"
});
const GLOBAL_HANDLERS = {
        textStagger: initTextStagger,
        gridsReveal: initGridsReveal
    },
    _isMobile = matchMedia("(max-width: 768px)").matches;
! function() {
    const e = document.querySelectorAll(".divider-cube_wrapper");
    e.length && e.forEach((e => {
        const t = e.querySelectorAll(".divider-cube");
        if (t.length < 2) return;
        const n = () => (e.offsetWidth - t[0].offsetWidth) / 2;
        gsap.fromTo(t[0], {
            x: () => n()
        }, {
            x: 0,
            ease: "none",
            scrollTrigger: {
                trigger: e,
                start: "top bottom",
                end: "top 30%",
                scrub: 1.1,
                invalidateOnRefresh: !0
            }
        }), gsap.fromTo(t[1], {
            x: () => -n()
        }, {
            x: 0,
            ease: "none",
            scrollTrigger: {
                trigger: e,
                start: "top bottom",
                end: "top 30%",
                scrub: 1.1,
                invalidateOnRefresh: !0
            }
        })
    }))
}(), (function() {
    let globalInitted = false;
    function runGlobal() {
        if (globalInitted) return;
        globalInitted = true;
        try { initGlobalAttributes(); } catch(e){}
        try { gsap.registerPlugin(Draggable, InertiaPlugin); } catch(e){}
        try { initContinuousCarousel(); } catch(e){}
        try { initMobileDropdown(); } catch(e){}
        try { initInfoCount(); } catch(e){}
        try { initGlobalTabDropdown(); } catch(e){}
        try {
            gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
            CustomEase.create("suiEase", "M0,0 C0.19,1 0.22,1 1,1");
            const reveals = document.querySelectorAll("[data-reveal]");
            reveals.forEach(el => {
                try {
                    const sp = SplitText.create(el, { type: "lines" });
                    gsap.set(sp.lines, { transformPerspective: 600, yPercent: 100, rotateX: -45, opacity: 0 });
                    el.classList.add("is-ready");
                    ScrollTrigger.create({
                        trigger: el,
                        start: "top 85%",
                        once: true,
                        onEnter: () => {
                            gsap.to(sp.lines, { yPercent: 0, rotateX: 0, opacity: 1, duration: 0.937, ease: "suiEase", stagger: 0.08 });
                        }
                    });
                } catch(err) {
                    el.classList.add("is-ready");
                }
            });
            ScrollTrigger.refresh();
        } catch(e){}
        try { currentBreakpoint = getBreakpoint(); initNav(); } catch(e){}
    }

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(runGlobal).catch(runGlobal);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runGlobal);
    } else {
        runGlobal();
    }
    setTimeout(runGlobal, 250);
})();

let resizeTimeout, currentBreakpoint = null,
    marqueeAnimation = null;
window.addEventListener("resize", (() => {
    clearTimeout(resizeTimeout), resizeTimeout = setTimeout(handleResizes, 150)
}));