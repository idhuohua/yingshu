// Right side novel reader
const { useRef: useRRef, useState: useRState, useEffect: useREffect, useMemo: useRMemo, useCallback: useRCb } = React;

// Split paragraph text into "lines" using Chinese punctuation as boundary so we can
// highlight a specific sentence within a paragraph when its dialogue plays.
// Boundaries kept on the preceding line.
function splitSentences(text) {
  const out = [];
  let cur = "";
  for (const ch of text) {
    cur += ch;
    if ("。！？；…」".indexOf(ch) >= 0) {
      out.push(cur);
      cur = "";
    }
  }
  if (cur) out.push(cur);
  return out;
}

function Reader({
  currentTime, isPlaying,
  paragraphs, chapters,
  autoFollowActive, onSnapBack,
  onSeekTo,
  bookmarks, onToggleBookmark,
  openAnnId, onToggleAnn,
  fontSize, showAnnotations,
  onFontSizeChange,
  onUserScroll,
}) {
  const scrollRef = useRRef(null);
  const paraRefs = useRRef({});
  const programmaticScrollUntil = useRRef(0);

  // Reader-local dark mode (independent from player theme)
  const [readerDark, setReaderDark] = useRState(false);

  // Font size popover
  const [fontPopOpen, setFontPopOpen] = useRState(false);
  const fontBtnRef = useRRef(null);
  useREffect(() => {
    if (!fontPopOpen) return;
    const onDoc = (e) => {
      if (fontBtnRef.current && !fontBtnRef.current.contains(e.target)) setFontPopOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [fontPopOpen]);

  // Is the current paragraph element visible in the scroll viewport?
  const [currentInView, setCurrentInView] = useRState(true);

  // Current paragraph
  const currentPara = useRMemo(() => {
    return paragraphs.find(p => currentTime >= p.start && currentTime < p.end);
  }, [currentTime, paragraphs]);

  // Recompute "current in view" whenever scroll or current paragraph changes
  const checkInView = useRCb(() => {
    const sc = scrollRef.current;
    const el = currentPara && paraRefs.current[currentPara.id];
    if (!sc || !el) { setCurrentInView(true); return; }
    const scR = sc.getBoundingClientRect();
    const elR = el.getBoundingClientRect();
    // count as "in view" if any of the paragraph overlaps the scroll viewport
    // with a small inset so a paragraph hugging the top edge still feels in-frame.
    const visible = elR.bottom > scR.top + 24 && elR.top < scR.bottom - 24;
    setCurrentInView(visible);
  }, [currentPara?.id]);

  useREffect(() => { checkInView(); }, [checkInView, currentTime]);

  // Auto-follow scroll
  useREffect(() => {
    if (!autoFollowActive || !currentPara) return;
    const el = paraRefs.current[currentPara.id];
    const sc = scrollRef.current;
    if (!el || !sc) return;
    const scRect = sc.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const target = sc.scrollTop + (elRect.top - scRect.top) - (sc.clientHeight * 0.35);
    programmaticScrollUntil.current = performance.now() + 700;
    sc.scrollTo({ top: target, behavior: "smooth" });
  }, [currentPara?.id, autoFollowActive]);

  // Detect manual scroll
  const onScroll = (e) => {
    checkInView();
    if (performance.now() < programmaticScrollUntil.current) return;
    if (autoFollowActive) onUserScroll();
  };

  // Group paragraphs by chapter
  const byChapter = useRMemo(() => {
    const groups = [];
    let prevCh = null;
    for (const p of paragraphs) {
      if (p.chapter !== prevCh) {
        groups.push({ chapter: p.chapter, items: [] });
        prevCh = p.chapter;
      }
      groups[groups.length-1].items.push(p);
    }
    return groups;
  }, [paragraphs]);

  // Find ch label
  const chLabel = (id) => (chapters.find(c => c.id === id)?.label) || "";

  return (
    <section className={"reader " + (readerDark ? "reader-dark" : "")}
             style={{ "--fs-body": fontSize + "px" }}>
      {!currentInView && currentPara && (
        <div className="snap-back" onClick={onSnapBack}>
          <span className="dot" />
          视频已播至此处
          <span style={{ opacity:.55, fontFamily:"var(--ff-mono)", fontSize: 10 }}>
            {fmtT(currentTime)}
          </span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      )}
      <div className="reader-hd">
        <div>
          <div className="meta">
            <span>原 著</span><span className="sep">·</span>
            <span>《{(window.SHOW && window.SHOW.title) || "原著"}》</span><span className="sep">·</span>
            <span>第一卷</span>
          </div>
          <div className="ttl">{(window.SHOW && window.SHOW.chapterLabel) || "原著阅读"}</div>
        </div>
        <div className="actions">
          <div className="font-wrap" ref={fontBtnRef}>
            <button className={"rd-iconbtn " + (fontPopOpen ? "on" : "")}
                    title="字号"
                    onClick={() => setFontPopOpen(o => !o)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19l5-14 5 14M6 14h6" /><path d="M16 19l3-8 3 8M17.5 16h3" />
              </svg>
            </button>
            {fontPopOpen && (
              <div className="font-pop" onClick={(e) => e.stopPropagation()}>
                <div className="font-pop-hd">
                  <span>正文字号</span>
                  <span className="font-pop-val">{fontSize}px</span>
                </div>
                <div className="font-pop-row">
                  <button className="font-step"
                          onClick={() => onFontSizeChange(Math.max(14, fontSize - 1))}
                          title="减小">
                    <span style={{ fontSize: 12, fontFamily:"var(--ff-serif)" }}>A</span>
                  </button>
                  <input type="range" min="14" max="24" step="1"
                         value={fontSize}
                         onChange={(e) => onFontSizeChange(parseInt(e.target.value, 10))} />
                  <button className="font-step"
                          onClick={() => onFontSizeChange(Math.min(24, fontSize + 1))}
                          title="增大">
                    <span style={{ fontSize: 18, fontFamily:"var(--ff-serif)" }}>A</span>
                  </button>
                </div>
                <div className="font-pop-presets">
                  {[15, 17, 19, 22].map(v => (
                    <button key={v}
                            className={"font-preset " + (fontSize === v ? "on" : "")}
                            onClick={() => onFontSizeChange(v)}>
                      {v}
                    </button>
                  ))}
                </div>
                <div className="font-preview" style={{ fontSize }}>
                  云想衣裳花想容，春风拂槛露华浓。
                </div>
              </div>
            )}
          </div>
          <button className={"rd-iconbtn " + (autoFollowActive ? "on" : "")}
                  title="自动跟随" onClick={onSnapBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M3 12c2-4 5-7 9-7s7 3 9 7c-2 4-5 7-9 7s-7-3-9-7Z" />
            </svg>
          </button>
          <button className={"rd-iconbtn " + (readerDark ? "on" : "")}
                  title={readerDark ? "切换为白天阅读" : "切换为夜间阅读"}
                  onClick={() => setReaderDark(d => !d)}>
            {readerDark ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="reader-scroll" ref={scrollRef} onScroll={onScroll}>

        {byChapter.map((g, gi) => (
          <React.Fragment key={g.chapter}>
            <div className="chap-sep">
              <span>· {chLabel(g.chapter)} ·</span>
            </div>
            {g.items.map(p => {
              const isCurrent = currentPara?.id === p.id;
              const isPassed = currentTime >= p.end;
              const isBookmarked = bookmarks.has(p.id);
              // 没有 note 字段的段落不可能弹出 AI 旁注，避免下文 p.note.kind 访空
              const annOpen = openAnnId === p.id && showAnnotations && !!p.note;
              const sentences = splitSentences(p.text);

              // Determine which sentence index is active (matches a dialogue currently playing)
              let activeIdx = -1;
              if (isCurrent && p.dialogues) {
                for (const d of p.dialogues) {
                  if (currentTime >= d.start && currentTime <= d.end) {
                    activeIdx = sentences.findIndex(s => s.includes(d.line.slice(0, 6)) || s.includes(d.line));
                    if (activeIdx === -1) {
                      // fallback: simple includes by first chars
                      activeIdx = sentences.findIndex(s => s.includes(d.line.slice(1, 5)));
                    }
                    break;
                  }
                }
              }

              return (
                <div key={p.id}
                     ref={el => { paraRefs.current[p.id] = el; }}
                     className={"para " + (isCurrent ? "current " : "") + (isPassed ? "passed " : "")}
                     onClick={() => onSeekTo(p.start + 0.2)}>

                  <div className="para-meta">
                    {p.bookOnly && (
                      <span className="badge-bookonly" title="书中有，剧版未呈现">
                        <span className="dot" />书有剧无
                      </span>
                    )}
                    {p.note && showAnnotations && (
                      <span className="ann-trigger"
                            onClick={(e) => { e.stopPropagation(); onToggleAnn(p.id); }}>
                        <span className="ai">AI</span>
                        {p.note.kind}
                      </span>
                    )}
                  </div>

                  {sentences.map((s, i) => (
                    <span key={i} className={"line " + (i === activeIdx ? "active" : "")}>{s}</span>
                  ))}

                  {annOpen && (
                    <div className="annotation" onClick={(e) => e.stopPropagation()}>
                      <div className="ann-hd">
                        <span className="kind">{p.note.kind}</span>
                        <span>{p.note.title}</span>
                        <span className="ai-tag">AI 旁注</span>
                      </div>
                      <div className="body">{p.note.body}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}

        <div style={{
          textAlign:"center", marginTop: 48,
          color:"var(--c-ink-mute)", fontFamily:"var(--ff-serif)",
          fontSize: 13, letterSpacing:".24em",
        }}>
          — 第01章 终 · 下一章 归来何定 —
        </div>
      </div>
    </section>
  );
}

function fmtT(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2,"0")}`;
}

window.Reader = Reader;
