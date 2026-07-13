// Left side player
const { useRef: usePRef, useState: usePState, useEffect: usePEffect, useMemo: usePMemo } = React;

function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2,"0")}`;
}

function Player({
  currentTime, duration, isPlaying, speed,
  onPlayPause, onSeek, onSpeed, onTimeUpdate,
  currentDialogue, currentDialogueAnchored, tweaks,
  chapters, episodes, danmu,
}) {
  const SHOW = window.SHOW;
  const trackRef = usePRef(null);
  const stageRef = usePRef(null);
  const playerRef = usePRef(null);

  // 真实视频接入：当 SHOW.videoSrc 存在时，stage 内渲染 <video>，并把它作为
  // 时间源（通过 onTimeUpdate 上报）。videoStartOffset 用于跳过片头：演示时间
  // 0s 对应真实视频的 videoStartOffset 秒。
  const videoRef = usePRef(null);
  const hasRealVideo = !!SHOW.videoSrc;
  const videoOffset = SHOW.videoStartOffset || 0;

  // 同步播放/暂停状态到 <video>
  usePEffect(() => {
    if (!hasRealVideo) return;
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) v.play().catch(() => {});
    else v.pause();
  }, [isPlaying, hasRealVideo]);

  // 同步倍速
  usePEffect(() => {
    if (!hasRealVideo) return;
    const v = videoRef.current;
    if (v) v.playbackRate = speed;
  }, [speed, hasRealVideo]);

  // 当外部 currentTime 与 video 当前时间差距过大时强制 seek（章节跳转 / 进度条点击）
  usePEffect(() => {
    if (!hasRealVideo) return;
    const v = videoRef.current;
    if (!v) return;
    const want = currentTime + videoOffset;
    if (Math.abs(v.currentTime - want) > 0.4) {
      v.currentTime = want;
    }
  }, [currentTime, hasRealVideo, videoOffset]);

  // <video> 时间推进 → 上报为演示时间（减去 offset）；超过 demo duration 自动回环
  const handleVideoTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !onTimeUpdate) return;
    const demoT = v.currentTime - videoOffset;
    if (demoT >= duration) {
      v.currentTime = videoOffset;
      onTimeUpdate(0);
    } else if (demoT < 0) {
      v.currentTime = videoOffset;
      onTimeUpdate(0);
    } else {
      onTimeUpdate(demoT);
    }
  };

  // Overlay chrome (top-left title / top-right link-status) auto-hides 3s
  // after playback starts; reappears on pause or mouse activity over the stage.
  const [chromeVisible, setChromeVisible] = usePState(true);
  const hideTimerRef = usePRef(null);
  usePEffect(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlaying) {
      setChromeVisible(true);
      hideTimerRef.current = setTimeout(() => setChromeVisible(false), 3000);
    } else {
      setChromeVisible(true);
    }
    return () => hideTimerRef.current && clearTimeout(hideTimerRef.current);
  }, [isPlaying]);
  const wakeChrome = () => {
    setChromeVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => setChromeVisible(false), 3000);
    }
  };

  // ── Subtitle settings (local to player) ────────────────────────────────
  const [subtitleEnabled, setSubtitleEnabled] = usePState(true);
  const [subtitleFontSize, setSubtitleFontSize] = usePState(22);
  const [subtitleColor, setSubtitleColor] = usePState("#fff8e8");
  const [subMenuOpen, setSubMenuOpen] = usePState(false);
  const subBtnRef = usePRef(null);
  usePEffect(() => {
    if (!subMenuOpen) return;
    const onDoc = (e) => {
      if (subBtnRef.current && !subBtnRef.current.contains(e.target)) setSubMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [subMenuOpen]);
  const subtitleColorOptions = [
    { v: "#fff8e8", label: "暖白" },
    { v: "#ffffff", label: "纯白" },
    { v: "#ffd66b", label: "暖金" },
    { v: "#9ae6c8", label: "翠青" },
  ];

  // Fullscreen — applies to the stage frame so the video area goes full screen
  // and the original two-column layout returns when exited.
  const [isFullscreen, setIsFullscreen] = usePState(false);
  usePEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleSeekClick = (e) => {
    const r = trackRef.current.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    onSeek(pct * duration);
  };

  return (
    <section className="player" ref={playerRef}>
      <div className="stage" ref={stageRef} onMouseMove={wakeChrome}>
        <div className="stage-frame">
          {hasRealVideo ? (
            // 真实视频；onLoadedMetadata 时 seek 到片头偏移（跳过开场）；
            // onError 把媒体错误打到 console 方便排查（Range 不支持 / 解码失败 / 路径错）。
            <video
              ref={videoRef}
              src={SHOW.videoSrc}
              preload="auto"
              playsInline
              controls={false}
              onTimeUpdate={handleVideoTimeUpdate}
              onLoadedMetadata={(e) => {
                console.log("[video] loaded, duration=", e.currentTarget.duration, "→ seek to", videoOffset);
                e.currentTarget.currentTime = videoOffset;
              }}
              onError={(e) => {
                const err = e.currentTarget.error;
                console.error("[video] error", err && { code: err.code, message: err.message }, "src=", e.currentTarget.currentSrc);
              }}
              onStalled={() => console.warn("[video] stalled")}
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "contain",
                background: "#000",
              }}
            />
          ) : (
            <div className="stage-placeholder">
              <div className="ttl">{SHOW.title || "影书"}</div>
              <div>VIDEO · PLACEHOLDER · 1920×1080</div>
              <div style={{ marginTop: 8, opacity: .55 }}>{SHOW.episodeLabel} · {SHOW.chapterLabel}</div>
            </div>
          )}

          <div className="stage-vignette" />

          {/* 字幕：anchored=true 时用 gold 高亮表示已联动到原著 */}
          {subtitleEnabled && currentDialogue && (
            <div className={"subtitle " + (currentDialogueAnchored ? "subtitle-anchored" : "")}
                 style={{
                   fontSize: subtitleFontSize,
                   color: currentDialogueAnchored ? "var(--c-gold, #ffd66b)" : subtitleColor,
                   textShadow: currentDialogueAnchored
                     ? "0 0 12px rgba(255, 214, 107, .35), 0 1px 4px rgba(0,0,0,.85)"
                     : undefined,
                 }}>
              {currentDialogue}
            </div>
          )}

          {/* 左上角：剧 logo / 集数 */}
          <div style={{
            position:"absolute", top: 14, left: 18,
            display:"flex", alignItems:"center", gap: 10,
            color:"#fff", textShadow:"0 1px 4px rgba(0,0,0,.7)",
            fontFamily:"var(--ff-serif)", fontSize: 13, letterSpacing:".18em",
            opacity: chromeVisible ? 1 : 0,
            transform: `translateY(${chromeVisible ? 0 : -4}px)`,
            transition: "opacity .35s ease, transform .35s ease",
            pointerEvents: chromeVisible ? "auto" : "none",
          }}>
            <span style={{ opacity:.85 }}>《{SHOW.title}》</span>
            <span style={{ opacity:.55 }}>·</span>
            <span style={{ fontFamily:"var(--ff-mono)", fontSize:11, letterSpacing:".1em", opacity:.7 }}>{SHOW.episodeLabel}</span>
          </div>

          {/* 右上角 · 联动指示 */}
          <div style={{
            position:"absolute", top: 14, right: 18,
            display:"flex", alignItems:"center", gap: 8,
            color:"#fff", fontSize: 11, letterSpacing:".06em",
            background: "rgba(0,0,0,.4)", backdropFilter:"blur(6px)",
            padding:"6px 10px", borderRadius: 999,
            border:"1px solid rgba(255,255,255,.12)",
            opacity: chromeVisible ? 1 : 0,
            transform: `translateY(${chromeVisible ? 0 : -4}px)`,
            transition: "opacity .35s ease, transform .35s ease",
            pointerEvents: chromeVisible ? "auto" : "none",
          }}>
            <span style={{
              width:6, height:6, borderRadius:"50%",
              background:"var(--c-gold)",
              boxShadow:"0 0 0 3px oklch(0.74 0.12 65 / .35)",
            }} />
            <span style={{ opacity:.9 }}>原著联动中 · 同步至</span>
            <span style={{ fontFamily:"var(--ff-mono)" }}>{fmtTime(currentTime)}</span>
          </div>
        </div>
      </div>

      {/* 控制条 */}
      <div className="controls">
        <div className="scrubber" ref={trackRef} onClick={handleSeekClick}>
          <div className="scrubber-track">
            <div className="scrubber-buffer" style={{ width: Math.min(100, (currentTime/duration)*100 + 12) + "%" }} />
            <div className="scrubber-fill"   style={{ width: (currentTime/duration)*100 + "%" }} />
            <div className="scrubber-dot"    style={{ left: (currentTime/duration)*100 + "%" }} />
            {chapters.map((c, i) => {
              const left = (c.t/duration)*100;
              if (i === 0) return null;
              const chapNo = String(i + 1).padStart(2, "0");
              return (
                <div key={c.id} className="chap-anchor" style={{ left: left + "%" }}
                     onClick={(e) => { e.stopPropagation(); onSeek(c.t); }}>
                  <div className={"chap-mark " + (currentTime >= c.t ? "passed" : "")} />
                  <div className="chap-tip">
                    <div className="chap-tip-thumb">
                      <span className="chap-tip-thumb-label">CH {chapNo}</span>
                    </div>
                    <div className="chap-tip-meta">
                      <div className="chap-tip-title">{c.label}</div>
                      <div className="chap-tip-time">{fmtTime(c.t)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="controls-row">
          <button className="ctl-btn play" onClick={onPlayPause}>
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 5v14l12-7z" />
              </svg>
            )}
          </button>
          <button className="ctl-btn" title="后退 10 秒" onClick={() => onSeek(currentTime - 10)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M11 7L7 11l4 4" /><path d="M7 11h7a5 5 0 1 1 0 10h-2" />
            </svg>
          </button>
          <button className="ctl-btn" title="前进 10 秒" onClick={() => onSeek(currentTime + 10)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M13 7l4 4-4 4" /><path d="M17 11h-7a5 5 0 1 0 0 10h2" />
            </svg>
          </button>

          <span className="ctl-time"><b>{fmtTime(currentTime)}</b> <span style={{opacity:.5}}>/</span> {fmtTime(duration)}</span>

          <div className="ctl-spacer" />

          <span className="ctl-pill"><span className="dot"/>原著已就绪</span>
          <span className="ctl-pill" onClick={() => onSpeed(speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : 1)}>
            {speed}x
          </span>

          {/* 字幕设置 */}
          <div className="sub-wrap" ref={subBtnRef}>
            <button className={"ctl-btn " + (subMenuOpen ? "open" : "")}
                    title="字幕"
                    onClick={() => setSubMenuOpen(o => !o)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M7 14h3M13 14h4M7 10h2M11 10h6" />
              </svg>
              {!subtitleEnabled && <span className="sub-off-dot" />}
            </button>
            {subMenuOpen && (
              <div className="sub-pop" onClick={(e) => e.stopPropagation()}>
                <div className="sub-pop-hd">
                  <span>字幕</span>
                  <button className={"sub-toggle " + (subtitleEnabled ? "on" : "")}
                          onClick={() => setSubtitleEnabled(v => !v)}>
                    <i />
                  </button>
                </div>
                <div className={"sub-pop-body " + (subtitleEnabled ? "" : "dim")}>
                  <div className="sub-row">
                    <span className="sub-lbl">字号</span>
                    <input type="range" min="14" max="36" step="1"
                           value={subtitleFontSize}
                           onChange={(e) => setSubtitleFontSize(parseInt(e.target.value, 10))} />
                    <span className="sub-val">{subtitleFontSize}px</span>
                  </div>
                  <div className="sub-row">
                    <span className="sub-lbl">颜色</span>
                    <div className="sub-swatches">
                      {subtitleColorOptions.map(o => (
                        <button key={o.v}
                                className={"sub-sw " + (subtitleColor === o.v ? "on" : "")}
                                title={o.label}
                                style={{ background: o.v }}
                                onClick={() => setSubtitleColor(o.v)} />
                      ))}
                    </div>
                  </div>
                  <div className="sub-preview"
                       style={{ fontSize: subtitleFontSize, color: subtitleColor }}>
                    {currentDialogue || "字幕预览：一片冰心在玉壶。"}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button className="ctl-btn" title={isFullscreen ? "退出全屏" : "全屏"}
                  onClick={toggleFullscreen}>
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 剧集 + 章节条 */}
      <div className="episodes">
        <div className="episodes-hd">
          <div><b>剧集 · {SHOW.totalEpisodes} 集</b> <span style={{ opacity:.6, marginLeft: 10, letterSpacing:".04em", textTransform:"none" }}>已看 {episodes.filter(ep => ep.watched).length} 集</span></div>
          <span style={{ fontSize: 11, opacity:.6 }}>查看全部 →</span>
        </div>
        <div className="episodes-rail">
          {episodes.map(ep => (
            <div key={ep.n}
                 className={"ep-card " +
                            (ep.current ? "current " : "") +
                            (ep.watched ? "watched " : "")}>
              <div className="n">EP {String(ep.n).padStart(2,"0")}</div>
              {ep.current && <div className="badge">观看中</div>}
              <div className="t">{ep.title}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

window.Player = Player;
