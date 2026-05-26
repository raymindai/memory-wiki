"use client";

import React from "react";

// ═══════════════════════════════════════════════════════════════
// Mermaid Visual Editors — Unified Design System
// ═══════════════════════════════════════════════════════════════

// ─── Theme Colors ───
const COLORS = ["#fb923c", "#60a5fa", "#4ade80", "#c4b5fd", "#f472b6", "#fbbf24", "#f87171", "#38bdf8", "#a3e635", "#e879f9"];

// ─── Diagram Type Registry ───
export const DIAGRAM_TYPES = [
  { id: "flowchart", label: "Flowchart", icon: "FL", template: "graph LR\n    A[Start] --> B[Process]\n    B --> C[End]" },
  { id: "sequence", label: "Sequence", icon: "SQ", template: "sequenceDiagram\n    participant A\n    participant B\n    A->>B: Request\n    B-->>A: Response" },
  { id: "pie", label: "Pie Chart", icon: "PI", template: 'pie title Distribution\n    "Category A" : 40\n    "Category B" : 35\n    "Category C" : 25' },
  { id: "gantt", label: "Gantt", icon: "GT", template: "gantt\n    title Project\n    dateFormat YYYY-MM-DD\n    section Phase 1\n    Task A :2026-01-01, 5d\n    Task B :2026-01-06, 3d" },
  { id: "er", label: "ER Diagram", icon: "ER", template: "erDiagram\n    User {\n        int id\n        string name\n    }\n    Post {\n        int id\n        string title\n    }\n    User ||--o{ Post : writes" },
  { id: "class", label: "Class", icon: "CL", template: "classDiagram\n    class Animal {\n        +name: string\n        +move()\n    }\n    class Dog {\n        +bark()\n    }\n    Animal <|-- Dog" },
  { id: "state", label: "State", icon: "ST", template: "stateDiagram-v2\n    [*] --> Idle\n    Idle --> Processing : start\n    Processing --> Done : complete\n    Done --> [*]" },
  { id: "mindmap", label: "Mindmap", icon: "MM", template: "mindmap\n  root\n    Topic A\n      Sub A1\n      Sub A2\n    Topic B\n      Sub B1" },
  { id: "timeline", label: "Timeline", icon: "TL", template: "timeline\n    title History\n    2020 : Event A\n    2022 : Event B\n    2024 : Event C" },
  { id: "journey", label: "Journey", icon: "JN", template: "journey\n    title User Journey\n    section Onboarding\n      Sign up: 5: User\n      Tutorial: 3: User\n    section Usage\n      Create doc: 4: User" },
  { id: "quadrant", label: "Quadrant", icon: "QD", template: 'quadrantChart\n    title Priority Matrix\n    x-axis "Low Effort" --> "High Effort"\n    y-axis "Low Impact" --> "High Impact"\n    Item A: [0.2, 0.8]\n    Item B: [0.7, 0.6]' },
  { id: "xy", label: "XY Chart", icon: "XY", beta: true, template: 'xychart-beta\n    title "Sales"\n    x-axis ["Jan", "Feb", "Mar", "Apr"]\n    y-axis "Count" 0 --> 30\n    bar [10, 20, 15, 25]' },
  { id: "git", label: "Git Graph", icon: "GI", template: 'gitGraph\n    commit id: "Initial"\n    branch feature\n    commit id: "Feature work"\n    checkout main\n    commit id: "Hotfix"\n    merge feature' },
] as const;

export type DiagramTypeId = typeof DIAGRAM_TYPES[number]["id"];

export function detectDiagramType(code: string): DiagramTypeId {
  if (code.startsWith("sequenceDiagram")) return "sequence";
  if (code.startsWith("pie")) return "pie";
  if (code.startsWith("gantt")) return "gantt";
  if (code.startsWith("erDiagram")) return "er";
  if (code.startsWith("classDiagram")) return "class";
  if (code.startsWith("stateDiagram")) return "state";
  if (code.startsWith("mindmap")) return "mindmap";
  if (code.startsWith("timeline")) return "timeline";
  if (code.startsWith("journey")) return "journey";
  if (code.startsWith("quadrantChart")) return "quadrant";
  if (code.startsWith("xychart")) return "xy";
  if (code.startsWith("gitGraph")) return "git";
  if (code.startsWith("graph") || code.startsWith("flowchart")) return "flowchart";
  return "flowchart";
}

// ─── Shared UI Components ───

