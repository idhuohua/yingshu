// 影视库 · Library modal
// - 折叠面板：左侧文件夹列表 + 右侧详情/新建
// - 新建影视：命名 → 上传剧集 → 上传原著 → 自动解析（模拟）
// - 完全原创设计，与 影书 视觉系统一致
const { useState, useEffect, useRef, useMemo } = React;

// 演示影视库：仅保留甄嬛传第一集
const INITIAL_FOLDERS = [
  {
    id: "f1",
    title: "后宫·甄嬛传",
    author: "原著 / 流潋紫",
    cover: "linear-gradient(135deg, oklch(0.35 0.10 30) 0%, oklch(0.18 0.06 18) 100%)",
    initial: "甄",
    episodes: 1, totalEpisodes: 76,
    chapters: 6,
    status: "current",
    progress: 100,
    addedAt: "今日",
  },
];

function StatusPill({ status, progress }) {
  if (status === "current")
    return <span className="lib-pill on"><i className="d" />当前观看</span>;
  if (status === "ready")
    return <span className="lib-pill"><i className="d ok" />已解析</span>;
  if (status === "parsing")
    return <span className="lib-pill parse"><i className="d sp" />解析中 · {progress}%</span>;
  if (status === "draft")
    return <span className="lib-pill draft"><i className="d" />待上传</span>;
  return null;
}

function FolderCard({ f, selected, onClick }) {
  return (
    <button className={"lib-card " + (selected ? "on " : "") + (f.status === "current" ? "is-current" : "")}
            onClick={onClick}>
      <div className="lib-card-cov" style={{ background: f.cover }}>
        <span>{f.initial}</span>
      </div>
      <div className="lib-card-meta">
        <div className="lib-card-ttl">{f.title}</div>
        <div className="lib-card-sub">{f.author}</div>
        <div className="lib-card-stat">
          <StatusPill status={f.status} progress={f.progress} />
          <span className="lib-card-num">
            {f.episodes}/{f.totalEpisodes} 集 · {f.chapters} 章
          </span>
        </div>
      </div>
    </button>
  );
}

