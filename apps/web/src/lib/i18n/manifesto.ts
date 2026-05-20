export interface ManifestoSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
  highlight?: string;
  afterHighlight?: string[];
  afterList?: string[];
}

export interface ManifestoTexts {
  backLabel: string;
  backHref: string;
  readingTime: string;
  title: string;
  intro: string[];
  sections: ManifestoSection[];
  beliefs: { title: string; body: string }[];
  beliefsHeading: string;
  whyNowHeading: string;
  whyNow: string[];
  whyMdfyHeading?: string;
  whyMdfy?: string[];
  roadmapHeading: string;
  roadmap: {
    phase: string;
    badge: "live" | "coming-soon" | "vision";
    badgeLabel: string;
    items: string;
  }[];
  invitationHeading: string;
  invitation: { audience: string; body: string }[];
  invitationParagraphs?: string[];
  invitationButtons?: { start: string; github: string; email: string };
  closing: {
    line1Html: string;
    line2Html: string;
    line3: string;
    line4Html: string;
  };
}

export function getManifestoTexts(locale: "en" | "ko"): ManifestoTexts {
  const texts: Record<"en" | "ko", ManifestoTexts> = {
    en: {
      backLabel: "\u2190 About",
      backHref: "/about",
      readingTime: "12 min read",
      title: "Why I\u2019m building memory.wiki",
      intro: [
        "I built memory.wiki in one month while doing other work. Now I\u2019m going full-time.",
        "This is why.",
      ],

      sections: [
        {
          heading: "The state of AI memory today",
          paragraphs: [
            "Every day, millions of people pour their thinking into ChatGPT, Claude, Gemini, and Cursor. We ask hard questions. We get back genuinely useful answers \u2014 strategies, code, frameworks, insights that took experts decades to develop.",
            "Then we close the tab.",
            "That answer is gone. Not literally \u2014 it sits in some chat history we\u2019ll never search. But functionally gone. We can\u2019t find it. We can\u2019t reuse it. We can\u2019t build on it.",
            "The next day, we ask similar questions. We get similar answers. We close the tab again.",
            "This is happening at civilizational scale. Trillions of tokens of high-quality, AI-assisted thinking, evaporating into chat histories nobody returns to. The world\u2019s most expensive forgetting machine.",
            'The industry\u2019s response so far is what I call <strong>extracted memory</strong> \u2014 services like Mem0 and Letta that watch your conversations and extract facts the AI thinks are important. \u201cSarah is vegetarian. Sarah lives in Seoul. Sarah is interested in LLM evaluation.\u201d',
            "Mem0 and Letta are excellent at what they do. They solve a real problem. But they answer a different question than the one I want to answer.",
            'They ask: <em class="manifesto-em">what should the AI remember about you?</em>',
            'I want to ask: <em class="manifesto-em">what do you want to remember?</em>',
            "These are not the same question. The first is about inference. The second is about authorship.",
          ],
        },
        {
          heading: "Why authorship matters",
          paragraphs: [
            "Memory is not just data. Memory is identity.",
            "What you remember shapes who you become. What an organization remembers shapes what it can do. This was true in the age of paper, true in the age of databases, and is more true in the age of AI than ever before.",
            "When you let an AI extract your memory, you let an AI define what mattered. You let an algorithm decide which thread of yesterday\u2019s thinking is worth carrying forward, which insight to compress into a fact, which piece of yourself to keep.",
            "That\u2019s a strange thing to outsource.",
            "Some people will outsource it gladly. The convenience is real. But for those of us who think carefully about what we want our future selves to know \u2014 for those of us who treat our knowledge as a craft, not a byproduct \u2014 there should be another option.",
            "That option is memory.wiki.",
          ],
        },
        {
          heading: "What memory.wiki is today",
          paragraphs: [
            "If you visited memory.wiki right now, you\u2019d see what looks like a markdown publishing tool \u2014 and it is.",
            'You can capture markdown from anywhere: ChatGPT, Claude, Gemini (via Chrome extension), GitHub repos, Notion pages, Obsidian vaults, any web URL, your terminal (<code class="manifesto-code">cat README.md | memory.wiki</code>), VS Code, your Mac clipboard. You can edit it in a beautiful WYSIWYG editor \u2014 no syntax friction, no install required. You can share it with a permanent URL that anyone can read in the browser, that any AI can fetch as context.',
            "It\u2019s a publishing tool. It works. People can use it today.",
            "And it\u2019s grown past the publishing layer. Every saved doc folds into a personal hub that auto-publishes a wiki manifest (index.md, SCHEMA.md, log.md), maintains a concept index across your library, and exposes a recall API any AI can query. The role-split is the load-bearing idea: you set the direction, memory.wiki structures the URL, any AI reads it.",
            "Shipped so far:",
          ],
          list: [
            "A unified markdown render pipeline (markdown-it) shared across every surface",
            "A web editor with WYSIWYG",
            "A Chrome extension for any AI chat",
            "VS Code extension, Mac desktop app, CLI, MCP server",
            "Five import surfaces: GitHub, Notion, Obsidian, URL, files",
            "Hub manifests \u2014 index.md / SCHEMA.md / log.md / llms.txt per hub",
            "Hub recall API with optional Haiku-based reranker",
            "Concept index + Related-in-your-hub + Needs-review lint",
            "Auto-classified doc intent (note / definition / decision / etc.)",
          ],
          afterList: [
            "I shipped this fast because I had a clear primitive: the markdown URL. Every surface points to the same thing. Every surface composes with the others.",
          ],
        },
        {
          heading: "The bigger bet",
          paragraphs: [
            "The bigger bet is that <strong>markdown URLs are the right substrate for AI-era knowledge</strong>.",
            "Not as a publishing tool. As infrastructure.",
            "LLMs read and write markdown natively. It\u2019s the lingua franca they were trained on. When ChatGPT outputs structured information, it outputs markdown. When you paste context into Claude, you paste markdown. When agents communicate with each other, the natural format is markdown. This is not changing. It\u2019s compounding.",
            "Humans also read markdown natively. Plain text formatted lightly is how we\u2019ve taken notes for centuries. It\u2019s how we\u2019ll keep taking them. No proprietary format will displace it.",
            "URLs are the simplest possible interface. Anyone can paste them. Any agent can fetch them. They cross every boundary \u2014 operating systems, applications, AIs, time zones, decades.",
            'Andrej Karpathy put it the cleanest: <em class="manifesto-em">"Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."</em> He drew it for the Obsidian shape. We drew it for the URL shape. Same insight, different deploy target \u2014 local files vs. a public address every AI can fetch.',
            "If LLMs write markdown, humans read markdown, and URLs cross every boundary, then the natural primitive for AI-era knowledge is <strong>a markdown document at a URL</strong>.",
          ],
        },
        {
          heading: "What\u2019s coming next",
          paragraphs: [
            "The memory layer is now live. Hub URLs, recall API, concept index, and the wiki manifests all shipped. What\u2019s left is the part that turns memory.wiki from a tool people learn into one they reach for without thinking.",
          ],
          highlight:
            "You should be able to take what you\u2019ve authored and deploy it as context to any AI, anywhere \u2014 without remembering how memory.wiki works.",
          afterHighlight: [
            "Deeper ingest: Bear, Apple Notes, Roam, Drive. Native ingestion from every place people already keep notes, with the same dedup contract that makes re-importing safe.",
            "Sharper recall: latency budgets on the cross-encoder rerank, a hybrid scoring that the user can dial without reading docs, and citations that visibly improve the answer instead of just appearing under it.",
            "Cleaner curation: today the Needs-review lint surfaces orphan docs and likely duplicates. Next: stale claims, contradiction detection, missing cross-references \u2014 the lint signals Karpathy gestured at for his wiki, applied to yours.",
            "Plus the mundane work that ships a real product: payment, custom domains, branding, a public hub directory worth pointing other people at.",
          ],
        },
      ],

      beliefs: [
        {
          title: "Markdown is the right primitive.",
          body: "Not Notion blocks. Not proprietary formats. Plain markdown \u2014 what LLMs speak natively, what humans can read without a viewer.",
        },
        {
          title: "URLs are the right interface.",
          body: "Not SDKs. Not vendor APIs. A URL \u2014 pastable, fetchable, openable by any human, by any AI, on any platform.",
        },
        {
          title: "Memory is something you author.",
          body: "Not something extracted from your conversations behind your back. You write it. You edit it. You decide what stays.",
        },
        {
          title: "AI is a collaborator, not just a tool.",
          body: "Ask AI to bundle docs about a topic. Review what it picked. Edit annotations. Save. Human + AI building knowledge together \u2014 not AI building knowledge for you in a black box.",
        },
        {
          title: "Knowledge has scopes \u2014 Document, Bundle, Hub.",
          body: "Same URL primitive at three scales. A single answer is a Document URL. A themed collection is a Bundle URL. Your entire knowledge is a Hub URL.",
        },
        {
          title: "Memory should be deployable.",
          body: "Storage isn't the goal. A memory you can't paste back into an AI as context isn't doing the work memory is supposed to do. Every URL fetches as clean markdown context.",
        },
        {
          title: "Open by default.",
          body: "The whole repo is open source. The Bundle Spec is published openly. Open formats are how durable infrastructure gets built.",
        },
      ],
      beliefsHeading: "The seven beliefs",

      whyNowHeading: "Why now",
      whyNow: [
        "For the past two years, the industry has been building closed AI memory systems \u2014 OpenAI Memory inside ChatGPT, Google\u2019s Memory Bank inside Gemini. Each one is trying to own your memory inside their walls.",
        "In another two years, either the closed systems will have won, or an open standard will have emerged. I\u2019m betting on the second outcome. I\u2019m betting that markdown URLs become the open standard for AI memory the way HTTP became the open standard for documents.",
        "memory.wiki exists to make that outcome more likely.",
      ],

      roadmapHeading: "The roadmap",
      roadmap: [
        {
          phase: "Phase 1 \u2014 now",
          badge: "live",
          badgeLabel: "LIVE",
          items:
            "Markdown publishing tool. Capture from any AI, edit in WYSIWYG, share with permanent URLs. Free during beta.",
        },
        {
          phase: "Phase 2 \u2014 next 8 weeks",
          badge: "coming-soon",
          badgeLabel: "COMING SOON",
          items:
            "Memory Bundle, Semantic Search, Bundle Versioning. The transition from publishing tool to memory layer.",
        },
        {
          phase: "Phase 3 \u2014 Year 1",
          badge: "vision",
          badgeLabel: "VISION",
          items:
            "MCP write access for AI agents. Team workspaces. Open Bundle Spec v1.0.",
        },
        {
          phase: "Phase 4 \u2014 Year 2-3",
          badge: "vision",
          badgeLabel: "VISION",
          items:
            "Bundle marketplace. Enterprise self-host. Standard-setting consortium.",
        },
      ],

      invitationHeading: "An open invitation",
      invitation: [
        {
          audience: "If you use AI daily",
          body: "Try memory.wiki. The Chrome extension is the fastest entry. Beta is free.",
        },
        {
          audience: "If you build AI agents or tools",
          body: "Look at the MCP server. Write access coming Phase 2.",
        },
        {
          audience: "If you care about open standards",
          body: "Bundle spec is coming. Want feedback before it ships.",
        },
        {
          audience: "If you\u2019re an investor",
          body: "Not raising now. Will when metrics justify. Care about open infrastructure.",
        },
      ],
      invitationButtons: {
        start: "Start now",
        github: "GitHub",
        email: "hi@raymind.ai",
      },

      closing: {
        line1Html:
          'memory.wiki is built by Hyunsang at <a href="https://raymind.ai" class="manifesto-link">Raymind.AI</a>.',
        line2Html:
          'The codebase is <a href="https://github.com/raymindai/mdcore" target="_blank" rel="noopener noreferrer" class="manifesto-link">open source on GitHub</a>.',
        line3: "The Bundle spec will be published before Phase 2 ships.",
        line4Html:
          'Reach me at <a href="mailto:hi@raymind.ai" class="manifesto-link">hi@raymind.ai</a>.',
      },
    },

    ko: {
      backLabel: "\u2190 About",
      backHref: "/ko/about",
      readingTime: "12\uBD84",
      title: "\uB0B4\uAC00 memory.wiki\uB97C \uB9CC\uB4DC\uB294 \uC774\uC720",
      intro: [
        "\uB2E4\uB978 \uC77C\uC744 \uD558\uBA74\uC11C \uD55C \uB2EC \uB9CC\uC5D0 memory.wiki\uB97C \uB9CC\uB4E4\uC5C8\uC2B5\uB2C8\uB2E4. \uC774\uC81C \uD480\uD0C0\uC784\uC73C\uB85C \uC804\uD658\uD569\uB2C8\uB2E4.",
        "\uC774\uAC8C \uADF8 \uC774\uC720\uC785\uB2C8\uB2E4.",
      ],

      sections: [
        {
          heading: "\uC624\uB298\uB0A0 AI memory\uC758 \uD604\uC2E4",
          paragraphs: [
            "\uC6B0\uB9AC\uB294 \uB9E4\uC77C AI\uC640 \uB300\uD654\uD569\uB2C8\uB2E4. ChatGPT, Claude, Gemini \u2014 \uAC01\uAC01 \uB2E4\uB978 \uC571\uC5D0\uC11C, \uB2E4\uB978 \uD3EC\uB9F7\uC73C\uB85C, \uB2E4\uB978 \uBC29\uC2DD\uC73C\uB85C. \uC88B\uC740 \uB2F5\uBCC0\uC744 \uBC1B\uC73C\uBA74 \uBCF5\uC0AC\uD574\uC11C \uB178\uD2B8 \uC571\uC5D0 \uBD99\uC5EC\uB123\uC2B5\uB2C8\uB2E4. Google Docs\uC5D0 \uC62E\uAE30\uAE30\uB3C4 \uD558\uACE0, \uC2AC\uB799\uC5D0 \uACF5\uC720\uD558\uAE30\uB3C4 \uD569\uB2C8\uB2E4.",
            "\uADF8\uB7F0\uB370 \uB3CC\uC544\uBCF4\uBA74 \u2014 \uADF8 \uC9C0\uC2DD\uC740 \uC5B4\uB514\uC5D0 \uC788\uB098\uC694? \uC138 \uAC1C\uC758 AI \uC571, \uB2E4\uC12F \uAC1C\uC758 \uB178\uD2B8 \uC571, \uC218\uC2ED \uAC1C\uC758 \uBE0C\uB77C\uC6B0\uC800 \uD0ED\uC5D0 \uD769\uC5B4\uC838 \uC788\uC2B5\uB2C8\uB2E4. \uCC3E\uC744 \uC218 \uC5C6\uACE0, \uC7AC\uC0AC\uC6A9\uD560 \uC218 \uC5C6\uACE0, \uACF5\uC720\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
            "AI\uAC00 \uB9CC\uB4E0 \uC9C0\uC2DD\uC740 \uB9CC\uB4E4\uC5B4\uC9C0\uB294 \uC21C\uAC04 \uD769\uC5B4\uC9D1\uB2C8\uB2E4. \uAD6C\uC870\uB3C4 \uC5C6\uACE0, \uC8FC\uC18C\uB3C4 \uC5C6\uACE0, \uC8FC\uC778\uB3C4 \uC5C6\uC2B5\uB2C8\uB2E4.",
          ],
        },
        {
          heading: "Authorship\uC774 \uC911\uC694\uD55C \uC774\uC720",
          paragraphs: [
            "AI\uB294 \uD14D\uC2A4\uD2B8\uB97C \uC0DD\uC131\uD569\uB2C8\uB2E4. \uD558\uC9C0\uB9CC \uADF8 \uD14D\uC2A4\uD2B8\uB97C \u201C\uBB38\uC11C\u201D\uB85C \uB9CC\uB4DC\uB294 \uAC74 \uC0AC\uB78C\uC785\uB2C8\uB2E4. \uAD6C\uC870\uB97C \uC7A1\uACE0, \uB9E5\uB77D\uC744 \uB354\uD558\uACE0, \uD544\uC694 \uC5C6\uB294 \uBD80\uBD84\uC744 \uC798\uB77C\uB0B4\uACE0, \uC790\uAE30 \uBAA9\uC18C\uB9AC\uB97C \uC785\uD799\uB2C8\uB2E4.",
            "\uC774 \uACFC\uC815\uC774 authorship\uC785\uB2C8\uB2E4. AI \uCD9C\uB825\uBB3C\uC758 \uB2E8\uC21C \uCD94\uCD9C\uC774 \uC544\uB2C8\uB77C, \uC0AC\uB78C\uC758 \uD310\uB2E8\uACFC \uD3B8\uC9D1\uC774 \uB4E4\uC5B4\uAC04 \u201C\uC800\uC791\u201D\uC785\uB2C8\uB2E4.",
            "memory.wiki\uB294 \uC774 authorship\uC744 \uC9C0\uC6D0\uD558\uB294 \uB3C4\uAD6C\uC785\uB2C8\uB2E4. AI\uAC00 \uB9CC\uB4E0 \uC6D0\uC7AC\uB8CC\uB97C \uB2F9\uC2E0\uC758 \uBB38\uC11C\uB85C \uBC14\uAFB8\uB294 \uACF3. \uADF8\uB9AC\uACE0 \uADF8 \uBB38\uC11C\uC5D0 \uC601\uAD6C\uC801\uC778 URL\uC744 \uBD80\uC5EC\uD558\uB294 \uACF3.",
          ],
        },
        {
          heading: "memory.wiki\uAC00 \uC9C0\uAE08 \uBB34\uC5C7\uC778\uAC00",
          paragraphs: [
            "memory.wiki\uB294 \uB9C8\uD06C\uB2E4\uC6B4 \uD5C8\uBE0C\uC785\uB2C8\uB2E4. \uC5B4\uB514\uC11C\uB4E0 \uCEA1\uCC98\uD558\uACE0, AI \uB3C4\uAD6C\uB85C \uD3B8\uC9D1\uD558\uACE0, \uC601\uAD6C URL\uB85C \uD37C\uBE14\uB9AC\uC2DC\uD569\uB2C8\uB2E4.",
          ],
          list: [
            "<strong>\uCEA1\uCC98</strong> \u2014 Chrome Extension, VS Code, Mac App, CLI, \uBD99\uC5EC\uB123\uAE30. \uC5B4\uB5A4 AI\uC5D0\uC11C\uB4E0, \uC5B4\uB5A4 \uC5D0\uB514\uD130\uC5D0\uC11C\uB4E0, \uC6D0\uD074\uB9AD\uC73C\uB85C.",
            "<strong>\uD3B8\uC9D1</strong> \u2014 WYSIWYG \uD3B8\uC9D1, AI \uB3C4\uAD6C (\uC694\uC57D, \uBC88\uC5ED, \uB2E4\uB4EC\uAE30), \uBC84\uC804 \uD788\uC2A4\uD1A0\uB9AC, \uD0DC\uADF8 & \uD3F4\uB354.",
            "<strong>\uD37C\uBE14\uB9AC\uC2DC</strong> \u2014 \uC601\uAD6C URL, \uACF5\uAC1C/\uBE44\uACF5\uAC1C \uC124\uC815, \uBE44\uBC00\uBC88\uD638 \uBCF4\uD638, QR \uCF54\uB4DC, iframe \uC784\uBCA0\uB4DC.",
          ],
          afterList: [
            "markdown-it\uAC00 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uC9C1\uC811 \uD30C\uC2F1\uD569\uB2C8\uB2E4. KaTeX \uC218\uC2DD, Mermaid \uB2E4\uC774\uC5B4\uADF8\uB7A8, 190+ \uC5B8\uC5B4 \uAD6C\uBB38 \uAC15\uC870\uAC00 \uD3EC\uD568\uB429\uB2C8\uB2E4. \uB85C\uADF8\uC778 \uC5C6\uC774 3\uCD08 \uC548\uC5D0 \uAC00\uCE58\uB97C \uC804\uB2EC\uD569\uB2C8\uB2E4.",
          ],
        },
        {
          heading: "\uB354 \uD070 \uBCA0\uD305",
          paragraphs: [
            "memory.wiki\uB294 \uB9C8\uD06C\uB2E4\uC6B4 \uB3C4\uAD6C\uB85C \uC2DC\uC791\uD558\uC9C0\uB9CC, \uAD81\uADF9\uC801\uC73C\uB85C\uB294 AI \uC2DC\uB300\uC758 memory layer\uB97C \uB9CC\uB4E4\uB824\uACE0 \uD569\uB2C8\uB2E4.",
            "\uBAA8\uB4E0 AI \uB300\uD654, \uBAA8\uB4E0 \uBA54\uBAA8, \uBAA8\uB4E0 \uBB38\uC11C\uAC00 \uD558\uB098\uC758 \uC8FC\uC18C\uB97C \uAC16\uACE0, \uD558\uB098\uC758 \uC7A5\uC18C\uC5D0\uC11C \uAD00\uB9AC\uB418\uACE0, \uC5B4\uB5A4 AI\uC5D0\uB4E0 \uCEE8\uD14D\uC2A4\uD2B8\uB85C \uC804\uB2EC\uB420 \uC218 \uC788\uB294 \uC138\uACC4. \uB9C8\uD06C\uB2E4\uC6B4 URL\uC774 AI \uC2DC\uB300 \uC9C0\uC2DD\uC758 substrate\uAC00 \uB418\uB294 \uC138\uACC4.",
            "\uC774\uAC74 \uB2E8\uC21C\uD55C \uC5D0\uB514\uD130 \uB9CC\uB4E4\uAE30\uAC00 \uC544\uB2D9\uB2C8\uB2E4. AI\uC640 \uC0AC\uB78C \uC0AC\uC774\uC758 \uC778\uD130\uD398\uC774\uC2A4\uB97C \uC7AC\uC815\uC758\uD558\uB294 \uC77C\uC785\uB2C8\uB2E4.",
          ],
        },
        {
          heading: "\uB2E4\uC74C\uC5D0 \uC62C \uAC83",
          paragraphs: [],
          list: [
            "<strong>Bundle as context</strong> \u2014 \uC5EC\uB7EC \uBB38\uC11C\uB97C \uD558\uB098\uC758 \uBC88\uB4E4\uB85C \uBB36\uC5B4 AI\uC5D0\uAC8C \uC804\uB2EC. \u201C\uC774 \uD504\uB85C\uC81D\uD2B8\uC758 \uBAA8\uB4E0 \uBB38\uC11C\uB97C \uC77D\uC5B4\u201D\uAC00 \uAC00\uB2A5\uD574\uC9D1\uB2C8\uB2E4.",
            "<strong>MCP Server & REST API</strong> \u2014 \uC5B4\uB5A4 AI \uC5D0\uC774\uC804\uD2B8\uB4E0 memory.wiki \uBB38\uC11C\uB97C \uC77D\uACE0, \uC4F0\uACE0, \uC5C5\uB370\uC774\uD2B8\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
            "<strong>Hub \uAE30\uBC18 knowledge memory</strong> \u2014 \uCEE8\uC149 \uC778\uB371\uC2A4, Related-in-your-hub, Needs-review lint\uC73C\uB85C \uAC1C\uC778 \uC704\uD0A4\uAC00 \uC790\uB77C\uB0A9\uB2C8\uB2E4.",
          ],
        },
      ],

      beliefs: [
        {
          title: "\uB9C8\uD06C\uB2E4\uC6B4\uC774 \uC62C\uBC14\uB978 primitive\uB2E4.",
          body: "Notion \uBE14\uB85D\uB3C4, \uB3C5\uC810 \uD3EC\uB9F7\uB3C4 \uC544\uB2D9\uB2C8\uB2E4. \uADF8\uB0E5 \uB9C8\uD06C\uB2E4\uC6B4 \u2014 LLM\uC774 native\uB85C \uB9D0\uD558\uACE0, \uC0AC\uB78C\uC774 \uBDF0\uC5B4 \uC5C6\uC774 \uC77D\uC744 \uC218 \uC788\uB294 \uD615\uC2DD.",
        },
        {
          title: "URL\uC774 \uC62C\uBC14\uB978 \uC778\uD130\uD398\uC774\uC2A4\uB2E4.",
          body: "SDK\uB3C4, \uBCA4\uB354 API\uB3C4 \uC544\uB2D9\uB2C8\uB2E4. URL \u2014 \uB204\uAD6C\uB4E0, \uC5B4\uB5A4 AI\uB4E0, \uC5B4\uB514\uC11C\uB4E0 paste\uD558\uACE0 fetch\uD558\uACE0 \uC5F4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
        },
        {
          title: "\uBA54\uBAA8\uB9AC\uB294 \uB2F9\uC2E0\uC774 \uC791\uC131\uD558\uB294 \uAC83\uC774\uB2E4.",
          body: "\uB300\uD654 \uB4A4\uC5D0\uC11C \uC790\uB3D9 \uCD94\uCD9C\uB418\uB294 \uAC83\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uB2F9\uC2E0\uC774 \uC501\uB2C8\uB2E4. \uD3B8\uC9D1\uD569\uB2C8\uB2E4. \uBB34\uC5C7\uC744 \uB0A8\uAE38\uC9C0 \uACB0\uC815\uD569\uB2C8\uB2E4.",
        },
        {
          title: "AI\uB294 \uB3C4\uAD6C\uAC00 \uC544\uB2C8\uB77C collaborator\uB2E4.",
          body: "AI\uC5D0\uAC8C \uC8FC\uC81C \uAD00\uB828 docs\uB97C \uBB36\uC5B4 \uB2EC\uB77C\uACE0 \uC694\uCCAD\uD558\uC138\uC694. \uACB0\uACFC \uAC80\uD1A0. annotation \uD3B8\uC9D1. \uC800\uC7A5. Human + AI\uAC00 \uD568\uAED8 \uC9C0\uC2DD\uC744 \uB9CC\uB4ED\uB2C8\uB2E4 \u2014 AI \uD63C\uC790 \uBE14\uB799\uBC15\uC2A4\uC5D0\uC11C \uB9CC\uB4DC\uB294 \uAC8C \uC544\uB2D9\uB2C8\uB2E4.",
        },
        {
          title: "\uC9C0\uC2DD\uC740 \uC2A4\uCF54\uD504\uAC00 \uC788\uB2E4 \u2014 Document, Bundle, Hub.",
          body: "\uAC19\uC740 URL primitive, \uC138 \uAC00\uC9C0 \uC2A4\uCF00\uC77C. \uD55C \uB2F5\uBCC0\uC740 Document URL. \uC8FC\uC81C\uBCC4 \uCEEC\uB809\uC158\uC740 Bundle URL. \uC804\uCCB4 \uC9C0\uC2DD\uC740 Hub URL.",
        },
        {
          title: "\uBA54\uBAA8\uB9AC\uB294 deployable\uD574\uC57C \uD55C\uB2E4.",
          body: "\uC800\uC7A5\uC774 \uBAA9\uC801\uC774 \uC544\uB2D9\uB2C8\uB2E4. AI\uC5D0 \uCEE8\uD14D\uC2A4\uD2B8\uB85C \uB2E4\uC2DC paste \uBABB\uD558\uB294 \uBA54\uBAA8\uB9AC\uB294 \uBA54\uBAA8\uB9AC \uC5ED\uD560\uC744 \uBABB\uD569\uB2C8\uB2E4. \uBAA8\uB4E0 URL\uC774 \uAE68\uB057\uD55C markdown \uCEE8\uD14D\uC2A4\uD2B8\uB85C fetch\uB429\uB2C8\uB2E4.",
        },
        {
          title: "Open by default.",
          body: "mdcore\uB294 \uC624\uD508\uC18C\uC2A4. Bundle Spec\uC740 \uACF5\uAC1C \uD45C\uC900. Open format\uC774 durable\uD55C \uC778\uD504\uB77C\uB97C \uB9CC\uB4DC\uB294 \uBC29\uC2DD\uC785\uB2C8\uB2E4.",
        },
      ],
      beliefsHeading: "\uC77C\uACF1 \uAC00\uC9C0 belief",

      whyNowHeading: "\uC99D \uC9C0\uAE08\uC778\uAC00",
      whyNow: [
        "AI \uCC44\uD305\uC774 \uD3ED\uBC1C\uC801\uC73C\uB85C \uB298\uC5B4\uB098\uB294 \uC9C0\uAE08, \uADF8 \uCD9C\uB825\uBB3C\uC744 \uAD00\uB9AC\uD558\uB294 \uB808\uC774\uC5B4\uB294 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4. Notion\uC740 \uBB34\uAC81\uACE0, Google Docs\uB294 \uB9C8\uD06C\uB2E4\uC6B4\uC744 \uBAA8\uB974\uACE0, GitHub Gist\uB294 \uAC1C\uBC1C\uC790 \uC804\uC6A9\uC785\uB2C8\uB2E4.",
        "\uC9C0\uAE08\uC774 \uC544\uB2C8\uBA74 \uC774 \uC790\uB9AC\uB294 \uB2E4\uB978 \uB204\uAD70\uAC00\uAC00 \uCC28\uC9C0\uD569\uB2C8\uB2E4. \uC9C0\uAE08\uC774 \uC815\uD655\uD788 \uB9DE\uB294 \uD0C0\uC774\uBC0D\uC785\uB2C8\uB2E4.",
      ],

      whyMdfyHeading: "\uC99D memory.wiki\uC778\uAC00",
      whyMdfy: [
        "memory.wiki\uB294 \u201Cmodify\u201D\uC5D0\uC11C \uC654\uC2B5\uB2C8\uB2E4. \uB9C8\uD06C\uB2E4\uC6B4\uC744 \uC218\uC815\uD558\uACE0(modify), \uC544\uB984\uB2F5\uAC8C \uB9CC\uB4E4\uACE0(beautify), \uD37C\uBE14\uB9AC\uC2DC\uD558\uB294(publish) \uB3C4\uAD6C. md + fy = \uB9C8\uD06C\uB2E4\uC6B4\uC744 ~\uD558\uAC8C \uB9CC\uB4E4\uB2E4.",
      ],

      roadmapHeading: "\uB85C\uB4DC\uB9F5",
      roadmap: [
        {
          phase: "Phase 1 (\uD604\uC7AC)",
          badge: "live",
          badgeLabel: "LIVE",
          items:
            "\uB2E8\uC77C markdown-it \uD30C\uC774\uD504\uB77C\uC778, WYSIWYG, \uC601\uAD6C URL, Chrome/VS Code/Mac \uC571, AI \uCEA1\uCC98",
        },
        {
          phase: "Phase 2 (Q2 2026)",
          badge: "coming-soon",
          badgeLabel: "COMING SOON",
          items:
            "Bundle as context, MCP & API, Pro \uD50C\uB79C, \uCEE4\uC2A4\uD140 \uB3C4\uBA54\uC778, \uC870\uD68C \uBD84\uC11D",
        },
        {
          phase: "Phase 3+",
          badge: "vision",
          badgeLabel: "VISION",
          items:
            "Hub recall + reranker \uC77C\uBC18\uD654, mditor Writer, \uB354 \uB9CE\uC740 import surfaces, AI \uD611\uC5C5 \uB3C4\uAD6C",
        },
      ],

      invitationHeading: "\uC5F4\uB9B0 \uCD08\uB300",
      invitation: [],
      invitationParagraphs: [
        "memory.wiki\uB294 1\uC778 + AI \uD300\uC774 \uB9CC\uB4E4\uACE0 \uC788\uC2B5\uB2C8\uB2E4. \uC624\uD508\uC18C\uC2A4 \uAE30\uC5EC, \uD53C\uB4DC\uBC31, \uC544\uC774\uB514\uC5B4 \u2014 \uBAA8\uB450 \uD658\uC601\uD569\uB2C8\uB2E4.",
        "\uB9C8\uD06C\uB2E4\uC6B4\uC774 AI \uC2DC\uB300\uC758 lingua franca\uAC00 \uB420 \uC218 \uC788\uB2E4\uACE0 \uBFF0\uB294\uB2E4\uBA74, \uD568\uAED8 \uB9CC\uB4E4\uC5B4 \uAC11\uC2DC\uB2E4.",
      ],
      invitationButtons: {
        start: "\uC9C0\uAE08 \uC2DC\uC791\uD558\uAE30",
        github: "GitHub",
        email: "hi@raymind.ai",
      },

      closing: {
        line1Html:
          'memory.wiki is built by Hyunsang at <a href="https://raymind.ai" class="manifesto-link">Raymind.AI</a>.',
        line2Html:
          'The codebase is <a href="https://github.com/raymindai/mdcore" target="_blank" rel="noopener noreferrer" class="manifesto-link">open source on GitHub</a>.',
        line3: "The Bundle spec will be published before Phase 2 ships.",
        line4Html:
          'Reach me at <a href="mailto:hi@raymind.ai" class="manifesto-link">hi@raymind.ai</a>.',
      },
    },
  };

  return texts[locale];
}