const S = {
  input: "px-3 py-2 text-sm rounded-lg outline-none transition-colors",
  inputCSS: { background: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" } as React.CSSProperties,
  card: { background: "var(--background)", border: "1px solid var(--border)", borderRadius: 10 } as React.CSSProperties,
  accentBtn: { background: "var(--border)", color: "var(--text-primary)", border: "1px dashed var(--text-primary)" } as React.CSSProperties,
  delBtn: { color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "none", borderRadius: 6 } as React.CSSProperties,
};

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-caption font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "var(--text-faint)" }}>
        {title}
        {count !== undefined && (
          <span className="px-1.5 py-0.5 rounded-md text-caption font-mono" style={{ background: "var(--surface)", color: "var(--text-muted)" }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function AddBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="text-xs px-4 py-2.5 rounded-lg w-full font-medium" style={S.accentBtn}>{children}</button>;
}

function Del({ onClick }: { onClick: () => void }) {
  return <button onMouseDown={onClick} className="px-2 py-1.5 rounded text-xs font-bold shrink-0" style={S.delBtn}>×</button>;
}

function Card({ children, index, style }: { children: React.ReactNode; index?: number; style?: React.CSSProperties }) {
  return (
    <div className="p-3 flex gap-2.5 items-center" style={{ ...S.card, ...style }}>
      {index !== undefined && (
        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-caption font-bold"
          style={{ background: COLORS[index % COLORS.length] + "22", color: COLORS[index % COLORS.length] }}>
          {index + 1}
        </span>
      )}
      {children}
    </div>
  );
}

function Input({ value, onChange, className, placeholder, style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input value={value} onChange={onChange} className={`${S.input} ${className || ""}`}
      style={{ ...S.inputCSS, ...style }} placeholder={placeholder} {...props} />
  );
}

// ─── Type Selector ───
export function DiagramTypeSelector({ onSelect }: { onSelect: (template: string) => void }) {
  return (
    <div className="p-5 overflow-auto">
      <Section title="Create New Diagram">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DIAGRAM_TYPES.map((dt) => (
            <button key={dt.id} onClick={() => onSelect(dt.template)}
              className="flex items-center gap-2 p-3 rounded-lg text-left transition-colors"
              style={{ ...S.card }}
            >
              <span className="text-lg">{dt.icon}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{dt.label}</span>
                {(dt as { beta?: boolean }).beta && (
                  <span className="text-caption px-1 py-0.5 rounded font-mono" style={{ color: "var(--text-faint)", background: "var(--surface)" }}>beta</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Individual Diagram Editors
// ═══════════════════════════════════════════════════════════════

interface EditorProps {
  code: string;
  onChange: (code: string) => void;
}

// ─── Pie ───
function PieEditor({ code, onChange }: EditorProps) {
  const title = code.match(/pie\s+title\s+(.+)/)?.[1] || "";
  const items = [...code.matchAll(/"([^"]+)"\s*:\s*([\d.]+)/g)].map(m => ({ label: m[1], value: parseFloat(m[2]) }));
  if (items.length === 0) items.push({ label: "Item", value: 50 });
  const total = items.reduce((s, i) => s + i.value, 0) || 1;

  const rebuild = (t: string, itms: typeof items) => {
    let c = `pie title ${t}\n`;
    itms.forEach(i => { c += `    "${i.label}" : ${i.value}\n`; });
    onChange(c.trim());
  };

  return (
    <>
      <Section title="Title">
        <Input value={title} onChange={(e) => rebuild((e.target as HTMLInputElement).value, items)}
          className="w-full font-semibold text-base" placeholder="Chart title" />
      </Section>
      <Section title="Distribution">
        <div className="flex rounded-xl overflow-hidden h-7 mb-3" style={{ border: "1px solid var(--border)" }}>
          {items.map((item, i) => (
            <div key={i} className="relative group" style={{ width: `${(item.value / total) * 100}%`, background: COLORS[i % COLORS.length], minWidth: 4, transition: "width 0.2s" }}>
              <span className="absolute inset-0 flex items-center justify-center text-caption font-bold text-black opacity-0 group-hover:opacity-100 transition-opacity">
                {Math.round((item.value / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Slices" count={items.length}>
        <div className="space-y-2">
          {items.map((item, i) => (
            <Card key={i} index={i}>
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <input value={item.label} onChange={(e) => { items[i] = { ...items[i], label: e.target.value }; rebuild(title, [...items]); }}
                className="flex-1 bg-transparent outline-none text-sm" style={{ color: "var(--text-primary)" }} placeholder="Label" />
              <input type="range" min="1" max="100" value={item.value} onChange={(e) => { items[i] = { ...items[i], value: parseInt(e.target.value) }; rebuild(title, [...items]); }}
                className="w-20" style={{ accentColor: COLORS[i % COLORS.length] }} />
              <input type="number" value={item.value} onChange={(e) => { items[i] = { ...items[i], value: parseInt(e.target.value) || 0 }; rebuild(title, [...items]); }}
                className="w-14 px-2 py-1 text-xs rounded-md outline-none text-right font-mono" style={S.inputCSS} />
              <span className="text-caption font-mono w-10 text-right font-semibold" style={{ color: COLORS[i % COLORS.length] }}>
                {Math.round((item.value / total) * 100)}%
              </span>
              <Del onClick={() => rebuild(title, items.filter((_, j) => j !== i))} />
            </Card>
          ))}
        </div>
        <div className="mt-3"><AddBtn onClick={() => rebuild(title, [...items, { label: "New", value: 10 }])}>+ Add Slice</AddBtn></div>
      </Section>
    </>
  );
}

// ─── Sequence ───
function SequenceEditor({ code, onChange }: EditorProps) {
  // Parse participants (both "participant" and "actor")
  const participants = [...code.matchAll(/(?:participant|actor)\s+([\w.:-]+)(?:\s+as\s+.+)?/g)].map(m => m[1]);
  // Parse messages — support all arrow types
  const msgRegex = /([\w.:-]+)\s*(--?>>?\+?|--?\)\+?|--?>>\+?|-\)\+?)\s*([\w.:-]+)\s*:\s*(.+)/g;
  const messages = [...code.matchAll(msgRegex)].map(m => ({
    from: m[1], arrow: m[2].replace(/\+$/, ""), to: m[3], text: m[4].trim()
  }));
  // Collect lines that aren't participants or messages (Note, loop, alt, activate, etc.)
  const msgLineRegex = /^[\w.:-]+\s*(?:--?>>?|--?\)|--?>|-\))/;
  const otherLines: string[] = [];
  code.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "sequenceDiagram") return;
    if (/^(?:participant|actor)\s/.test(trimmed)) return;
    if (msgLineRegex.test(trimmed)) return;
    otherLines.push(line);
  });

  const arrows = [
    { value: "->>", icon: "━━▶", label: "Request" },
    { value: "-->>", icon: "╌╌▶", label: "Response" },
    { value: "->", icon: "━━━", label: "Solid" },
    { value: "-->", icon: "╌╌╌", label: "Dashed" },
    { value: "-)", icon: "━━○", label: "Async" },
  ];

  const rebuild = (parts: string[], msgs: typeof messages) => {
    let c = "sequenceDiagram\n";
    parts.forEach(p => { c += `    participant ${p}\n`; });
    msgs.forEach(m => { c += `    ${m.from}${m.arrow}${m.to}: ${m.text}\n`; });
    // Preserve unparsed lines (Notes, loops, etc.)
    otherLines.forEach(l => { c += l + "\n"; });
    onChange(c.trim());
  };

  return (
    <>
      <Section title="Participants" count={participants.length}>
        <div className="flex gap-2 flex-wrap">
          {participants.map((p, i) => (
            <Card key={i} index={i} style={{ padding: "6px 8px" }}>
              <input value={p} onChange={(e) => {
                const next = [...participants]; const old = next[i]; next[i] = e.target.value;
                rebuild(next, messages.map(m => ({ ...m, from: m.from === old ? e.target.value : m.from, to: m.to === old ? e.target.value : m.to })));
              }} className="w-24 bg-transparent outline-none text-xs font-semibold" style={{ color: "var(--text-primary)" }} />
              <Del onClick={() => rebuild(participants.filter((_, j) => j !== i), messages)} />
            </Card>
          ))}
          <button onClick={() => rebuild([...participants, `P${participants.length + 1}`], messages)}
            className="text-xs px-3 py-2 rounded-lg font-medium" style={S.accentBtn}>+ Add</button>
        </div>
      </Section>
      <Section title="Messages" count={messages.length}>
        <div className="space-y-2">
          {messages.map((m, i) => {
            return (
              <div key={i} className="p-3 space-y-2" style={S.card}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-caption font-mono w-5 text-center shrink-0" style={{ color: "var(--text-faint)" }}>{i + 1}</span>
                  <select value={m.from} onChange={(e) => { const n = [...messages]; n[i] = { ...n[i], from: e.target.value }; rebuild(participants, n); }}
                    className={`min-w-[70px] flex-1 ${S.input} text-xs font-semibold`} style={{ ...S.inputCSS, maxWidth: 120 }}>
                    {participants.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <div className="flex gap-0.5 shrink-0">
                    {arrows.map(a => (
                      <button key={a.value} onMouseDown={(e) => { e.preventDefault(); const n = [...messages]; n[i] = { ...n[i], arrow: a.value }; rebuild(participants, n); }}
                        className="px-1 py-1 rounded text-caption font-mono" title={a.label}
                        style={{ background: m.arrow === a.value ? "var(--text-primary)" : "var(--surface)", color: m.arrow === a.value ? "#000" : "var(--text-muted)", border: "1px solid var(--border)" }}>
                        {a.icon}
                      </button>
                    ))}
                  </div>
                  <select value={m.to} onChange={(e) => { const n = [...messages]; n[i] = { ...n[i], to: e.target.value }; rebuild(participants, n); }}
                    className={`min-w-[70px] flex-1 ${S.input} text-xs font-semibold`} style={{ ...S.inputCSS, maxWidth: 120 }}>
                    {participants.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <Del onClick={() => rebuild(participants, messages.filter((_, j) => j !== i))} />
                </div>
                <div className="flex items-center gap-2 ml-7">
                  <input value={m.text} onChange={(e) => { const n = [...messages]; n[i] = { ...n[i], text: e.target.value }; rebuild(participants, n); }}
                    className={`flex-1 ${S.input} text-xs`} style={S.inputCSS} placeholder="Message text" />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <AddBtn onClick={() => rebuild(participants, [...messages, { from: participants[0] || "A", arrow: "->>", to: participants[1] || "B", text: "message" }])}>
            + Add Message
          </AddBtn>
        </div>
      </Section>
    </>
  );
}

// ─── Generic List Editor (for Gantt, Timeline, Journey, Mindmap, etc) ───
// Handles the common pattern of sections with items

function GenericListEditor({ code, onChange, config }: EditorProps & {
  config: {
    title: string;
    parseTitle: (code: string) => string;
    parseSections: (code: string) => { name: string; items: { fields: Record<string, string> }[] }[];
    rebuild: (title: string, sections: { name: string; items: { fields: Record<string, string> }[] }[], origCode?: string) => string;
    itemFields: { key: string; label: string; width?: string; mono?: boolean; color?: string }[];
    sectionLabel: string;
    itemLabel: string;
    ratingField?: string;
  };
}) {
  const title = config.parseTitle(code);
  const sections = config.parseSections(code);

  const update = (t: string, s: typeof sections) => onChange(config.rebuild(t, s, code));

  const ratingColor = (r: number) => r >= 4 ? "#4ade80" : r >= 3 ? "#fbbf24" : "#ef4444";

  return (
    <>
      <Section title="Title">
        <Input value={title} onChange={(e) => update((e.target as HTMLInputElement).value, sections)}
          className="w-full font-semibold" placeholder={`${config.title} title`} />
      </Section>
      <Section title={config.sectionLabel} count={sections.length}>
        <div className="space-y-4">
          {sections.map((sec, si) => (
            <div key={si} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 rounded-full" style={{ background: COLORS[si % COLORS.length] }} />
                <input value={sec.name} onChange={(e) => { sections[si].name = e.target.value; update(title, [...sections]); }}
                  className="bg-transparent outline-none text-sm font-semibold flex-1" style={{ color: "var(--text-primary)" }} placeholder="Section" />
                <Del onClick={() => update(title, sections.filter((_, j) => j !== si))} />
              </div>
              {sec.items.map((item, ii) => (
                <Card key={ii} style={{ marginLeft: 12 }}>
                  {config.itemFields.map(f => (
                    f.key === config.ratingField ? (
                      <div key={f.key} className="flex gap-0.5">
                        {[1,2,3,4,5].map(r => (
                          <button key={r} onMouseDown={() => { sections[si].items[ii].fields[f.key] = String(r); update(title, [...sections]); }}
                            className="w-5 h-5 rounded-full text-caption font-bold"
                            style={{ background: parseInt(item.fields[f.key] || "3") >= r ? ratingColor(r) : "var(--surface)", color: parseInt(item.fields[f.key] || "3") >= r ? "#000" : "var(--text-faint)", border: "1px solid var(--border)" }}>
                            {r}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input key={f.key} value={item.fields[f.key] || ""} onChange={(e) => { sections[si].items[ii].fields[f.key] = e.target.value; update(title, [...sections]); }}
                        className={`${f.width || "flex-1"} text-xs bg-transparent outline-none ${f.mono ? "font-mono" : ""}`}
                        style={{ color: f.color || "var(--text-primary)" }} placeholder={f.label} />
                    )
                  ))}
                  <Del onClick={() => { sections[si].items.splice(ii, 1); update(title, [...sections]); }} />
                </Card>
              ))}
              <button onClick={() => {
                const defaults: Record<string, string> = {};
                config.itemFields.forEach(f => { defaults[f.key] = ""; });
                sec.items.push({ fields: defaults });
                update(title, [...sections]);
              }} className="ml-3 text-caption px-3 py-1.5 rounded-lg" style={S.accentBtn}>+ {config.itemLabel}</button>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <AddBtn onClick={() => {
            const defaults: Record<string, string> = {};
            config.itemFields.forEach(f => { defaults[f.key] = ""; });
            sections.push({ name: "Section", items: [{ fields: defaults }] });
            update(title, [...sections]);
          }}>+ Add {config.sectionLabel}</AddBtn>
        </div>
      </Section>
    </>
  );
}

// ─── Entity-Relationship Editor (for ER, Class, State, Block, Architecture) ───
function EntityRelEditor({ code, onChange, config }: EditorProps & {
  config: {
    title: string;
    parseEntities: (code: string) => { name: string; attrs: string[] }[];
    parseRelations: (code: string) => { from: string; rel: string; to: string; label: string }[];
    rebuild: (entities: { name: string; attrs: string[] }[], rels: { from: string; rel: string; to: string; label: string }[]) => string;
    relOptions: string[];
    entityLabel: string;
    attrLabel: string;
    relLabel: string;
  };
}) {
  const entities = config.parseEntities(code);
  const rels = config.parseRelations(code);

  const update = (e: typeof entities, r: typeof rels) => onChange(config.rebuild(e, r));

  return (
    <>
      <Section title={config.entityLabel} count={entities.length}>
        <div className="space-y-2">
          {entities.map((ent, ei) => (
            <div key={ei} className="p-3 space-y-1.5" style={S.card}>
              <div className="flex items-center gap-2">
                <input value={ent.name} onChange={(e) => { entities[ei].name = e.target.value; update([...entities], rels); }}
                  className="bg-transparent outline-none text-sm font-bold flex-1" style={{ color: "var(--text-primary)" }} />
                <Del onClick={() => update(entities.filter((_, j) => j !== ei), rels)} />
              </div>
              {ent.attrs.map((attr, ai) => (
                <div key={ai} className="flex gap-2 ml-2 items-center">
                  <span className="text-caption font-mono" style={{ color: COLORS[ei % COLORS.length] }}>•</span>
                  <input value={attr} onChange={(e) => { entities[ei].attrs[ai] = e.target.value; update([...entities], rels); }}
                    className="flex-1 text-xs font-mono bg-transparent outline-none" style={{ color: "var(--text-secondary)" }} />
                  <Del onClick={() => { entities[ei].attrs.splice(ai, 1); update([...entities], rels); }} />
                </div>
              ))}
              <button onClick={() => { ent.attrs.push(""); update([...entities], rels); }}
                className="ml-2 text-caption px-2 py-1 rounded" style={S.accentBtn}>+ {config.attrLabel}</button>
            </div>
          ))}
        </div>
        <div className="mt-3"><AddBtn onClick={() => update([...entities, { name: "New", attrs: ["field"] }], rels)}>+ Add {config.entityLabel}</AddBtn></div>
      </Section>
      <Section title={config.relLabel} count={rels.length}>
        <div className="space-y-2">
          {rels.map((r, ri) => (
            <Card key={ri}>
              <select value={r.from} onChange={(e) => { rels[ri].from = e.target.value; update(entities, [...rels]); }}
                className={`w-24 ${S.input} text-xs`} style={S.inputCSS}>
                {entities.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
              </select>
              <select value={r.rel} onChange={(e) => { rels[ri].rel = e.target.value; update(entities, [...rels]); }}
                className="w-16 text-xs font-mono text-center rounded px-1 py-1 outline-none" style={{ ...S.inputCSS, color: "var(--text-primary)" }}>
                {config.relOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <select value={r.to} onChange={(e) => { rels[ri].to = e.target.value; update(entities, [...rels]); }}
                className={`w-24 ${S.input} text-xs`} style={S.inputCSS}>
                {entities.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
              </select>
              <input value={r.label} onChange={(e) => { rels[ri].label = e.target.value; update(entities, [...rels]); }}
                className="flex-1 text-xs bg-transparent outline-none" style={{ color: "var(--text-primary)" }} placeholder="label" />
              <Del onClick={() => update(entities, rels.filter((_, j) => j !== ri))} />
            </Card>
          ))}
        </div>
        <div className="mt-3"><AddBtn onClick={() => update(entities, [...rels, { from: entities[0]?.name || "A", rel: config.relOptions[0], to: entities[1]?.name || "B", label: "" }])}>+ Add {config.relLabel}</AddBtn></div>
      </Section>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Editor Router
// ═══════════════════════════════════════════════════════════════

export function DiagramFormEditor({ code, onChange }: EditorProps) {
  const type = detectDiagramType(code);
  // showTypePicker removed — handled by header type selector

  const wrapper = (children: React.ReactNode) => (
    <div className="p-5 space-y-5 overflow-auto">
      {/* Type switcher removed — handled by header type selector */}
      {children}
    </div>
  );

  switch (type) {
    case "pie":
      return wrapper(<PieEditor code={code} onChange={onChange} />);

    case "sequence":
      return wrapper(<SequenceEditor code={code} onChange={onChange} />);

    case "gantt":
      return wrapper(
        <GenericListEditor code={code} onChange={onChange} config={{
          title: "Gantt",
          parseTitle: (c) => c.match(/title\s+(.+)/)?.[1] || "",
          parseSections: (c) => {
            const sections: { name: string; items: { fields: Record<string, string> }[] }[] = [];
            let cur = { name: "Default", items: [] as { fields: Record<string, string> }[] };
            c.split("\n").forEach(l => {
              const sm = l.match(/^\s*section\s+(.+)/);
              if (sm) { if (cur.items.length) sections.push(cur); cur = { name: sm[1], items: [] }; return; }
              const tm = l.match(/^\s{4,}(.+?)\s*:\s*(.+)/);
              if (tm && !l.includes("title") && !l.includes("dateFormat")) {
                const p = tm[2].split(",").map(s => s.trim());
                cur.items.push({ fields: { name: tm[1], status: p[0] || "", date: p.slice(1).join(", ") } });
              }
            });
            if (cur.items.length || !sections.length) sections.push(cur);
            return sections;
          },
          rebuild: (t, secs, origCode) => {
            const dateFormat = origCode?.match(/dateFormat\s+(.+)/)?.[1] || "YYYY-MM-DD";
            let c = `gantt\n    title ${t}\n    dateFormat ${dateFormat}\n`;
            secs.forEach(s => { c += `    section ${s.name}\n`; s.items.forEach(i => {
              const status = i.fields.status || "";
              const date = i.fields.date || "";
              const parts = [status, date].filter(Boolean).join(", ");
              c += `    ${i.fields.name || "Task"} :${parts}\n`;
            }); });
            return c.trim();
          },
          itemFields: [
            { key: "name", label: "Task name" },
            { key: "status", label: "status", width: "w-16", mono: true, color: "var(--text-primary)" },
            { key: "date", label: "date, duration", width: "w-32", mono: true, color: "var(--text-muted)" },
          ],
          sectionLabel: "Section",
          itemLabel: "Task",
        }} />
      );

    case "journey":
      return wrapper(
        <GenericListEditor code={code} onChange={onChange} config={{
          title: "Journey",
          parseTitle: (c) => c.match(/title\s+(.+)/)?.[1] || "",
          parseSections: (c) => {
            const secs: { name: string; items: { fields: Record<string, string> }[] }[] = [];
            let cur = { name: "", items: [] as { fields: Record<string, string> }[] };
            c.split("\n").forEach(l => {
              const sm = l.match(/^\s*section\s+(.+)/);
              if (sm) { if (cur.items.length) secs.push(cur); cur = { name: sm[1], items: [] }; return; }
              const tm = l.match(/^\s+(.+?)\s*:\s*(\d+)\s*(?::\s*(.+))?/);
              if (tm && !l.trim().startsWith("title")) cur.items.push({ fields: { name: tm[1].trim(), rating: tm[2], actors: tm[3]?.trim() || "" } });
            });
            if (cur.items.length) secs.push(cur);
            if (!secs.length) secs.push({ name: "Section", items: [{ fields: { name: "Task", rating: "5", actors: "" } }] });
            return secs;
          },
          rebuild: (t, secs) => {
            let c = `journey\n    title ${t}\n`;
            secs.forEach(s => { c += `    section ${s.name}\n`; s.items.forEach(i => { c += `      ${i.fields.name}: ${i.fields.rating || 3}${i.fields.actors ? ": " + i.fields.actors : ""}\n`; }); });
            return c.trim();
          },
          itemFields: [
            { key: "name", label: "Task" },
            { key: "actors", label: "actors", width: "w-20", color: "var(--text-muted)" },
          ],
          ratingField: "rating",
          sectionLabel: "Section",
          itemLabel: "Task",
        }} />
      );

    case "mindmap": {
      const lines = code.split("\n").slice(1).filter(l => l.trim());
      const items = lines.map(l => ({ indent: Math.floor(l.search(/\S/) / 2), text: l.trim() }));
      if (!items.length) items.push({ indent: 0, text: "Central Topic" });
      const rebuild = (itms: typeof items) => { let c = "mindmap\n"; itms.forEach(i => { c += "  ".repeat(i.indent + 1) + i.text + "\n"; }); onChange(c.trim()); };

      return wrapper(
        <Section title="Topics" count={items.length}>
          <div className="space-y-1.5">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 items-center" style={{ marginLeft: item.indent * 20 }}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[item.indent % COLORS.length] }} />
                <input value={item.text} onChange={(e) => { items[i].text = e.target.value; rebuild([...items]); }}
                  className="flex-1 bg-transparent outline-none text-sm" style={{ color: "var(--text-primary)" }} />
                <button onMouseDown={() => { if (item.indent > 0) { items[i].indent--; rebuild([...items]); } }}
                  className="text-caption px-1.5 py-1 rounded" style={{ color: "var(--text-muted)", background: "var(--surface)", border: "1px solid var(--border)" }}>◀</button>
                <button onMouseDown={() => { items[i].indent++; rebuild([...items]); }}
                  className="text-caption px-1.5 py-1 rounded" style={{ color: "var(--text-muted)", background: "var(--surface)", border: "1px solid var(--border)" }}>▶</button>
                <Del onClick={() => rebuild(items.filter((_, j) => j !== i))} />
              </div>
            ))}
          </div>
          <div className="mt-3"><AddBtn onClick={() => rebuild([...items, { indent: 1, text: "New topic" }])}>+ Add Topic</AddBtn></div>
        </Section>
      );
    }

    case "timeline": {
      const tlTitle = code.match(/title\s+(.+)/)?.[1] || "";
      const events: { period: string; items: string[] }[] = [];
      // Timeline format: periods have "YYYY" or text, items have ": text"
      // Both may be at the same indent level in mermaid syntax
      code.split("\n").forEach(l => {
        const t = l.trim();
        if (!t || t === "timeline" || t.startsWith("title")) return;
        // Items start with ":" prefix
        if (t.startsWith(":")) {
          const item = t.replace(/^:\s*/, "");
          if (events.length > 0) events[events.length - 1].items.push(item);
        }
        // Lines with " : " are period + first item inline (e.g. "2026 Q1 : Engine v0.1")
        else if (t.includes(" : ")) {
          const [period, ...rest] = t.split(" : ");
          events.push({ period: period.trim(), items: [rest.join(" : ").trim()] });
        }
        // Otherwise it's a period heading
        else {
          events.push({ period: t, items: [] });
        }
      });
      if (!events.length) events.push({ period: "2026", items: ["Event"] });
      const rebuild = () => { let c = `timeline\n    title ${tlTitle}\n`; events.forEach(e => { c += `    ${e.period}\n`; e.items.forEach(i => { c += `             : ${i}\n`; }); }); onChange(c.trim()); };

      return wrapper(
        <>
          <Section title="Title">
            <Input value={tlTitle} onChange={(e) => { code = code.replace(/title\s+.+/, `title ${(e.target as HTMLInputElement).value}`); onChange(code); }}
              className="w-full font-semibold" placeholder="Timeline title" />
          </Section>
          <Section title="Periods" count={events.length}>
            <div className="space-y-3">
              {events.map((ev, ei) => (
                <div key={ei} className="p-3 space-y-2" style={S.card}>
                  <div className="flex items-center gap-2">
                    <input value={ev.period} onChange={(e) => { events[ei].period = e.target.value; rebuild(); }}
                      className="bg-transparent outline-none text-sm font-bold" style={{ color: COLORS[ei % COLORS.length] }} />
                    <Del onClick={() => { events.splice(ei, 1); rebuild(); }} />
                  </div>
                  {ev.items.map((item, ii) => (
                    <div key={ii} className="flex gap-2 ml-3 items-center">
                      <input value={item} onChange={(e) => { events[ei].items[ii] = e.target.value; rebuild(); }}
                        className="flex-1 text-xs bg-transparent outline-none" style={{ color: "var(--text-primary)" }} />
                      <Del onClick={() => { events[ei].items.splice(ii, 1); rebuild(); }} />
                    </div>
                  ))}
                  <button onClick={() => { ev.items.push("Event"); rebuild(); }}
                    className="ml-3 text-caption px-2 py-1 rounded" style={S.accentBtn}>+ Event</button>
                </div>
              ))}
            </div>
            <div className="mt-3"><AddBtn onClick={() => { events.push({ period: "Period", items: ["Event"] }); rebuild(); }}>+ Add Period</AddBtn></div>
          </Section>
        </>
      );
    }

    case "er":
      return wrapper(
        <EntityRelEditor code={code} onChange={onChange} config={{
          title: "ER Diagram",
          parseEntities: (c) => [...c.matchAll(/([\w]+)\s*\{([^}]*)\}/g)].map(m => ({
            name: m[1], attrs: m[2].trim().split("\n").map(a => a.trim()).filter(Boolean)
          })),
          parseRelations: (c) => [...c.matchAll(/([\w]+)\s*(\|[o|]{1,2}--[o|]{1,2}\||\}[o|]--[o|]\{|[|}{o]+-*-*[|}{o]+)\s*([\w]+)\s*:\s*"?([^"\n]*)"?/g)].map(m => ({
            from: m[1], rel: m[2], to: m[3], label: m[4]
          })),
          rebuild: (ents, rels) => {
            let c = "erDiagram\n";
            ents.forEach(e => { c += `    ${e.name} {\n`; e.attrs.forEach(a => { c += `        ${a}\n`; }); c += `    }\n`; });
            rels.forEach(r => { c += `    ${r.from} ${r.rel} ${r.to} : "${r.label}"\n`; });
            return c.trim();
          },
          relOptions: ["||--o{", "}o--||", "||--||", "}o--o{", "||--o|"],
          entityLabel: "Entity", attrLabel: "Attribute", relLabel: "Relationship",
        }} />
      );

    case "class":
      return wrapper(
        <EntityRelEditor code={code} onChange={onChange} config={{
          title: "Class Diagram",
          parseEntities: (c) => [...c.matchAll(/class\s+(\w+)\s*\{([^}]*)\}/g)].map(m => ({
            name: m[1], attrs: m[2].trim().split("\n").map(a => a.trim()).filter(Boolean)
          })),
          parseRelations: (c) => [...c.matchAll(/(\w+)\s*((?:<\||\*|o)?--(?:\|>|\*|o)?|\.\.>|-->|--)\s*(\w+)(?:\s*:\s*(.+))?/g)].map(m => ({
            from: m[1], rel: m[2], to: m[3], label: m[4]?.trim() || ""
          })),
          rebuild: (ents, rels) => {
            let c = "classDiagram\n";
            ents.forEach(e => { c += `    class ${e.name} {\n`; e.attrs.forEach(a => { c += `        ${a}\n`; }); c += `    }\n`; });
            rels.forEach(r => { c += `    ${r.from} ${r.rel} ${r.to}${r.label ? " : " + r.label : ""}\n`; });
            return c.trim();
          },
          relOptions: ["<|--", "*--", "o--", "-->", "..|>", "..>", "--"],
          entityLabel: "Class", attrLabel: "Member", relLabel: "Relationship",
        }} />
      );

    case "state": {
      const states = [...new Set([...code.matchAll(/([\w]+)\s*(?:-->|:)/g)].map(m => m[1]).filter(s => !["[*]", "stateDiagram", "state"].includes(s)))];
      const transitions = [...code.matchAll(/([\w\[\]*]+)\s*-->\s*([\w\[\]*]+)(?:\s*:\s*(.+))?/g)].map(m => ({ from: m[1], to: m[2], label: m[3]?.trim() || "" }));
      // Preserve state descriptions and other non-transition lines
      const stateDescriptions: string[] = [];
      code.split("\n").forEach(l => {
        const t = l.trim();
        if (!t || t.startsWith("stateDiagram")) return;
        if (/-->/.test(t)) return; // transition — handled above
        if (/^\w+\s*:/.test(t)) stateDescriptions.push(l); // state description like "Idle : Waiting"
      });
      const rebuild = () => {
        let c = "stateDiagram-v2\n";
        stateDescriptions.forEach(l => { c += l + "\n"; });
        transitions.forEach(t => { c += `    ${t.from} --> ${t.to}${t.label ? " : " + t.label : ""}\n`; });
        onChange(c.trim());
      };

      return wrapper(
        <>
          <Section title="States" count={states.length}>
            <div className="flex gap-2 flex-wrap">
              {states.map((s, i) => (
                <div key={i} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ ...S.card, color: "var(--text-primary)" }}>{s}</div>
              ))}
            </div>
          </Section>
          <Section title="Transitions" count={transitions.length}>
            <div className="space-y-2">
              {transitions.map((t, ti) => (
                <Card key={ti}>
                  <select value={t.from} onChange={(e) => { transitions[ti].from = e.target.value; rebuild(); }}
                    className={`w-24 ${S.input} text-xs`} style={S.inputCSS}>
                    <option value="[*]">[*]</option>{states.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span style={{ color: "var(--text-primary)" }}>→</span>
                  <select value={t.to} onChange={(e) => { transitions[ti].to = e.target.value; rebuild(); }}
                    className={`w-24 ${S.input} text-xs`} style={S.inputCSS}>
                    {states.map(s => <option key={s} value={s}>{s}</option>)}<option value="[*]">[*]</option>
                  </select>
                  <input value={t.label} onChange={(e) => { transitions[ti].label = e.target.value; rebuild(); }}
                    className="flex-1 text-xs bg-transparent outline-none" style={{ color: "var(--text-primary)" }} placeholder="trigger" />
                  <Del onClick={() => { transitions.splice(ti, 1); rebuild(); }} />
                </Card>
              ))}
            </div>
            <div className="mt-3"><AddBtn onClick={() => { transitions.push({ from: states[0] || "[*]", to: states[1] || states[0] || "S1", label: "" }); rebuild(); }}>+ Add Transition</AddBtn></div>
          </Section>
        </>
      );
    }

    case "git": {
      const commands: { type: string; value: string }[] = [];
      code.split("\n").forEach(l => {
        const t = l.trim();
        if (t.startsWith("commit")) commands.push({ type: "commit", value: t.match(/id:\s*"([^"]+)"/)?.[1] || "" });
        else if (t.startsWith("branch")) commands.push({ type: "branch", value: t.replace("branch ", "") });
        else if (t.startsWith("checkout")) commands.push({ type: "checkout", value: t.replace("checkout ", "") });
        else if (t.startsWith("merge")) commands.push({ type: "merge", value: t.replace("merge ", "") });
      });
      if (!commands.length) commands.push({ type: "commit", value: "Initial" });
      const rebuild = () => {
        let c = "gitGraph\n"; commands.forEach(cmd => {
          if (cmd.type === "commit") c += `    commit${cmd.value ? ` id: "${cmd.value}"` : ""}\n`;
          else c += `    ${cmd.type} ${cmd.value}\n`;
        }); onChange(c.trim());
      };
      const colors: Record<string, string> = { commit: "#4ade80", branch: "#60a5fa", checkout: "#fbbf24", merge: "#f472b6" };

      return wrapper(
        <Section title="Git Commands" count={commands.length}>
          <div className="space-y-2">
            {commands.map((cmd, i) => (
              <Card key={i} index={i}>
                <select value={cmd.type} onChange={(e) => { commands[i].type = e.target.value; rebuild(); }}
                  className="w-24 text-xs font-mono rounded px-2 py-1.5 outline-none font-semibold" style={{ ...S.inputCSS, color: colors[cmd.type] }}>
                  {["commit", "branch", "checkout", "merge"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input value={cmd.value} onChange={(e) => { commands[i].value = e.target.value; rebuild(); }}
                  className="flex-1 text-xs bg-transparent outline-none" style={{ color: "var(--text-primary)" }}
                  placeholder={cmd.type === "commit" ? "commit message" : "branch name"} />
                <Del onClick={() => { commands.splice(i, 1); rebuild(); }} />
              </Card>
            ))}
          </div>
          <div className="mt-3"><AddBtn onClick={() => { commands.push({ type: "commit", value: "" }); rebuild(); }}>+ Add Command</AddBtn></div>
        </Section>
      );
    }

    case "quadrant": {
      const qtTitle = code.match(/title\s+(.+)/)?.[1] || "";
      const points = [...code.matchAll(/([\w\s]+?):\s*\[([0-9.]+),\s*([0-9.]+)\]/g)].map(m => ({ name: m[1].trim(), x: parseFloat(m[2]), y: parseFloat(m[3]) }));
      const rebuild = () => {
        const xL = code.match(/x-axis\s+"([^"]+)"/)?.[1] || "Low"; const xR = code.match(/x-axis\s+"[^"]+"\s+-->\s+"([^"]+)"/)?.[1] || "High";
        const yL = code.match(/y-axis\s+"([^"]+)"/)?.[1] || "Low"; const yT = code.match(/y-axis\s+"[^"]+"\s+-->\s+"([^"]+)"/)?.[1] || "High";
        let c = `quadrantChart\n    title ${qtTitle}\n    x-axis "${xL}" --> "${xR}"\n    y-axis "${yL}" --> "${yT}"\n`;
        points.forEach(p => { c += `    ${p.name}: [${p.x}, ${p.y}]\n`; }); onChange(c.trim());
      };

      return wrapper(
        <>
          <Section title="Title"><Input value={qtTitle} onChange={(e) => { code = code.replace(/title\s+.+/, `title ${(e.target as HTMLInputElement).value}`); onChange(code); }} className="w-full font-semibold" /></Section>
          <Section title="Data Points" count={points.length}>
            <div className="space-y-2">
              {points.map((p, i) => (
                <Card key={i} index={i}>
                  <input value={p.name} onChange={(e) => { points[i].name = e.target.value; rebuild(); }}
                    className="flex-1 text-xs bg-transparent outline-none" style={{ color: "var(--text-primary)" }} />
                  <span className="text-caption" style={{ color: "var(--text-faint)" }}>x:</span>
                  <input type="number" step="0.1" min="0" max="1" value={p.x} onChange={(e) => { points[i].x = parseFloat(e.target.value) || 0; rebuild(); }}
                    className="w-14 text-xs font-mono rounded px-1 py-0.5 outline-none" style={S.inputCSS} />
                  <span className="text-caption" style={{ color: "var(--text-faint)" }}>y:</span>
                  <input type="number" step="0.1" min="0" max="1" value={p.y} onChange={(e) => { points[i].y = parseFloat(e.target.value) || 0; rebuild(); }}
                    className="w-14 text-xs font-mono rounded px-1 py-0.5 outline-none" style={S.inputCSS} />
                  <Del onClick={() => { points.splice(i, 1); rebuild(); }} />
                </Card>
              ))}
            </div>
            <div className="mt-3"><AddBtn onClick={() => { points.push({ name: "Item", x: 0.5, y: 0.5 }); rebuild(); }}>+ Add Point</AddBtn></div>
          </Section>
        </>
      );
    }

    case "xy": {
      const xyTitle = code.match(/title\s+"([^"]+)"/)?.[1] || "";
      const xVals = code.match(/x-axis\s+\[([^\]]+)\]/)?.[1]?.split(",").map(s => s.trim().replace(/"/g, "")) || [];
      const series = [...code.matchAll(/(?:line|bar)\s+\[([^\]]+)\]/g)].map((m) => ({
        type: code.split("\n").find(l => l.includes(m[1]))?.trim().startsWith("bar") ? "bar" : "line",
        values: m[1].split(",").map(s => parseFloat(s.trim()))
      }));
      const yAxis = code.match(/y-axis\s+(.+)/)?.[1] || "";
      const rebuild = () => {
        let c = `xychart-beta\n    title "${xyTitle}"\n    x-axis [${xVals.map(v => `"${v}"`).join(", ")}]\n`;
        if (yAxis) c += `    y-axis ${yAxis}\n`;
        series.forEach(l => { c += `    ${l.type} [${l.values.join(", ")}]\n`; }); onChange(c.trim());
      };

      return wrapper(
        <>
          <Section title="Title"><Input value={xyTitle} onChange={(e) => { code = code.replace(/title\s+"[^"]+"/, `title "${(e.target as HTMLInputElement).value}"`); onChange(code); }} className="w-full font-semibold" /></Section>
          <Section title="X-Axis">
            <div className="flex gap-1 flex-wrap">{xVals.map((v, i) => (
              <input key={i} value={v} onChange={(e) => { xVals[i] = e.target.value; rebuild(); }} className="w-16 text-xs font-mono rounded px-2 py-1 outline-none" style={S.inputCSS} />
            ))}<button onClick={() => { xVals.push(""); rebuild(); }} className="text-caption px-2 py-1 rounded" style={S.accentBtn}>+</button></div>
          </Section>
          <Section title="Series" count={series.length}>
            <div className="space-y-2">{series.map((l, li) => (
              <div key={li} className="p-2 space-y-1" style={S.card}>
                <div className="flex items-center gap-2">
                  <select value={l.type} onChange={(e) => { series[li].type = e.target.value; rebuild(); }} className="text-xs rounded px-2 py-1 outline-none" style={S.inputCSS}>
                    <option value="line">Line</option><option value="bar">Bar</option>
                  </select>
                  <Del onClick={() => { series.splice(li, 1); rebuild(); }} />
                </div>
                <div className="flex gap-1 flex-wrap">{l.values.map((v, vi) => (
                  <input key={vi} type="number" value={v} onChange={(e) => { series[li].values[vi] = parseFloat(e.target.value) || 0; rebuild(); }}
                    className="w-14 text-xs font-mono rounded px-1 py-0.5 outline-none" style={S.inputCSS} />
                ))}</div>
              </div>
            ))}</div>
            <div className="mt-3"><AddBtn onClick={() => { series.push({ type: "bar", values: xVals.map(() => 0) }); rebuild(); }}>+ Add Series</AddBtn></div>
          </Section>
        </>
      );
    }

    default:
      // Fallback raw code editor
      return (
        <div className="flex flex-col flex-1">
          <div className="p-5">
            <Section title="Mermaid Code">
              <p className="text-caption mb-3" style={{ color: "var(--text-faint)" }}>Edit directly. Changes reflect in preview.</p>
            </Section>
          </div>
          <textarea value={code} onChange={(e) => onChange(e.target.value)}
            className="flex-1 px-5 pb-5 bg-transparent font-mono text-body resize-none outline-none leading-relaxed"
            style={{ color: "var(--editor-text)" }} spellCheck={false} />
        </div>
      );
  }
}