// ── 详情面板：选中已有影视
function DetailPane({ f, onSwitch }) {
  return (
    <div className="lib-detail">
      <div className="lib-banner" style={{ background: f.cover }}>
        <div className="lib-banner-grain" />
        <div className="lib-banner-meta">
          <div className="lib-banner-tag">影视档案 · {f.addedAt}加入</div>
          <div className="lib-banner-ttl">{f.title}</div>
          <div className="lib-banner-sub">{f.author}</div>
        </div>
      </div>

      <div className="lib-stats">
        <div className="lib-stat">
          <div className="n">{f.episodes}<small>/{f.totalEpisodes}</small></div>
          <div className="k">剧集已上传</div>
        </div>
        <div className="lib-stat">
          <div className="n">{f.chapters}</div>
          <div className="k">原著章节</div>
        </div>
        <div className="lib-stat">
          <div className="n">{f.status === "ready" || f.status === "current" ? "完成" : f.progress + "%"}</div>
          <div className="k">章节 · 时间映射</div>
        </div>
        <div className="lib-stat">
          <div className="n">{f.status === "ready" || f.status === "current" ? "已建立" : "待建立"}</div>
          <div className="k">角色 · 改编索引</div>
        </div>
      </div>

      <div className="lib-section">
        <div className="lib-section-hd">
          <span>剧集</span>
          <span className="lib-section-meta">{f.episodes} / {f.totalEpisodes}</span>
        </div>
        <div className="lib-ep-grid">
          {Array.from({ length: f.totalEpisodes }).map((_, i) => {
            const done = i < f.episodes;
            const isCur = f.status === "current" && i === 0;
            return (
              <div key={i} className={"lib-ep " + (done ? "done " : "") + (isCur ? "cur" : "")}>
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                {isCur && <span className="cur-dot" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="lib-actions">
        {f.status === "current" ? (
          <button className="lib-btn ghost" disabled>正在观看</button>
        ) : f.status === "ready" ? (
          <button className="lib-btn primary" onClick={onSwitch}>
            切换到这部影视
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        ) : f.status === "parsing" ? (
          <button className="lib-btn ghost" disabled>解析中 · 预计 {Math.ceil((100 - f.progress) / 8)} 分钟</button>
        ) : (
          <button className="lib-btn ghost" disabled>请先上传剧集与原著</button>
        )}
        <button className="lib-btn quiet">查看映射表</button>
        <button className="lib-btn quiet">导出笔记</button>
      </div>
    </div>
  );
}

// ── 新建面板
function NewPane({ onCreate, onCancel }) {
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [eps, setEps] = useState([]);    // [{name, size}]
  const [book, setBook] = useState(null); // {name, size, kind}
  const [parsing, setParsing] = useState(false);
  const [done, setDone] = useState(false);
  const [parseOpts, setParseOpts] = useState({
    split: true, map: true, chars: true, diff: true,
  });

  // 解析进度（4 个任务依次推进）
  const [progress, setProgress] = useState({ split: 0, map: 0, chars: 0, diff: 0 });
  useEffect(() => {
    if (!parsing) return;
    const queue = ["split", "map", "chars", "diff"].filter(k => parseOpts[k]);
    let i = 0;
    const tick = () => {
      if (i >= queue.length) {
        setDone(true);
        setParsing(false);
        return;
      }
      const k = queue[i];
      setProgress(p => {
        const nx = { ...p, [k]: Math.min(100, p[k] + 8 + Math.random() * 14) };
        if (nx[k] >= 100) { nx[k] = 100; i += 1; }
        return nx;
      });
    };
    const id = setInterval(tick, 120);
    return () => clearInterval(id);
  }, [parsing, parseOpts]);

  const epInputRef = useRef(null);
  const bookInputRef = useRef(null);

  const addEpFiles = (files) => {
    const list = Array.from(files).map(f => ({
      name: f.name,
      size: f.size,
      mb: (f.size / 1024 / 1024).toFixed(1),
    }));
    setEps(prev => [...prev, ...list]);
  };
  const setBookFile = (file) => {
    setBook({
      name: file.name,
      mb: (file.size / 1024 / 1024).toFixed(2),
      kind: (file.name.split(".").pop() || "").toLowerCase(),
    });
  };

  const canParse = name.trim() && eps.length > 0 && book && !parsing && !done;

  const startParse = () => {
    setParsing(true);
    setProgress({ split: 0, map: 0, chars: 0, diff: 0 });
  };

  const handleCreate = () => {
    if (!done) return;
    onCreate({
      id: "n" + Math.random().toString(36).slice(2, 7),
      title: name,
      author: author || "未填写来源",
      cover: "linear-gradient(135deg, oklch(0.38 0.10 80) 0%, oklch(0.20 0.06 60) 100%)",
      initial: name.slice(0, 1),
      episodes: eps.length,
      totalEpisodes: eps.length,
      chapters: Math.max(1, Math.round(eps.length * 2.4)),
      status: "ready",
      progress: 100,
      addedAt: "刚刚",
    });
  };

  return (
    <div className="lib-new">
      <div className="lib-new-hd">
        <div>
          <div className="lib-new-eyebrow">新建影视</div>
          <div className="lib-new-ttl">为一部新作品建立档案</div>
        </div>
        <button className="lib-x" onClick={onCancel} title="取消">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 6l12 12M18 6l-12 12" />
          </svg>
        </button>
      </div>

      {/* Step 1 · 命名 */}
      <div className="lib-step">
        <div className="lib-step-n">01</div>
        <div className="lib-step-body">
          <div className="lib-step-ttl">命名</div>
          <div className="lib-step-row">
            <label>
              <span>影视名称<i className="req">*</i></span>
              <input value={name} onChange={e => setName(e.target.value)}
                     placeholder="例：后宫·甄嬛传" />
            </label>
            <label>
              <span>原著 / 出品方</span>
              <input value={author} onChange={e => setAuthor(e.target.value)}
                     placeholder="例：原著 / 沈砚秋" />
            </label>
          </div>
        </div>
      </div>

      {/* Step 2 · 剧集 */}
      <div className="lib-step">
        <div className="lib-step-n">02</div>
        <div className="lib-step-body">
          <div className="lib-step-ttl">上传剧集
            <span className="lib-step-meta">支持 .mp4 / .mkv / .mov · 多选</span>
          </div>
          <div className="lib-drop"
               onClick={() => epInputRef.current?.click()}
               onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("on"); }}
               onDragLeave={(e) => e.currentTarget.classList.remove("on")}
               onDrop={(e) => {
                 e.preventDefault();
                 e.currentTarget.classList.remove("on");
                 addEpFiles(e.dataTransfer.files);
               }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />
            </svg>
            <div className="lib-drop-ttl">拖入剧集文件，或点击选择</div>
            <div className="lib-drop-sub">视频文件名建议形如 <code>S01E03.title.mp4</code>，系统将据此自动排序</div>
            <input ref={epInputRef} type="file" accept="video/*" multiple hidden
                   onChange={e => { addEpFiles(e.target.files); e.target.value = ""; }} />
          </div>
          {eps.length > 0 && (
            <div className="lib-files">
              {eps.map((f, i) => (
                <div key={i} className="lib-file">
                  <span className="lib-file-n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="lib-file-name">{f.name}</span>
                  <span className="lib-file-size">{f.mb} MB</span>
                  <button className="lib-file-x"
                          onClick={() => setEps(prev => prev.filter((_, j) => j !== i))}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M6 6l12 12M18 6l-12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Step 3 · 原著 */}
      <div className="lib-step">
        <div className="lib-step-n">03</div>
        <div className="lib-step-body">
          <div className="lib-step-ttl">上传原著
            <span className="lib-step-meta">.txt / .epub / .docx · 单文件</span>
          </div>
          <div className={"lib-drop slim " + (book ? "has" : "")}
               onClick={() => !book && bookInputRef.current?.click()}
               onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("on"); }}
               onDragLeave={(e) => e.currentTarget.classList.remove("on")}
               onDrop={(e) => {
                 e.preventDefault();
                 e.currentTarget.classList.remove("on");
                 if (e.dataTransfer.files[0]) setBookFile(e.dataTransfer.files[0]);
               }}>
            {book ? (
              <>
                <div className="lib-book-icn">{(book.kind || "txt").toUpperCase()}</div>
                <div className="lib-book-meta">
                  <div className="lib-book-ttl">{book.name}</div>
                  <div className="lib-book-sub">{book.mb} MB · 已就绪</div>
                </div>
                <button className="lib-file-x" onClick={(e) => { e.stopPropagation(); setBook(null); }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
                  <path d="M14 4v6h6" />
                </svg>
                <div className="lib-drop-ttl small">拖入小说文件，或点击选择</div>
                <div className="lib-drop-sub">章节会按「第 X 章 / 卷」自动切分</div>
              </>
            )}
            <input ref={bookInputRef} type="file" accept=".txt,.epub,.docx,.md" hidden
                   onChange={e => { if (e.target.files[0]) setBookFile(e.target.files[0]); e.target.value = ""; }} />
          </div>
        </div>
      </div>

      {/* Step 4 · 自动解析 */}
      <div className="lib-step">
        <div className="lib-step-n">04</div>
        <div className="lib-step-body">
          <div className="lib-step-ttl">自动解析
            <span className="lib-step-meta">由 AI 在本地完成，约 2–5 分钟</span>
          </div>

          <div className="lib-opts">
            {[
              { k: "split",  t: "自动切分剧集",      d: "按文件名识别集数与片头片尾时长" },
              { k: "map",    t: "章节 · 时间映射",   d: "比对台词与原文，定位每段对应的章节" },
              { k: "chars",  t: "角色识别",          d: "从原著抽取角色表，并匹配剧中人物" },
              { k: "diff",   t: "改编差异比对",      d: "标注「书里有剧里没」/ 删改 / 时间错置" },
            ].map(o => (
              <label key={o.k} className={"lib-opt " + (parseOpts[o.k] ? "on" : "")}>
                <input type="checkbox" checked={parseOpts[o.k]}
                       disabled={parsing || done}
                       onChange={e => setParseOpts(p => ({ ...p, [o.k]: e.target.checked }))} />
                <span className="lib-opt-box">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </span>
                <span className="lib-opt-meta">
                  <span className="lib-opt-t">{o.t}</span>
                  <span className="lib-opt-d">{o.d}</span>
                </span>
                {(parsing || done) && parseOpts[o.k] && (
                  <span className="lib-opt-prog">
                    <span className="bar" style={{ width: Math.round(progress[o.k]) + "%" }} />
                    <span className="pct">{Math.round(progress[o.k])}%</span>
                  </span>
                )}
              </label>
            ))}
          </div>

          <div className="lib-new-foot">
            {done ? (
              <>
                <div className="lib-done">
                  <span className="dot" />
                  解析完成 · 共识别 {eps.length} 集 · {Math.max(1, Math.round(eps.length * 2.4))} 章 · 角色 {6 + eps.length} 人
                </div>
                <button className="lib-btn primary" onClick={handleCreate}>
                  加入影视库
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </>
            ) : parsing ? (
              <>
                <div className="lib-done parsing">
                  <span className="dot sp" />
                  正在解析 …
                </div>
                <button className="lib-btn ghost" disabled>请稍候</button>
              </>
            ) : (
              <>
                <div className={"lib-hint " + (canParse ? "" : "muted")}>
                  {canParse
                    ? "已就绪，可以开始自动解析"
                    : "请先填写名称、上传至少一集与一份原著"}
                </div>
                <button className="lib-btn primary"
                        disabled={!canParse}
                        onClick={startParse}>
                  开始解析
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Library({ open, onClose, onSwitchShow }) {
  const [folders, setFolders] = useState(INITIAL_FOLDERS);
  const [selectedId, setSelectedId] = useState("f1");
  const [mode, setMode] = useState("detail");    // "detail" | "new"
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 「解析中」的卡片演示进度推进
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      setFolders(prev => prev.map(f =>
        f.status === "parsing"
          ? { ...f, progress: Math.min(100, f.progress + 1) }
          : f
      ));
    }, 600);
    return () => clearInterval(id);
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return folders;
    const q = query.trim().toLowerCase();
    return folders.filter(f =>
      f.title.toLowerCase().includes(q) || f.author.toLowerCase().includes(q));
  }, [folders, query]);

  const selected = folders.find(f => f.id === selectedId);

  if (!open) return null;

  return (
    <div className="lib-overlay" onClick={onClose}>
      <div className="lib-modal" onClick={(e) => e.stopPropagation()}>
        {/* Top bar */}
        <div className="lib-top">
          <div className="lib-top-l">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
            </svg>
            <div>
              <div className="lib-top-ttl">影视库</div>
              <div className="lib-top-sub">{folders.length} 部作品 · 已映射 {folders.filter(f => f.status === "ready" || f.status === "current").length} · 解析中 {folders.filter(f => f.status === "parsing").length}</div>
            </div>
          </div>
          <div className="lib-top-r">
            <div className="lib-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input value={query} onChange={e => setQuery(e.target.value)}
                     placeholder="搜索作品 / 原著 / 作者" />
            </div>
            <button className="lib-x" onClick={onClose} title="关闭 (Esc)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 6l12 12M18 6l-12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="lib-body">
          {/* Sidebar */}
          <aside className="lib-side">
            <button className={"lib-new-btn " + (mode === "new" ? "on" : "")}
                    onClick={() => setMode("new")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              新建影视
              <span className="lib-new-hint">上传剧集 + 原著 · 自动解析</span>
            </button>

            <div className="lib-side-hd">作品 <span>{filtered.length}</span></div>
            <div className="lib-side-list">
              {filtered.map(f => (
                <FolderCard key={f.id}
                  f={f}
                  selected={mode === "detail" && selectedId === f.id}
                  onClick={() => { setMode("detail"); setSelectedId(f.id); }} />
              ))}
            </div>
          </aside>

          {/* Right */}
          <section className="lib-main">
            {mode === "detail" && selected
              ? <DetailPane f={selected}
                  onSwitch={() => { onSwitchShow && onSwitchShow(selected); onClose(); }} />
              : <NewPane
                  onCancel={() => { setMode("detail"); }}
                  onCreate={(nf) => {
                    setFolders(prev => [nf, ...prev]);
                    setSelectedId(nf.id);
                    setMode("detail");
                  }} />}
          </section>
        </div>
      </div>
    </div>
  );
}

window.Library = Library;
