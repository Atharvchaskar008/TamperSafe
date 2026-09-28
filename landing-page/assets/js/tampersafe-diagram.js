CustomEase.create("DeepBook", "M0,0 C0.65,0 0.35,1 1,1"), gsap.defaults({
    ease: "DeepBook"
}), gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase, MorphSVGPlugin, DrawSVGPlugin);
const init = () => {
        initSwiper(), initIllustrationMorph()
    },
    initSwiper = () => {
        const t = document.querySelector("[data-swiper]");
        if (!t) return;
        const e = t.querySelectorAll("[data-swiper-slide]"),
            a = t.querySelectorAll("[data-swiper-dot]"),
            o = e.length,
            r = [...e].map((t => SplitText.create(t, {
                type: "words",
                wordsClass: "split-word",
                mask: "words"
            }))),
            s = [...a].map((t => t.querySelector(".stack_dot-progress"))),
            n = e[0].parentElement,
            l = () => {
                gsap.set(e, {
                    autoAlpha: 1,
                    position: "static"
                });
                let t = 0;
                e.forEach((e => {
                    e.offsetHeight > t && (t = e.offsetHeight)
                })), gsap.set(e, {
                    clearProps: "position"
                }), gsap.set(e, {
                    autoAlpha: 0
                }), n.style.height = t + "px"
            };
        l(), r.forEach((t => gsap.set(t.words, {
            yPercent: 100
        }))), gsap.set(e[0], {
            autoAlpha: 1
        }), gsap.set(r[0].words, {
            yPercent: 0
        }), gsap.set(s, {
            scaleX: 0,
            autoAlpha: 0,
            transformOrigin: "left center"
        }), gsap.set(s[0], {
            autoAlpha: 1
        });
        let i = 0,
            c = null;
        const u = (t, o) => {
                gsap.killTweensOf([e[t], r[t].words, a[t], s[t]]), o ? (gsap.set(e[t], {
                    autoAlpha: 1
                }), gsap.set(r[t].words, {
                    yPercent: 0
                }), gsap.set(a[t], {
                    width: "2.906em"
                }), gsap.set(s[t], {
                    autoAlpha: 1
                })) : (gsap.set(e[t], {
                    autoAlpha: 0
                }), gsap.set(r[t].words, {
                    yPercent: 100
                }), gsap.set(a[t], {
                    width: "5px"
                }), gsap.set(s[t], {
                    autoAlpha: 0
                }))
            },
            d = t => {
                if (t === i) return;
                const n = i;
                i = t, c && c.kill();
                for (let e = 0; e < o; e++) e !== t && e !== n && u(e, !1);
                if (Math.abs(t - n) > 1) return u(n, !1), void u(t, !0);
                gsap.killTweensOf([e[n], e[t], r[n].words, r[t].words, a[n], a[t], s[n], s[t]]), gsap.set(e[t], {
                    autoAlpha: 1
                });
                const l = gsap.timeline({
                    onComplete: () => {
                        i === t && (gsap.set(e[n], {
                            autoAlpha: 0
                        }), gsap.set(r[n].words, {
                            yPercent: 100
                        })), c = null
                    }
                });
                c = l, l.to(r[n].words, {
                    yPercent: -100,
                    stagger: .01,
                    duration: .35
                }, 0), l.fromTo(r[t].words, {
                    yPercent: 100
                }, {
                    yPercent: 0,
                    stagger: .01,
                    duration: .35
                }, .1), l.to(a[n], {
                    width: "5px",
                    duration: .4
                }, 0), l.to(a[t], {
                    width: "2.906em",
                    duration: .4
                }, 0), l.to(s[n], {
                    autoAlpha: 0,
                    duration: .3
                }, 0), l.to(s[t], {
                    autoAlpha: 1,
                    duration: .3
                }, 0)
            },
            p = 1 / o;
        ScrollTrigger.create({
            trigger: t,
            start: "top top",
            end: "bottom bottom",
            scrub: !0,
            onUpdate: t => {
                const e = t.progress,
                    a = Math.min(Math.floor(e / p), o - 1),
                    r = (e - a * p) / p;
                s.forEach(((t, e) => {
                    e < a ? gsap.set(t, {
                        scaleX: 1
                    }) : e > a ? gsap.set(t, {
                        scaleX: 0
                    }) : gsap.set(t, {
                        scaleX: r
                    })
                })), a !== i && d(a)
            }
        });
        let h, g = window.innerWidth;
        window.addEventListener("resize", (() => {
            window.innerWidth !== g && (g = window.innerWidth, clearTimeout(h), h = setTimeout((() => {
                c && c.kill(), r.forEach((t => t.revert()));
                const t = [...e].map((t => SplitText.create(t, {
                    type: "words",
                    wordsClass: "split-word",
                    mask: "words"
                })));
                r.length = 0, r.push(...t), l(), r.forEach(((t, a) => {
                    a === i ? (gsap.set(e[a], {
                        autoAlpha: 1
                    }), gsap.set(t.words, {
                        yPercent: 0
                    })) : (gsap.set(e[a], {
                        autoAlpha: 0
                    }), gsap.set(t.words, {
                        yPercent: 100
                    }))
                }))
            }), 200))
        }))
    },
    initIllustrationMorph = () => {
        const t = document.querySelector("[data-swiper]"),
            e = t.querySelector("[data-illustration-svg]");
        if (!e) return;
        const a = e.querySelector("[data-pillars]"),
            o = e.querySelector("[data-caps-always]"),
            r = e.querySelector("[data-labels]"),
            s = e.querySelector("[data-outline-path]"),
            n = e.querySelector("[data-l3-platform]"),
            l = (e.querySelector("[data-l3-roof]"), e.querySelector("[data-l3-side-r]"), e.querySelector("[data-l3-side-l]"), e.querySelector("[data-l3-decorations]")),
            i = e.querySelectorAll("[data-l3-deco-line]"),
            c = e.querySelectorAll("[data-l3-deco-circle]"),
            u = e.querySelector("[data-lego-caps]"),
            d = [...e.querySelectorAll("[data-lego-cap]")].sort(((t, e) => {
                const a = parseFloat(t.dataset.cx) - 149.07,
                    o = parseFloat(t.dataset.cy) - 203.5,
                    r = parseFloat(e.dataset.cx) - 149.07,
                    s = parseFloat(e.dataset.cy) - 203.5;
                return Math.hypot(a, o) - Math.hypot(r, s)
            })),
            p = e.querySelector("[data-cube]"),
            h = e.querySelector("[data-blue-cube]"),
            g = e.querySelectorAll("[data-blue-line]");
        gsap.set(a, {
            autoAlpha: 0
        }), gsap.set(o, {
            autoAlpha: 0
        }), gsap.set(r, {
            autoAlpha: 0
        }), gsap.set(s, {
            drawSVG: "0%",
            autoAlpha: 0
        }), gsap.set(n, {
            autoAlpha: 0
        }), gsap.set(l, {
            autoAlpha: 0
        }), gsap.set(i, {
            drawSVG: "0%"
        }), gsap.set(c, {
            scale: 0,
            transformOrigin: "center center"
        }), d.forEach((t => {
            gsap.set(t, {
                scale: 0,
                svgOrigin: t.dataset.cx + " " + t.dataset.cy
            })
        })), gsap.set(p, {
            scale: 0,
            transformOrigin: "165.43px 266.87px"
        }), gsap.set(h, {
            scale: 0,
            transformOrigin: "165.43px 120.51px"
        }), gsap.set(g[0], {
            attr: {
                x2: 165.43,
                y2: 47.51
            }
        }), gsap.set(g[1], {
            attr: {
                x2: 330.43,
                y2: 47.51
            }
        });
        const y = {
                0: "M328.485 106.584L166.884 191.294L1.53418 106.584L166.884 20.3875L328.485 106.584Z",
                1: "M167.431 191.221V286.058L328.749 202.076V106.757L167.431 191.221Z",
                2: "M167.061 191.225V287.052L1.25098 203.054V106.745L167.061 191.225Z",
                3: "M39.3896 96.9675C44.1871 96.9675 48.5052 98.0452 51.6055 99.7605C54.7236 101.486 56.5029 103.787 56.5029 106.207C56.5027 108.627 54.7234 110.927 51.6055 112.652C48.5052 114.367 44.1871 115.445 39.3896 115.445C34.5922 115.445 30.274 114.367 27.1738 112.652C24.0562 110.927 22.2766 108.627 22.2764 106.207C22.2764 103.787 24.056 101.486 27.1738 99.7605C30.274 98.0452 34.5922 96.9676 39.3896 96.9675Z",
                4: "M293.603 96.9675C298.4 96.9675 302.718 98.0452 305.818 99.7605C308.936 101.486 310.716 103.787 310.716 106.207C310.716 108.627 308.936 110.927 305.818 112.652C302.718 114.367 298.4 115.445 293.603 115.445C288.805 115.445 284.487 114.367 281.387 112.652C278.269 110.927 276.489 108.627 276.489 106.207C276.489 103.787 278.269 101.486 281.387 99.7605C284.487 98.0452 288.805 96.9676 293.603 96.9675Z",
                5: "M166.351 160.6C171.148 160.6 175.466 161.678 178.566 163.393C181.685 165.119 183.464 167.419 183.464 169.84C183.464 172.26 181.684 174.56 178.566 176.285C175.466 178 171.148 179.078 166.351 179.078C161.553 179.078 157.235 178 154.135 176.285C151.017 174.56 149.238 172.26 149.237 169.84C149.237 167.419 151.017 165.118 154.135 163.393C157.235 161.678 161.553 160.6 166.351 160.6Z",
                6: "M166.351 93.2253C171.148 93.2253 175.466 94.3031 178.566 96.0183C181.685 97.7435 183.464 100.044 183.464 102.465C183.464 104.885 181.684 107.185 178.566 108.91C175.466 110.625 171.148 111.703 166.351 111.703C161.553 111.703 157.235 110.625 154.135 108.91C151.017 107.185 149.238 104.885 149.237 102.465C149.237 100.044 151.017 97.7435 154.135 96.0183C157.235 94.3031 161.553 93.2254 166.351 93.2253Z",
                7: "M166.351 34.0925C171.148 34.0925 175.466 35.1702 178.566 36.8855C181.685 38.6107 183.464 40.9115 183.464 43.3318C183.464 45.7518 181.684 48.052 178.566 49.7771C175.466 51.4924 171.148 52.5701 166.351 52.5701C161.553 52.57 157.235 51.4924 154.135 49.7771C151.017 48.052 149.238 45.7517 149.237 43.3318C149.237 40.9117 151.017 38.6107 154.135 36.8855C157.235 35.1702 161.553 34.0926 166.351 34.0925Z",
                8: "M185.4 116.56L185.067 116.414L171.624 110.503L119.053 83.0105V64.5896L149.622 67.5466L236.575 102.638C236.575 105.06 236.575 117.342 236.575 120.838C236.575 124.537 235.724 127.654 233.756 130.441C231.816 133.189 228.76 135.657 224.265 138.039L217.032 134.439L216.227 134.038V142.241C207.732 146.601 196.642 148.798 185.521 148.798C174.271 148.798 163.05 146.551 154.518 142.089L80.2998 103.276L80.3008 85.3132L110.854 87.8123L184.599 123.646L185.4 124.036V116.56Z",
                9: "M215.581 123.38C207.175 127.523 196.365 129.61 185.526 129.61C174.277 129.61 163.058 127.364 154.527 122.903L80.9379 84.4186L111.008 68.6936L215.581 123.38ZM224.015 87.2594C232.558 91.7268 236.667 97.4945 236.667 103.122C236.668 108.693 232.64 114.397 224.274 118.845L119.69 64.1524L149.761 48.4274L224.015 87.2594Z",
                12: "M185.398 68.7556L185.065 68.6091L171.622 62.698L119.051 35.2058V16.7849L149.62 19.7419L236.573 54.8337C236.573 57.2554 236.573 69.5371 236.573 73.033C236.573 76.7323 235.722 79.8492 233.754 82.6365C231.814 85.3846 228.758 87.8521 224.263 90.2341L217.03 86.6345L216.225 86.2332V94.4363C207.73 98.7959 196.64 100.993 185.52 100.993C174.269 100.993 163.048 98.746 154.516 94.2839L80.2979 55.4714L80.2988 37.5085L110.852 40.0076L184.597 75.8416L185.398 76.2312V68.7556Z",
                13: "M215.579 75.5751C207.173 79.7183 196.363 81.8051 185.524 81.8051C174.275 81.8051 163.056 79.5594 154.525 75.0979L80.9359 36.6139L111.006 20.8889L215.579 75.5751ZM224.013 39.4547C232.556 43.9221 236.665 49.6898 236.666 55.3176C236.666 60.8879 232.638 66.5927 224.272 71.0407L119.688 16.3477L149.759 0.622715L224.013 39.4547Z"
            },
            m = {
                10: {
                    x1: 216.175,
                    y1: 123.539,
                    x2: 216.175,
                    y2: 135.633
                },
                11: {
                    x1: 224.161,
                    y1: 118.976,
                    x2: 224.161,
                    y2: 137.653
                },
                14: {
                    x1: 216.173,
                    y1: 75.7341,
                    x2: 216.173,
                    y2: 87.8281
                },
                15: {
                    x1: 224.159,
                    y1: 71.1716,
                    x2: 224.159,
                    y2: 89.8481
                }
            },
            f = {
                0: "M325.572 174.926L165.428 258.872L1.57129 174.926L165.429 89.5068L325.572 174.926Z",
                1: "M165.969 258.803V272.004L325.832 188.779V175.1L165.969 258.803Z",
                2: "M165.604 258.807V272.479L1.29102 189.24V175.089L165.604 258.807Z",
                3: "M39.0869 165.409C43.841 165.409 48.1202 166.476 51.1924 168.176C54.2821 169.885 56.0447 172.165 56.0449 174.563C56.0449 176.962 54.2823 179.243 51.1924 180.952C48.1202 182.652 43.841 183.719 39.0869 183.719C34.3326 183.719 30.0527 182.652 26.9805 180.952C23.8906 179.243 22.1279 176.962 22.1279 174.563C22.1281 172.165 23.8908 169.885 26.9805 168.176C30.0527 166.476 34.3326 165.409 39.0869 165.409Z",
                4: "M291.005 165.409C295.759 165.409 300.038 166.476 303.11 168.176C306.2 169.885 307.963 172.165 307.963 174.563C307.963 176.962 306.2 179.243 303.11 180.952C300.038 182.652 295.759 183.719 291.005 183.719C286.251 183.719 281.971 182.652 278.898 180.952C275.809 179.243 274.046 176.962 274.046 174.563C274.046 172.165 275.809 169.885 278.898 168.176C281.971 166.476 286.251 165.409 291.005 165.409Z",
                5: "M164.901 228.464C169.655 228.464 173.935 229.531 177.007 231.23C180.097 232.94 181.859 235.22 181.859 237.618C181.859 240.017 180.097 242.297 177.007 244.007C173.935 245.707 169.655 246.773 164.901 246.773C160.147 246.773 155.867 245.707 152.795 244.007C149.705 242.297 147.942 240.017 147.942 237.618C147.943 235.22 149.705 232.94 152.795 231.23C155.867 229.531 160.147 228.464 164.901 228.464Z",
                6: "M164.901 161.706C169.655 161.706 173.935 162.773 177.007 164.473C180.097 166.182 181.859 168.462 181.859 170.86C181.859 173.259 180.097 175.539 177.007 177.249C173.935 178.949 169.655 180.016 164.901 180.016C160.147 180.016 155.867 178.949 152.795 177.249C149.705 175.539 147.942 173.259 147.942 170.86C147.943 168.462 149.705 166.182 152.795 164.473C155.867 162.773 160.147 161.706 164.901 161.706Z",
                7: "M164.901 103.104C169.655 103.105 173.935 104.171 177.007 105.871C180.097 107.581 181.859 109.861 181.859 112.259C181.859 114.657 180.097 116.938 177.007 118.647C173.935 120.347 169.655 121.414 164.901 121.414C160.147 121.414 155.867 120.347 152.795 118.647C149.705 116.938 147.942 114.657 147.942 112.259C147.943 109.861 149.705 107.581 152.795 105.871C155.867 104.171 160.147 103.104 164.901 103.104Z"
            },
            C = {
                left: {
                    circleSel: '[data-morph="3"]',
                    capCy: 96.97
                },
                right: {
                    circleSel: '[data-morph="4"]',
                    capCy: 96.97
                },
                "c-bot": {
                    circleSel: '[data-morph="5"]',
                    capCy: 160.6
                },
                "c-mid": {
                    circleSel: '[data-morph="6"]',
                    capCy: 93.22
                },
                "c-top": {
                    circleSel: '[data-morph="7"]',
                    capCy: 34.09
                }
            },
            w = Object.entries(C).map((([t, a]) => ({
                name: t,
                circle: e.querySelector(a.circleSel),
                cap: e.querySelector('[data-cap-always][data-name="' + t + '"]'),
                fillEl: e.querySelector('[data-pillar-fill][data-name="' + t + '"]'),
                lineL: e.querySelector('[data-pillar-line][data-name="' + t + '-l"]'),
                lineR: e.querySelector('[data-pillar-line][data-name="' + t + '-r"]'),
                label: e.querySelector('[data-label][data-name="' + t + '"]'),
                info: a
            }))),
            b = {
                left: 39.39,
                right: 293.6,
                "c-top": 166.35,
                "c-mid": 166.35,
                "c-bot": 166.35
            },
            A = 17.11,
            x = 9.24,
            S = () => {
                const t = e.querySelector('[data-morph="6"]');
                let a = 166.35;
                if (t) {
                    const e = t.getBBox();
                    a = e.x + e.width / 2
                }
                w.forEach((({
                    name: t,
                    circle: e,
                    cap: o,
                    fillEl: r,
                    lineL: s,
                    lineR: n,
                    label: l,
                    info: i
                }) => {
                    if (!e) return;
                    const c = e.getBBox(),
                        u = "c-top" === t || "c-mid" === t || "c-bot" === t ? a : c.x + c.width / 2,
                        d = c.y + c.height / 2,
                        p = b[t];
                    let h = i.capCy,
                        g = p;
                    if (o) {
                        const t = o.getBBox(),
                            e = gsap.getProperty(o, "y") || 0,
                            a = gsap.getProperty(o, "x") || 0;
                        h = t.y + t.height / 2 + e, g = p + a
                    }
                    const y = h,
                        m = g - A,
                        f = g + A,
                        C = u - A,
                        w = u + A;
                    if (r && r.setAttribute("d", `M${m},${y} L${f},${y} L${w},${d} L${C},${d} Z`), s && (s.setAttribute("x1", m), s.setAttribute("y1", y), s.setAttribute("x2", C), s.setAttribute("y2", d)), n && (n.setAttribute("x1", f), n.setAttribute("y1", y), n.setAttribute("x2", w), n.setAttribute("y2", d)), l) {
                        let e = (h + x + (d - x)) / 2,
                            a = g;
                        "c-bot" === t ? e += 10 : "c-top" === t ? e -= 8 : "left" === t ? (a = (g + u) / 2, e += 12) : "right" === t && (a = (g + u) / 2), l.setAttribute("x", a), l.setAttribute("y", e), l.setAttribute("transform", `rotate(-90, ${a}, ${e})`)
                    }
                }))
            },
            L = gsap.timeline({
                scrollTrigger: {
                    trigger: t,
                    start: "top top",
                    end: "20% top",
                    scrub: !0
                },
                defaults: {
                    ease: "none"
                }
            });
        L.to(e, {
            attr: {
                viewBox: "0 0 330 300"
            },
            width: 330,
            height: 300
        }, 0), Object.entries(y).forEach((([t, a]) => {
            const o = e.querySelector('[data-morph="' + t + '"]');
            o && L.to(o, {
                morphSVG: a
            }, 0)
        }));
        const M = e.querySelector("[data-roof-clip]");
        M && L.to(M, {
            morphSVG: y[0]
        }, 0), Object.entries(m).forEach((([t, a]) => {
            const o = e.querySelector('[data-morph="' + t + '"]');
            o && L.to(o, {
                attr: a
            }, 0)
        }));
        const q = gsap.timeline({
            scrollTrigger: {
                trigger: t,
                start: "20% top",
                end: "40% top",
                scrub: !0,
                onUpdate: S
            },
            defaults: {
                ease: "none"
            }
        });
        q.to(e, {
            attr: {
                viewBox: "0 0 330 300"
            },
            width: 330,
            height: 300
        }, .25), Object.entries(f).forEach((([t, a]) => {
            const o = e.querySelector('[data-morph="' + t + '"]');
            o && q.to(o, {
                morphSVG: a,
                duration: .75,
                ease: "none"
            }, .25)
        })), M && q.to(M, {
            morphSVG: f[0],
            duration: .75,
            ease: "none"
        }, .25), q.to("[data-central-shadow]", {
            autoAlpha: 0,
            duration: .25,
            ease: "none"
        }, 0), q.to("[data-central-front]", {
            autoAlpha: 0,
            y: -30,
            duration: .25,
            ease: "none"
        }, 0), q.to(a, {
            autoAlpha: 1,
            duration: .01
        }, .25), q.to(o, {
            autoAlpha: 1,
            duration: .25,
            ease: "none"
        }, 0), q.to("[data-cap-always]", {
            y: -15,
            duration: .75,
            ease: "none"
        }, .25), q.to(r, {
            autoAlpha: 1,
            duration: .25
        }, .75), q.to(s, {
            autoAlpha: 1,
            duration: .01
        }, .25), q.to(s, {
            drawSVG: "100%",
            duration: .7
        }, .3);
        const k = gsap.timeline({
            scrollTrigger: {
                trigger: t,
                start: "40% top",
                end: "60% top",
                scrub: !0,
                onUpdate: S
            },
            defaults: {
                ease: "none"
            }
        });
        k.to(e, {
            attr: {
                viewBox: "0 0 330 300"
            },
            width: 330,
            height: 300
        }, 0), k.to(r, {
            autoAlpha: 0,
            duration: .12,
            ease: "none"
        }, 0), k.to(s, {
            y: 84.5,
            duration: .35,
            ease: "none"
        }, .05), k.to('[data-cap-always][data-name="left"]', {
            x: -.3,
            y: 68.36,
            duration: .35,
            ease: "none"
        }, .05), k.to('[data-cap-always][data-name="right"]', {
            x: -2.6,
            y: 68.36,
            duration: .35,
            ease: "none"
        }, .05), k.to('[data-cap-always][data-name="c-top"]', {
            x: -1.45,
            y: 68.93,
            duration: .35,
            ease: "none"
        }, .05), k.to('[data-cap-always][data-name="c-mid"]', {
            x: -1.45,
            y: 68.4,
            duration: .35,
            ease: "none"
        }, .05), k.to('[data-cap-always][data-name="c-bot"]', {
            x: -1.45,
            y: 67.78,
            duration: .35,
            ease: "none"
        }, .05), k.set("[data-roof-spread]", {
            autoAlpha: 1
        }, .4), k.set("[data-circles]", {
            autoAlpha: 0
        }, .4), k.set("[data-cap-always]", {
            stroke: "#F3F3F3"
        }, .4), k.set(s, {
            autoAlpha: 0
        }, .4), k.fromTo("[data-spread]", {
            attr: {
                rx: 17.11,
                ry: 9.24
            }
        }, {
            attr: {
                rx: 130,
                ry: 70
            },
            duration: .5,
            ease: "power2.out"
        }, .4), k.set('[data-morph="0"]', {
            fill: "#F3F3F3"
        }, .9), k.set("[data-roof-spread]", {
            autoAlpha: 0
        }, .9), k.set(o, {
            autoAlpha: 0
        }, .9), k.set(l, {
            autoAlpha: 1
        }, .5), k.to(i, {
            drawSVG: "100%",
            duration: .3,
            stagger: .01,
            ease: "none"
        }, .5), k.to(c, {
            scale: 1,
            duration: .2,
            stagger: .02,
            ease: "back.out(2)"
        }, .6);
        const V = gsap.timeline({
            scrollTrigger: {
                trigger: t,
                start: "60% top",
                end: "80% top",
                scrub: !0
            },
            defaults: {
                ease: "none"
            }
        });
        V.to(e, {
            attr: {
                viewBox: "0 -25 335 325"
            },
            width: 335,
            height: 325
        }, 0), V.to('[data-morph="0"]', {
            morphSVG: "M325.572 182.926L165.428 266.872L1.57129 182.926L165.429 97.5068L325.572 182.926Z"
        }, 0), V.to('[data-morph="1"]', {
            morphSVG: "M165.969 266.803V272.004L325.832 188.779V183.1L165.969 266.803Z"
        }, 0), V.to('[data-morph="2"]', {
            morphSVG: "M165.604 266.807V272.479L1.29102 189.24V183.089L165.604 266.807Z"
        }, 0), V.to('[data-morph="1"], [data-morph="2"]', {
            fill: "#161616",
            stroke: "#727272",
            duration: .4,
            ease: "none"
        }, .3), M && V.to(M, {
            morphSVG: "M325.572 182.926L165.428 266.872L1.57129 182.926L165.429 97.5068L325.572 182.926Z"
        }, 0), V.to(l, {
            y: 8
        }, 0), V.to(i, {
            drawSVG: "0%",
            duration: .3,
            stagger: .005,
            ease: "none"
        }, 0), V.to(c, {
            scale: 0,
            duration: .2,
            stagger: .008,
            ease: "back.in(2)"
        }, 0), V.set(l, {
            autoAlpha: 0
        }, .4), V.set(u, {
            autoAlpha: 1
        }, 0), V.to(d, {
            scale: 1,
            duration: .4,
            stagger: .012,
            ease: "back.out(1.5)"
        }, .1), V.set(p, {
            autoAlpha: 1
        }, .5), V.to(p, {
            scale: 1,
            duration: .35,
            ease: "back.out(1.7)"
        }, .5), V.set(h, {
            autoAlpha: 1
        }, .5), V.to(h, {
            scale: 1,
            duration: .35,
            ease: "back.out(1.7)"
        }, .5), V.to(g[0], {
            attr: {
                x2: 165.43,
                y2: 97.51
            },
            duration: .4,
            ease: "power2.out"
        }, .75), V.to(g[1], {
            attr: {
                x2: 325.57,
                y2: 182.93
            },
            duration: .4,
            ease: "power2.out"
        }, .83)
    };
