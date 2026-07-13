// Header bar — full-width dark
function Header({ tweaks, setTweak, onAutoFollowChange, onOpenLibrary }) {
  const SHOW = window.SHOW;
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const themes = [
    { v: "minimal-dark", label: "极简" },
    { v: "cinema",       label: "电影" },
    { v: "warm-paper",   label: "暖纸" },
  ];
  const layouts = [];

  return (
    <header className="hdr">
      <div className="hdr-brand">
        <img className="logo" src="assets/yingshu.png" alt="影书" />
        <div>影书 · <span style={{ opacity:.55, letterSpacing:".2em", fontFamily:"var(--ff-mono)", fontSize: 10 }}>YINGSHU</span></div>
      </div>

      <div className="hdr-crumb">
        <span className="ep">E{String(SHOW.episodes.findIndex(ep => ep.current) + 1 || 1).padStart(2,"0")} · {SHOW.totalEpisodes}</span>
        <span>《{SHOW.title}》</span>
        <span className="sep">›</span>
        <span className="ch">{SHOW.chapterLabel}</span>
      </div>

      <div className="hdr-spacer" />

      <button className="hdr-iconbtn hdr-library-btn"
              title="影视库"
              onClick={() => onOpenLibrary && onOpenLibrary()}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
        </svg>
        <span className="hdr-library-lbl">影视库</span>
        <span className="hdr-library-count">5</span>
      </button>

      <div className="hdr-settings-wrap" ref={wrapRef}>
        <button className={"hdr-iconbtn " + (open ? "on" : "")}
                title="设置"
                onClick={() => setOpen(o => !o)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
          </svg>
        </button>

        {open && (
          <div className="hdr-settings-pop" onClick={(e) => e.stopPropagation()}>
            <div className="set-row">
              <span className="set-lbl">主题</span>
              <div className="set-seg">
                {themes.map(t => (
                  <button key={t.v}
                          className={tweaks.theme === t.v ? "on" : ""}
                          onClick={() => setTweak("theme", t.v)}>{t.label}</button>
                ))}
              </div>
            </div>

            <div className="set-sep" />

            <div className="set-row inline">
              <div>
                <div className="set-lbl">原著自动跟随</div>
                <div className="set-hint">视频播放时，原文自动滚至当前段</div>
              </div>
              <button className={"set-toggle " + (tweaks.autoFollow ? "on" : "")}
                      onClick={() => {
                        const nx = !tweaks.autoFollow;
                        setTweak("autoFollow", nx);
                        onAutoFollowChange && onAutoFollowChange(nx);
                      }}>
                <i />
              </button>
            </div>

            <div className="set-row inline">
              <div>
                <div className="set-lbl">AI 旁注</div>
                <div className="set-hint">人物、典故、服饰、改编差异等</div>
              </div>
              <button className={"set-toggle " + (tweaks.showAnnotations ? "on" : "")}
                      onClick={() => setTweak("showAnnotations", !tweaks.showAnnotations)}>
                <i />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

window.Header = Header;
