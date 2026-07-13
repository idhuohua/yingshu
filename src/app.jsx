// Root app — state, time loop, layout, Tweaks
const { useState, useEffect, useRef, useMemo, useCallback } = React;

function DragHandle({ playerPct, onChange }) {
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const onDown = (e) => {
    e.preventDefault();
    setDragging(true);
    draggingRef.current = true;
    const body = document.querySelector(".app-body");
    const onMove = (ev) => {
      if (!draggingRef.current) return;
      const r = body.getBoundingClientRect();
      const pct = ((ev.clientX - r.left) / r.width) * 100;
      const clamped = Math.max(30, Math.min(75, pct));
      onChange(Math.round(clamped * 10) / 10);
    };
    const onUp = () => {
      draggingRef.current = false;
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  return (
    <div className={"drag-handle " + (dragging ? "dragging" : "")}
         style={{ left: playerPct + "%" }}
         onPointerDown={onDown}
         title="拖动调整左右宽度">
      <div className="drag-handle-grip">
        <span /><span /><span />
      </div>
    </div>
  );
}

const TWEAK_DEFAULS = /*EDITMODE-BEGIN*/{
  "theme": "minimal-dark",
  "fontSize": 17,
  "autoFollow": true,
  "showAnnotations": true,
  "playerPct": 60
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULS);
  const SHOW = window.SHOW;

  // Time（演示时间，0..duration；接入真实视频时由 <video> 元素驱动）
  const [currentTime, setCurrentTime] = useState(0);
  // 浏览器拦截带声自动播放；默认暂停，由用户首次点击触发
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const lastTickRef = useRef(performance.now());

  // Auto-follow
  const [autoFollowActive, setAutoFollowActive] = useState(true);

  // Bookmarks / annotations
  const [bookmarks, setBookmarks] = useState(new Set(SHOW.initialHighlights));
  const [openAnnId, setOpenAnnId] = useState("p6");

  // 时间推进：若接入了真实视频，时间源交给 <video> 元素（在 Player 内通过
  // onTimeUpdate 上报），此处不再跑 rAF；否则继续用 rAF 模拟。
  const hasRealVideo = !!SHOW.videoSrc;
  useEffect(() => {
    if (hasRealVideo) return;
    let raf;
    const tick = (now) => {
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      if (isPlaying) {
        setCurrentTime((cur) => {
          let nx = cur + dt * speed;
          if (nx >= SHOW.duration) { nx = 0; }   // loop demo
          return nx;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    lastTickRef.current = performance.now();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, speed, hasRealVideo]);

  // Theme + layout
  useEffect(() => {
    document.body.dataset.theme = t.theme;
    const root = document.documentElement;
    const p = Math.max(30, Math.min(75, t.playerPct || 60));
    root.style.setProperty("--w-player", p + "%");
    root.style.setProperty("--w-reader", (100 - p) + "%");
  }, [t.theme, t.playerPct]);

  // 字幕：优先用全量 ASR utterances（连续字幕轨），找不到再回落到 paragraph dialogues。
  // anchored=true 表示当前这条 ASR 文本能与 paragraph 中某条 dialogue 对上 →
  // 在 player 端用更醒目的颜色高亮，提示「已联动到原著」。
  const subtitleInfo = useMemo(() => {
    const utt = (SHOW.utterances || []).find(u => currentTime >= u.start && currentTime <= u.end);
    if (utt) {
      // 判断这条 ASR 是否落在某个有 dialogue 的 paragraph 时段内
      let anchored = false;
      for (const p of SHOW.paragraphs) {
        if (!p.dialogues) continue;
        for (const d of p.dialogues) {
          if (currentTime >= d.start - 0.4 && currentTime <= d.end + 0.4) {
            anchored = true;
            break;
          }
        }
        if (anchored) break;
      }
      return { text: utt.text, anchored };
    }
    return { text: null, anchored: false };
  }, [currentTime]);
  const currentDialogue = subtitleInfo.text;
  const currentDialogueAnchored = subtitleInfo.anchored;

  const onPlayPause = () => {
    setIsPlaying(p => !p);
  };
  const onSeek = (sec) => {
    setCurrentTime(Math.max(0, Math.min(SHOW.duration, sec)));
    setAutoFollowActive(true); // jumping always re-snaps
  };
  const onSeekTo = (sec) => {
    setCurrentTime(sec);
    setAutoFollowActive(true);
  };

  const toggleBookmark = (pid) => {
    setBookmarks(prev => {
      const nx = new Set(prev);
      if (nx.has(pid)) nx.delete(pid); else nx.add(pid);
      return nx;
    });
  };
  const toggleAnn = (pid) => setOpenAnnId(cur => cur === pid ? null : pid);
  const snapBack = () => setAutoFollowActive(true);
  const onUserScroll = () => setAutoFollowActive(false);

  // 影视库
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [activeShowTitle, setActiveShowTitle] = useState(null);

  return (
    <div className="app">
      <Header tweaks={t} setTweak={setTweak}
              onAutoFollowChange={(v) => setAutoFollowActive(v)}
              onOpenLibrary={() => setLibraryOpen(true)} />
      <div className="app-body">
        <Player
          currentTime={currentTime}
          duration={SHOW.duration}
          isPlaying={isPlaying}
          speed={speed}
          onPlayPause={onPlayPause}
          onSeek={onSeek}
          onSpeed={setSpeed}
          onTimeUpdate={setCurrentTime}
          currentDialogue={currentDialogue}
          currentDialogueAnchored={currentDialogueAnchored}
          tweaks={t}
          chapters={SHOW.chapters}
          episodes={SHOW.episodes}
          danmu={SHOW.danmu}
        />
        <Reader
          currentTime={currentTime}
          isPlaying={isPlaying}
          paragraphs={SHOW.paragraphs}
          chapters={SHOW.chapters}
          autoFollowActive={autoFollowActive}
          onSnapBack={snapBack}
          onSeekTo={onSeekTo}
          bookmarks={bookmarks}
          onToggleBookmark={toggleBookmark}
          openAnnId={openAnnId}
          onToggleAnn={toggleAnn}
          fontSize={t.fontSize}
          onFontSizeChange={(v) => setTweak("fontSize", v)}
          showAnnotations={t.showAnnotations}
          onUserScroll={onUserScroll}
        />
        <DragHandle
          playerPct={t.playerPct || 60}
          onChange={(v) => setTweak("playerPct", v)} />
      </div>
      <Library
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSwitchShow={(f) => setActiveShowTitle(f.title)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