(() => {
    const t = document.querySelectorAll("[data-db]");
    t.length && t.forEach((t => {
        const e = t.querySelector("[data-cube-blue]"),
            a = t.querySelector("[data-cube-black]"),
            o = t.querySelector("[data-cube-black-mask]"),
            r = t.querySelectorAll("[data-blue-line]");
        if (!e || !a || !r.length) return;
        e.setAttribute("transform", "translate(0 0)"), a.setAttribute("transform", "translate(0 0)"), o && o.setAttribute("transform", "translate(0 -187)");
        const s = Array.from(r).map((t => ({
                el: t,
                y1: parseFloat(t.getAttribute("y1")),
                y2: parseFloat(t.getAttribute("y2"))
            }))),
            n = {
                p: 0
            };
        gsap.to(n, {
            p: 1,
            ease: "power2.in",
            scrollTrigger: {
                trigger: t,
                start: "top bottom",
                end: "center 40%",
                scrub: !0
            },
            onUpdate: () => {
                const t = n.p,
                    r = 187 * t;
                e.setAttribute("transform", `translate(0 ${532*t})`), a.setAttribute("transform", `translate(0 ${r})`), o && o.setAttribute("transform", `translate(0 ${r-187})`), s.forEach((e => {
                    e.el.setAttribute("y1", e.y1 + (e.y2 - e.y1) * t)
                }))
            }
        })
    }))
})(), (() => {
    const t = document.querySelector(".home-cta");
    if (!t) return;
    const e = t.querySelector("svg");
    if (!e) return;
    const a = t.querySelectorAll("[data-line]");
    if (!a.length) return;
    if (window.matchMedia("(hover: none)").matches) return;
    const o = 140,
        r = .4,
        s = 8,
        n = 280,
        l = 110,
        i = 6,
        c = Array.from(t.querySelectorAll("[data-blur]")).map((t => ({
            el: t,
            bx: parseFloat(t.getAttribute("data-bx")),
            by: parseFloat(t.getAttribute("data-by")),
            tx: 0,
            ty: 0,
            lastTx: -9999,
            lastTy: -9999
        }))),
        u = t => {
            const e = [];
            let a = 0;
            for (; a < t.length;) {
                const o = t[a];
                if (/[a-zA-Z]/.test(o)) {
                    const r = o;
                    a++;
                    const s = [];
                    let n = a;
                    for (; a < t.length && !/[a-zA-Z]/.test(t[a]);) a++;
                    (t.substring(n, a).match(/-?\d+\.?\d*/g) || []).forEach((t => s.push(parseFloat(t)))), e.push({
                        cmd: r,
                        nums: s,
                        original: s.slice()
                    })
                } else a++
            }
            return e
        },
        d = t => t * t * (3 - 2 * t),
        p = Array.from(a).map((t => {
            const e = t.getAttribute("d"),
                a = u(e),
                o = a.map((t => t.cmd + t.nums.join(" "))).join(""),
                r = [];
            if (a.forEach((t => {
                    const e = t.cmd.toUpperCase();
                    "M" === e || "L" === e || "T" === e ? r.push(t.nums[0]) : "C" === e ? r.push(t.nums[0], t.nums[2], t.nums[4]) : "S" === e || "Q" === e ? r.push(t.nums[0], t.nums[2]) : "H" === e && r.push(t.nums[0])
                })), r.length < 4) return null;
            const s = [...r].sort(((t, e) => t - e)),
                n = (s[0] + s[s.length - 1]) / 2,
                l = s[Math.floor(.05 * s.length)],
                i = s[Math.floor(.95 * s.length)],
                c = t => t < l + 1.5 || t > i - 1.5,
                d = [];
            let p = 0,
                h = 0;
            a.forEach((t => {
                const e = t.cmd.toUpperCase();
                "M" === e || "L" === e || "T" === e ? (p = t.nums[0], h = t.nums[1], d.push({
                    x: p,
                    y: h
                })) : "C" === e ? (p = t.nums[4], h = t.nums[5], d.push({
                    x: p,
                    y: h
                })) : "V" === e ? (h = t.nums[0], d.push({
                    x: p,
                    y: h
                })) : "H" === e && (p = t.nums[0], d.push({
                    x: p,
                    y: h
                }))
            }));
            const g = [];
            let y = !1,
                m = 0;
            d.forEach((t => {
                c(t.x) && !y ? (y = !0, m = t.y) : !c(t.x) && y && (y = !1, g.push([Math.min(m, t.y), Math.max(m, t.y)]))
            }));
            const f = [],
                C = new Array(g.length).fill(!1);
            return g.forEach(((t, e) => {
                if (C[e]) return;
                let a = -1,
                    o = 1 / 0;
                if (g.forEach(((r, s) => {
                        if (e === s || C[s]) return;
                        const n = (t[0] + t[1]) / 2,
                            l = (r[0] + r[1]) / 2,
                            i = Math.abs(n - l);
                        i < o && i < 30 && (o = i, a = s)
                    })), a >= 0) {
                    C[e] = C[a] = !0;
                    const o = [Math.min(t[0], g[a][0]), Math.max(t[1], g[a][1])];
                    f.push({
                        y0: o[0],
                        y1: o[1],
                        cy: (o[0] + o[1]) / 2,
                        lockedAnchor: null,
                        currentCompress: 1
                    })
                } else C[e] = !0, f.push({
                    y0: t[0],
                    y1: t[1],
                    cy: (t[0] + t[1]) / 2,
                    lockedAnchor: null,
                    currentCompress: 1
                })
            })), {
                el: t,
                tokens: a,
                origD: o,
                cx: n,
                balloons: f,
                atRest: !0,
                lastWritten: o
            }
        })).filter(Boolean),
        h = (t, e, a, n, l) => {
            const {
                tokens: i,
                cx: c,
                balloons: u
            } = t, p = Math.abs(c - e) > o + 2, h = 1 - Math.exp(-s * l);
            let g = !0;
            for (let t = 0; t < u.length; t++) {
                const s = u[t];
                let l = 1;
                if (!p) {
                    const t = c - e,
                        i = a < s.y0 ? s.y0 - a : a > s.y1 ? a - s.y1 : 0,
                        u = Math.sqrt(t * t + i * i);
                    if (u < o) {
                        const t = 1 - u / o,
                            e = (1 - Math.pow(1 - t, 3)) * n;
                        l = 1 - (1 - r) * e
                    }
                }
                s.currentCompress += (l - s.currentCompress) * h, Math.abs(s.currentCompress - 1) > .001 && (g = !1), s.currentCompress >= .999 ? s.lockedAnchor = null : null === s.lockedAnchor && (s.lockedAnchor = a < s.cy ? s.y1 : s.y0)
            }
            if (g) return t.atRest ? null : (t.atRest = !0, t.origD);
            t.atRest = !1;
            const y = t => {
                for (let e = 0; e < u.length; e++) {
                    const o = u[e],
                        r = o.currentCompress;
                    if (r >= .999) continue;
                    const s = null !== o.lockedAnchor ? o.lockedAnchor : a < o.cy ? o.y1 : o.y0;
                    if (t >= o.y0 - 1 && t <= o.y1 + 1) return s + (t - s) * r;
                    const n = 30;
                    if (t >= o.y0 - n && t < o.y0) {
                        const e = (o.y0 - t) / n,
                            a = s + (t - s) * (1 - (1 - r) * d(1 - e));
                        return a < o.y0 ? a : o.y0
                    }
                    if (t > o.y1 && t <= o.y1 + n) {
                        const e = (t - o.y1) / n,
                            a = s + (t - s) * (1 - (1 - r) * d(1 - e));
                        return a > o.y1 ? a : o.y1
                    }
                }
                return t
            };
            let m = "";
            for (let t = 0; t < i.length; t++) {
                const e = i[t],
                    a = 223 & e.cmd.charCodeAt(0),
                    o = e.original,
                    r = e.nums;
                if (86 === a) r[0] = y(o[0]);
                else if (67 === a) r[0] = o[0], r[1] = y(o[1]), r[2] = o[2], r[3] = y(o[3]), r[4] = o[4], r[5] = y(o[5]);
                else if (76 === a || 77 === a || 84 === a) r[0] = o[0], r[1] = y(o[1]);
                else if (83 === a || 81 === a) r[0] = o[0], r[1] = y(o[1]), r[2] = o[2], r[3] = y(o[3]);
                else
                    for (let t = 0; t < o.length; t++) r[t] = o[t];
                m += e.cmd;
                for (let t = 0; t < r.length; t++) t > 0 && (m += " "), m += (0 | r[t]) === r[t] ? r[t] : r[t].toFixed(1)
            }
            return m
        },
        g = {
            mx: -9999,
            my: -9999,
            intensity: 0
        };
    let y = performance.now(),
        m = null,
        f = !0;
    const C = () => {
        f = !0
    };
    window.addEventListener("resize", C, {
        passive: !0
    }), window.addEventListener("scroll", C, {
        passive: !0
    });
    const w = 20;
    let b = 0;
    const A = () => {
            const t = performance.now(),
                a = Math.min((t - y) / 1e3, .05);
            if (y = t, b += 1e3 * a, b < w) return;
            b = 0, !f && m || (m = e.getBoundingClientRect(), f = !1);
            const o = 1440 / m.width,
                r = 810 / m.height,
                s = (g.mx - m.left) * o,
                u = (g.my - m.top) * r;
            for (let t = 0; t < p.length; t++) {
                const e = p[t],
                    o = h(e, s, u, g.intensity, a);
                null !== o && o !== e.lastWritten && (e.el.setAttribute("d", o), e.lastWritten = o)
            }
            const d = 1 - Math.exp(-i * a);
            for (let t = 0; t < c.length; t++) {
                const e = c[t],
                    a = e.bx - s,
                    o = e.by - u,
                    r = Math.sqrt(a * a + o * o);
                let i = 0,
                    p = 0;
                if (r < n && r > .01) {
                    const t = 1 - r / n,
                        e = (1 - Math.pow(1 - t, 2)) * g.intensity * l;
                    i = a / r * e, p = o / r * e
                }
                e.tx += (i - e.tx) * d, e.ty += (p - e.ty) * d, (Math.abs(e.tx - e.lastTx) > .3 || Math.abs(e.ty - e.lastTy) > .3) && (e.el.setAttribute("transform", "translate(" + e.tx.toFixed(1) + " " + e.ty.toFixed(1) + ")"), e.lastTx = e.tx, e.lastTy = e.ty)
            }
        },
        x = gsap.quickTo(g, "intensity", {
            duration: .4,
            ease: "power2.out"
        });
    let S = null;
    const L = () => {
            S || (y = performance.now(), b = 0, C(), S = gsap.ticker.add(A))
        },
        M = () => {
            g.intensity < .001 && S && (gsap.ticker.remove(A), S = null)
        };
    let q = 0,
        k = 0,
        V = !1;
    const E = () => {
            V && (g.mx = q, g.my = k, V = !1)
        },
        T = t => {
            q = t.clientX, k = t.clientY, V = !0, -9999 === g.mx && (g.mx = q, g.my = k, V = !1), x(1), L()
        };
    gsap.ticker.add(E);
    const Z = () => {
        x(0), gsap.delayedCall(2, M)
    };
    t.addEventListener("mousemove", T, {
        passive: !0
    }), t.addEventListener("mouseleave", Z, {
        passive: !0
    })
})(), (() => {
    const t = document.querySelector("[data-hero-canvas]") || document.getElementById("hero-canvas");
    if (!t) return;
    const e = t.getContext("2d"),
        a = 1440,
        o = 842,
        r = [
            [
                [828.4, 963.9],
                [783.4, 933.9],
                [738.5, 903.9],
                [693.5, 873.9],
                [648.5, 844],
                [603.6, 814],
                [561.5, 787.6],
                [521.1, 761.4],
                [484.7, 734],
                [450.5, 705.7],
                [419.7, 676.8],
                [391.2, 649.2],
                [367.8, 621.1],
                [343.5, 593.7],
                [323.4, 565.4],
                [306.8, 538.8],
                [293.4, 509.9],
                [282.5, 479.9],
                [272.5, 452.8],
                [264.6, 424.4],
                [262.1, 382.3],
                [264.6, 342.3],
                [270.2, 312.3],
                [278.6, 285.9],
                [290.2, 255.9],
                [304.6, 229.1],
                [321.4, 199.2],
                [341, 172.8],
                [363, 144.8],
                [389.8, 114.8],
                [417.4, 88],
                [447.7, 58],
                [481.1, 30.1],
                [517.5, 3.2],
                [510.8, -12.4],
                [450.1, -13.5],
                [387.3, -14.8],
                [324.5, -16.1],
                [261.7, -17.4],
                [198.9, -18.7],
                [136.2, -20]
            ],
            [
                [524.8, 948.5],
                [484.5, 922.3],
                [444.1, 896.1],
                [403.7, 869.9],
                [363.3, 843.7],
                [323, 817.5],
                [286.6, 790.1],
                [252.4, 761.8],
                [221.5, 732.9],
                [193, 705.3],
                [169.7, 677.2],
                [145.4, 649.8],
                [125.3, 621.5],
                [108.7, 594.9],
                [95.3, 569.9],
                [85.9, 544.2],
                [80.2, 529.9],
                [74.4, 505.7],
                [66.5, 480.5],
                [64, 438.4],
                [66.5, 398.4],
                [72.1, 368.4],
                [80.5, 342],
                [92.1, 312],
                [106.5, 285.3],
                [123.3, 255.3],
                [142.9, 228.9],
                [164.9, 200.9],
                [191.6, 170.9],
                [219.2, 144.1],
                [249.6, 114.1],
                [283, 86.2],
                [319.3, 59.3],
                [360, 32.1],
                [402.1, 2.1],
                [444.2, -27.9],
                [486.4, -57.9],
                [528.5, -87.8],
                [570.6, -117.8]
            ],
            [
                [980.2, 934.5],
                [933, 910.7],
                [885.8, 886.9],
                [838.6, 863.1],
                [791.4, 839.3],
                [744.2, 815.5],
                [699.2, 785.5],
                [657.2, 759.1],
                [616.8, 732.9],
                [580.4, 705.5],
                [546.2, 677.2],
                [515.4, 648.3],
                [486.9, 620.7],
                [463.5, 592.6],
                [439.2, 565.2],
                [419.1, 536.9],
                [402.5, 510.3],
                [389.1, 481.4],
                [378.2, 451.4],
                [368.2, 424.3],
                [360.3, 395.9],
                [357.8, 353.8],
                [360.3, 313.8],
                [365.9, 283.8],
                [374.3, 257.4],
                [385.9, 227.5],
                [400.3, 200.7],
                [417.1, 170.7],
                [436.7, 144.3],
                [458.7, 116.3],
                [485.5, 86.3],
                [513, 59.5],
                [543.4, 29.6],
                [576.8, 1.6],
                [610.2, -26.4],
                [643.6, -54.3],
                [677, -82.3],
                [710.5, -110.2]
            ],
            [
                [1136.7, 943.6],
                [1086.4, 916.7],
                [1036.2, 889.9],
                [985.9, 863],
                [935.6, 836.1],
                [885.3, 809.3],
                [838.1, 785.5],
                [793.2, 755.5],
                [751.1, 729.1],
                [710.7, 702.9],
                [674.3, 675.5],
                [640.1, 647.2],
                [609.3, 618.3],
                [580.8, 590.8],
                [557.4, 562.6],
                [533.1, 535.3],
                [513, 506.9],
                [496.4, 480.3],
                [483, 451.4],
                [472.1, 421.5],
                [462.1, 394.3],
                [454.2, 365.9],
                [451.7, 323.9],
                [454.2, 283.8],
                [459.8, 253.8],
                [468.2, 227.5],
                [479.8, 197.5],
                [494.2, 170.7],
                [511, 140.7],
                [530.6, 114.3],
                [552.6, 86.3],
                [579.4, 56.3],
                [607, 29.6],
                [637.3, -.4],
                [667.7, -30.4],
                [698.1, -60.4],
                [728.5, -90.4],
                [758.8, -120.4]
            ],
            [
                [674, 945],
                [631.9, 918.6],
                [589.8, 892.2],
                [547.7, 865.8],
                [505.6, 839.4],
                [463.5, 813],
                [423.2, 786.8],
                [386.8, 759.4],
                [352.5, 731.1],
                [321.7, 702.2],
                [293.2, 674.6],
                [269.9, 646.5],
                [245.6, 619.2],
                [225.5, 590.8],
                [208.8, 564.2],
                [195.4, 535.3],
                [184.5, 505.4],
                [174.6, 478.2],
                [166.7, 449.8],
                [164.2, 407.8],
                [166.7, 367.7],
                [172.3, 337.7],
                [180.7, 311.4],
                [192.3, 281.4],
                [206.7, 254.6],
                [223.5, 224.6],
                [243.1, 198.2],
                [265, 170.2],
                [291.8, 140.2],
                [319.4, 113.5],
                [349.8, 83.5],
                [383.2, 55.5],
                [419.5, 28.6],
                [460.2, 1.4],
                [500.9, -25.8],
                [541.5, -53.1],
                [582.2, -80.3],
                [622.9, -107.5]
            ],
            [
                [1599.5, 956.6],
                [1540.7, 926.6],
                [1482, 896.6],
                [1423.3, 866.6],
                [1364.6, 836.6],
                [1305.8, 806.6],
                [1249.8, 781.7],
                [1195.7, 751.7],
                [1145.4, 724.8],
                [1098.2, 701],
                [1053.3, 671.1],
                [1011.2, 644.6],
                [970.8, 618.4],
                [934.4, 591.1],
                [900.2, 562.8],
                [869.4, 533.9],
                [840.9, 506.3],
                [817.5, 478.2],
                [793.2, 450.8],
                [773.1, 422.5],
                [756.5, 395.9],
                [743.1, 367],
                [732.2, 337],
                [722.2, 309.9],
                [714.3, 281.5],
                [711.9, 239.4],
                [714.3, 199.4],
                [719.9, 169.4],
                [728.3, 143],
                [739.9, 113],
                [754.3, 86.2],
                [771.1, 56.3],
                [790.7, 29.9],
                [812.7, 1.9],
                [834.7, -26.1],
                [856.7, -54.1],
                [878.7, -82.1],
                [900.7, -110.1]
            ],
            [
                [1297, 956.1],
                [1242.9, 926.1],
                [1188.8, 896.1],
                [1134.7, 866.1],
                [1080.6, 836.1],
                [1026.5, 806.1],
                [976.2, 779.3],
                [929, 755.5],
                [884.1, 725.5],
                [842, 699.1],
                [801.6, 672.9],
                [765.2, 645.5],
                [731, 617.2],
                [700.2, 588.3],
                [671.7, 560.8],
                [648.3, 532.6],
                [624, 505.3],
                [603.9, 476.9],
                [587.3, 450.3],
                [573.9, 421.5],
                [563, 391.5],
                [553, 364.3],
                [545.1, 336],
                [542.6, 293.9],
                [545.1, 253.8],
                [550.7, 223.9],
                [559.1, 197.5],
                [570.7, 167.5],
                [585.1, 140.7],
                [601.9, 110.7],
                [621.5, 84.3],
                [643.5, 56.3],
                [670.3, 26.4],
                [697.9, -.4],
                [725.5, -27.2],
                [753, -54],
                [780.6, -80.8],
                [808.2, -107.6]
            ],
            [
                [1448.6, 935.4],
                [1392.6, 910.5],
                [1336.5, 885.5],
                [1280.5, 860.6],
                [1224.5, 835.7],
                [1168.5, 810.7],
                [1114.3, 780.7],
                [1064.1, 753.9],
                [1016.9, 730.1],
                [971.9, 700.1],
                [929.8, 673.7],
                [889.4, 647.5],
                [853.1, 620.1],
                [818.8, 591.8],
                [788, 562.9],
                [759.5, 535.3],
                [736.1, 507.2],
                [711.8, 479.8],
                [691.8, 451.5],
                [675.1, 424.9],
                [661.7, 396],
                [650.8, 366],
                [640.9, 338.9],
                [633, 310.5],
                [630.5, 268.4],
                [633, 228.4],
                [638.6, 198.4],
                [647, 172],
                [658.5, 142.1],
                [672.9, 115.3],
                [689.7, 85.3],
                [709.3, 58.9],
                [731.3, 30.9],
                [758.1, .9],
                [784.9, -29],
                [811.7, -59],
                [838.4, -89],
                [865.2, -119]
            ],
            [
                [1611.3, 877.4],
                [1555.3, 852.5],
                [1499.3, 827.5],
                [1443.3, 802.6],
                [1387.2, 777.6],
                [1331.2, 752.7],
                [1277.1, 722.7],
                [1226.8, 695.8],
                [1179.6, 672],
                [1134.7, 642],
                [1092.5, 615.6],
                [1052.2, 589.4],
                [1015.8, 562.1],
                [981.6, 533.7],
                [950.8, 504.8],
                [922.2, 477.3],
                [898.9, 449.2],
                [874.6, 421.8],
                [854.5, 393.5],
                [837.9, 366.9],
                [824.5, 338],
                [813.6, 308],
                [803.6, 280.8],
                [795.7, 252.5],
                [793.2, 210.4],
                [795.7, 170.4],
                [801.3, 140.4],
                [809.7, 114],
                [821.3, 84],
                [835.7, 57.2],
                [852.5, 27.2],
                [872.1, .9],
                [891.7, -25.5],
                [911.3, -51.9],
                [930.9, -78.3],
                [950.5, -104.7]
            ],
            [
                [1629, 843.6],
                [1574.9, 813.6],
                [1520.8, 783.6],
                [1466.7, 753.6],
                [1412.6, 723.7],
                [1358.5, 693.7],
                [1308.2, 666.8],
                [1261, 643],
                [1216, 613],
                [1173.9, 586.6],
                [1133.5, 560.4],
                [1097.2, 533.1],
                [1063, 504.7],
                [1032.1, 475.8],
                [1003.6, 448.3],
                [980.3, 420.2],
                [956, 392.8],
                [935.9, 364.5],
                [919.2, 337.9],
                [905.8, 309],
                [894.9, 279],
                [885, 251.8],
                [877.1, 223.5],
                [874.6, 181.4],
                [877.1, 141.4],
                [882.7, 111.4],
                [891.1, 85],
                [902.7, 55],
                [917.1, 28.2],
                [933.9, -1.8],
                [950.6, -31.7],
                [967.4, -61.7],
                [984.2, -91.7],
                [1001, -121.7]
            ],
            [
                [1634.2, 775.1],
                [1583.9, 748.2],
                [1533.6, 721.4],
                [1483.3, 694.5],
                [1433.1, 667.7],
                [1382.8, 640.8],
                [1335.6, 617],
                [1290.6, 587],
                [1248.5, 560.6],
                [1208.2, 534.4],
                [1171.8, 507],
                [1137.6, 478.7],
                [1106.8, 449.8],
                [1078.2, 422.3],
                [1054.9, 394.1],
                [1030.6, 366.8],
                [1010.5, 338.5],
                [993.9, 311.9],
                [980.5, 283],
                [969.6, 253],
                [959.6, 225.8],
                [951.7, 197.5],
                [949.2, 155.4],
                [951.7, 115.3],
                [957.3, 85.4],
                [965.7, 59],
                [977.3, 29],
                [991.7, 2.2],
                [1006.1, -24.6],
                [1020.5, -51.4],
                [1034.9, -78.2],
                [1049.3, -105]
            ],
            [
                [1588.3, 706.8],
                [1543.3, 676.8],
                [1498.4, 646.8],
                [1453.4, 616.8],
                [1408.4, 586.8],
                [1363.4, 556.8],
                [1321.3, 530.4],
                [1281, 504.2],
                [1244.6, 476.9],
                [1210.3, 448.5],
                [1179.5, 419.6],
                [1151, 392.1],
                [1127.7, 364],
                [1103.4, 336.6],
                [1083.3, 308.3],
                [1066.6, 281.7],
                [1053.2, 252.8],
                [1042.3, 222.8],
                [1032.4, 195.6],
                [1024.5, 167.3],
                [1022, 125.2],
                [1024.5, 85.2],
                [1030.1, 55.2],
                [1038.5, 28.8],
                [1050.1, -1.2],
                [1061.7, -31.2],
                [1073.3, -61.2],
                [1084.9, -91.1],
                [1096.5, -121.1]
            ],
            [
                [360.7, 954.6],
                [324.3, 927.2],
                [288, 899.9],
                [251.6, 872.5],
                [215.3, 845.1],
                [178.9, 817.8],
                [144.7, 789.5],
                [113.9, 760.6],
                [85.3, 733],
                [62, 704.9],
                [37.7, 677.5],
                [17.6, 649.2],
                [1, 622.6],
                [-20.5, 581],
                [-34.6, 537.1],
                [-41.5, 491.8],
                [-41.5, 445.8],
                [-34.7, 400.1],
                [-21.2, 355.6],
                [-1.2, 312.9],
                [15.6, 283],
                [35.2, 256.6],
                [57.2, 228.6],
                [84, 198.6],
                [111.5, 171.8],
                [141.9, 141.8],
                [175.3, 113.9],
                [211.6, 87],
                [252.3, 59.8],
                [294.4, 29.8],
                [339.1, 2.5],
                [383.8, -24.7],
                [428.5, -51.9],
                [473.1, -79.2],
                [517.8, -106.4]
            ],
            [
                [1600.8, 637.3],
                [1558.7, 610.9],
                [1516.6, 584.5],
                [1474.6, 558.1],
                [1432.5, 531.7],
                [1390.4, 505.3],
                [1350, 479.1],
                [1313.6, 451.7],
                [1279.4, 423.4],
                [1248.6, 394.5],
                [1220.1, 366.9],
                [1196.7, 338.8],
                [1172.4, 311.4],
                [1152.3, 283.1],
                [1135.7, 256.5],
                [1122.3, 227.6],
                [1111.4, 197.6],
                [1101.4, 170.5],
                [1093.5, 142.1],
                [1091, 100],
                [1093.5, 60],
                [1099.1, 30],
                [1107.5, 3.6],
                [1115.9, -22.7],
                [1124.3, -49.1],
                [1132.7, -75.5],
                [1141.1, -101.9]
            ],
            [
                [1564, 559.8],
                [1527.6, 532.4],
                [1491.3, 505.1],
                [1454.9, 477.7],
                [1418.6, 450.4],
                [1382.2, 423],
                [1348, 394.7],
                [1317.1, 365.8],
                [1288.6, 338.2],
                [1265.3, 310.1],
                [1241, 282.7],
                [1220.9, 254.4],
                [1204.2, 227.8],
                [1190.8, 198.9],
                [1180, 168.9],
                [1170, 141.8],
                [1162.1, 113.4],
                [1159.6, 71.3],
                [1162.1, 31.3],
                [1167.7, 1.3],
                [1173.3, -28.6],
                [1178.9, -58.6],
                [1184.5, -88.6],
                [1190.1, -118.6]
            ],
            [
                [1535.4, 481.5],
                [1504.6, 452.6],
                [1473.8, 423.8],
                [1443, 394.9],
                [1412.2, 366],
                [1381.3, 337.1],
                [1352.8, 309.5],
                [1329.5, 281.4],
                [1305.2, 254],
                [1285.1, 225.7],
                [1268.5, 199.1],
                [1255, 170.2],
                [1244.1, 140.2],
                [1234.2, 113.1],
                [1226.3, 84.7],
                [1223.8, 42.6],
                [1226.3, 2.6],
                [1228.8, -37.4],
                [1231.3, -77.5],
                [1233.8, -117.5],
                [1236.3, -157.5]
            ],
            [
                [212, 955],
                [177.8, 926.7],
                [143.5, 898.4],
                [109.2, 870],
                [75, 841.7],
                [40.7, 813.4],
                [9.9, 784.5],
                [-25.2, 745.5],
                [-53.9, 701.2],
                [-76.2, 652.6],
                [-92.1, 600.8],
                [-101.7, 546.7],
                [-104.9, 491.6],
                [-101.8, 436.3],
                [-92.4, 382.1],
                [-76.8, 329.8],
                [-54.9, 280.7],
                [-26.7, 235.6],
                [7.6, 195.8],
                [38, 165.8],
                [71.4, 137.8],
                [107.7, 110.9],
                [148.4, 83.7],
                [190.5, 53.7],
                [235.1, 26.5],
                [283.3, 9.2],
                [331.5, -8.1],
                [379.7, -25.4],
                [427.9, -42.7],
                [476.1, -60]
            ],
            [
                [1507.7, 392.9],
                [1484.4, 364.7],
                [1461, 336.6],
                [1437.7, 308.5],
                [1414.3, 280.3],
                [1391, 252.2],
                [1366.7, 224.9],
                [1346.6, 196.5],
                [1330, 169.9],
                [1316.6, 141],
                [1305.7, 111.1],
                [1295.7, 83.9],
                [1287.8, 55.5],
                [1285.3, 13.5],
                [1282.8, -28.6],
                [1280.3, -70.7],
                [1277.8, -112.8],
                [1275.4, -154.9]
            ],
            [
                [1504.5, 311.9],
                [1484.4, 283.6],
                [1464.3, 255.3],
                [1444.2, 226.9],
                [1424.1, 198.6],
                [1404, 170.3],
                [1387.4, 143.7],
                [1374, 114.8],
                [1363.1, 84.8],
                [1353.1, 57.6],
                [1345.2, 29.3],
                [1342.8, -12.8],
                [1340.3, -54.9],
                [1337.8, -97],
                [1335.3, -139],
                [1332.8, -181.1]
            ],
            [
                [-163.4, 249],
                [-122.8, 221.8],
                [-82.1, 194.6],
                [-41.4, 167.3],
                [-.8, 140.1],
                [39.9, 112.9],
                [82, 82.9],
                [126.7, 55.7],
                [174.9, 38.4],
                [223.1, 21],
                [271.3, 3.7],
                [319.5, -13.6],
                [367.7, -30.9]
            ],
            [
                [1474.3, 206],
                [1463.4, 176],
                [1452.5, 146],
                [1441.6, 116],
                [1430.7, 86],
                [1419.8, 56],
                [1409.9, 28.9],
                [1402, .5],
                [1394.1, -27.8],
                [1386.2, -56.2],
                [1378.3, -84.5],
                [1370.4, -112.8]
            ],
            [
                [-179, 150.3],
                [-130.8, 133],
                [-82.6, 115.7],
                [-34.4, 98.4],
                [13.8, 81.1],
                [61.9, 63.8],
                [110.1, 46.5],
                [158.3, 29.2],
                [206.5, 11.9],
                [254.7, -5.4]
            ]
        ],
        s = r.length,
        n = {
            omega: .7,
            bn: 6,
            bl: 1.2,
            fadeRatio: .2,
            shRatio: 30 / a,
            dashColor: "#6A7681",
            blueColor: "#1E6EF3"
        };
    window.__HERO_CFG__ = n;
    const l = [{
            w: 375,
            sw: 2.5
        }, {
            w: 1440,
            sw: 3.75
        }, {
            w: 2560,
            sw: 6.5
        }],
        i = t => {
            if (t <= l[0].w) return l[0].sw;
            if (t >= l[l.length - 1].w) return l[l.length - 1].sw;
            for (let e = 0; e < l.length - 1; e++) {
                const a = l[e],
                    o = l[e + 1];
                if (t >= a.w && t <= o.w) {
                    const e = (t - a.w) / (o.w - a.w);
                    return a.sw + (o.sw - a.sw) * e
                }
            }
            return l[1].sw
        };
    let c, u, d, p, h, g, y, m;
    const f = () => {
        d = window.devicePixelRatio || 1, c = t.clientWidth, u = t.clientHeight, t.width = c * d, t.height = u * d, e.setTransform(d, 0, 0, d, 0, 0), p = Math.max(c / a, u / o), h = p * a * n.shRatio, g = i(c), y = (c - a * p) / 2, m = (u - o * p) / 2
    };
    let C = 0,
        w = performance.now(),
        b = [],
        A = !1;
    const x = t => {
            let e = 0;
            for (; e < 30;) {
                const a = Math.random() * s | 0,
                    o = r[a].length,
                    l = Math.random() * o | 0;
                let i = !1;
                for (let t = 0; t < b.length; t++)
                    if (b[t].ci === a && b[t].slot === l) {
                        i = !0;
                        break
                    }
                if (!i) return b.push({
                    ci: a,
                    slot: l,
                    birth: t,
                    life: n.bl * (.7 + .6 * Math.random())
                }), !0;
                e++
            }
            return !1
        },
        S = t => {
            const a = t / 1e3,
                o = Math.min((t - w) / 1e3, .05);
            w = t, C += n.omega * o, e.fillStyle = "#000", e.fillRect(0, 0, c, u), e.lineWidth = g, e.lineCap = "butt";
            const l = h / 2,
                i = -l - 4,
                d = c + l + 4,
                f = -l - 4,
                L = u + l + 4;
            if (!A) {
                for (let t = 0; t < n.bn; t++) x(a);
                A = !0
            }
            const M = [];
            for (let t = 0; t < b.length; t++) a - b[t].birth < b[t].life && M.push(b[t]);
            for (b = M; b.length < n.bn && x(a););
            const q = new Set;
            for (let t = 0; t < b.length; t++) q.add(1e3 * b[t].ci + b[t].slot);
            e.strokeStyle = n.dashColor, e.beginPath();
            for (let t = 0; t < s; t++) {
                const a = r[t],
                    o = a.length;
                if (!(o < 2))
                    for (let r = 0; r < o; r++) {
                        let s = (C + r) % o;
                        s < 0 && (s += o);
                        const n = 0 | s;
                        if (n === o - 1) continue;
                        const c = s - n,
                            u = a[n],
                            h = a[n + 1],
                            g = u[0] + (h[0] - u[0]) * c,
                            w = u[1] + (h[1] - u[1]) * c,
                            b = g * p + y,
                            A = w * p + m;
                        b < i || b > d || A < f || A > L || q.has(1e3 * t + r) || (e.moveTo(b, A - l), e.lineTo(b, A + l))
                    }
            }
            e.stroke(), e.strokeStyle = n.blueColor, e.beginPath();
            for (let t = 0; t < b.length; t++) {
                const a = b[t],
                    o = r[a.ci],
                    s = o.length;
                if (s < 2) continue;
                let n = (C + a.slot) % s;
                n < 0 && (n += s);
                const c = 0 | n;
                if (c === s - 1) continue;
                const u = n - c,
                    h = o[c],
                    g = o[c + 1],
                    w = h[0] + (g[0] - h[0]) * u,
                    A = h[1] + (g[1] - h[1]) * u,
                    x = w * p + y,
                    S = A * p + m;
                x < i || x > d || S < f || S > L || (e.moveTo(x, S - l), e.lineTo(x, S + l))
            }
            e.stroke();
            const k = u * n.fadeRatio;
            if (k > 0) {
                const t = e.createLinearGradient(0, 0, 0, k);
                t.addColorStop(0, "rgba(0,0,0,1)"), t.addColorStop(1, "rgba(0,0,0,0)"), e.fillStyle = t, e.fillRect(0, 0, c, k);
                const a = e.createLinearGradient(0, u - k, 0, u);
                a.addColorStop(0, "rgba(0,0,0,0)"), a.addColorStop(1, "rgba(0,0,0,1)"), e.fillStyle = a, e.fillRect(0, u - k, c, k)
            }
            requestAnimationFrame(S)
        },
        L = () => window.innerWidth <= 767;
    let M, q = window.innerWidth;
    window.addEventListener("resize", (() => {
        L() && window.innerWidth === q || (q = window.innerWidth, clearTimeout(M), M = setTimeout(f, 150))
    })), f(), requestAnimationFrame(S)
})(), (function() {
    let initialized = false;
    function safeInit() {
        if (!initialized && typeof init === 'function') {
            initialized = true;
            try { init(); } catch (err) { console.warn('TamperSafe diagram init:', err); }
        }
    }
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(safeInit).catch(safeInit);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', safeInit);
    } else {
        safeInit();
    }
    setTimeout(safeInit, 300);
})();