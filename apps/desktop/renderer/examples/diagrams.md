# Mermaid Diagrams — All 19 Types

> **Tip:** Double-click any diagram to open the visual editor.

## Flowchart

```mermaid
graph LR
    A[Markdown] --> B[mdcore Engine]
    B --> C[WASM]
    B --> D[Native Binary]
    C --> E[Browser]
    D --> F[CLI]
    style B fill:#fb923c,stroke:#ea580c,color:#000
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant App
    participant API
    User->>App: Request
    App->>API: Fetch data
    API-->>App: Response
    App-->>User: Render
```

## Pie Chart

```mermaid
pie title Tech Stack
    "Rust" : 40
    "TypeScript" : 35
    "CSS" : 15
    "Other" : 10
```

## Gantt Chart

```mermaid
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Design :2026-01-01, 10d
    Develop :2026-01-11, 20d
    section Phase 2
    Test :2026-02-01, 7d
    Launch :2026-02-08, 3d
```

## Class Diagram

```mermaid
classDiagram
    class Engine {
        +render(md) HTML
        +detectFlavor() Flavor
    }
    class Renderer {
        +highlight() void
        +katex() void
    }
    Engine <|-- Renderer
```

## State Diagram

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Loading : fetch
    Loading --> Rendered : success
    Loading --> Error : fail
    Error --> Idle : retry
    Rendered --> [*]
```

## ER Diagram

```mermaid
erDiagram
    User {
        int id
        string name
    }
    Document {
        int id
        string markdown
    }
    User ||--o{ Document : creates
```

## Mindmap

```mermaid
mindmap
  root((mdcore))
    Product
      Memory.Wiki
      Chrome Extension
    Engine
      Rust
      WASM
    Features
      GFM
      KaTeX
      Mermaid
```

## Timeline

```mermaid
timeline
    title mdcore Milestones
    2026 Q1 : Engine v0.1
             : Memory.Wiki launch
    2026 Q2 : npm package
             : CLI tool
    2026 Q3 : API platform
```

## User Journey

```mermaid
journey
    title First-time User
    section Discover
      Visit site: 5: User
      See demo: 4: User
    section Use
      Paste MD: 5: User
      Share URL: 4: User
```

## Quadrant Chart

```mermaid
quadrantChart
    title Feature Priority
    x-axis "Low Effort" --> "High Effort"
    y-axis "Low Impact" --> "High Impact"
    Share URL: [0.2, 0.9]
    PDF Export: [0.4, 0.6]
    Canvas Mode: [0.8, 0.7]
    Themes: [0.3, 0.4]
```

## Git Graph

```mermaid
gitGraph
    commit id: "init"
    branch feature
    commit id: "add engine"
    commit id: "add wasm"
    checkout main
    commit id: "hotfix"
    merge feature
    commit id: "v0.1"
```

## XY Chart

```mermaid
xychart-beta
    title "Monthly Users"
    x-axis ["Jan", "Feb", "Mar", "Apr", "May"]
    y-axis "Users" 0 --> 500
    bar [120, 200, 350, 280, 450]
    line [100, 180, 300, 250, 400]
```


---

*All 19 Mermaid diagram types with visual editors. Double-click to edit.*
