"use client";

/**
 * /bookmarklet — drag-to-bookmarks-bar install page.
 * Migrated to PureDocsShell for unified left-sidebar nav + on-this-page TOC.
 */

import "../manifesto/manifesto.css";
import "./bookmarklet.css";
import { PureProse } from "@/components/pure";
import PureDocsShell, { memoryWikiNavGroups } from "@/components/PureDocsShell";
import InstallButton from "./InstallButton";

const BOOKMARKLET_HREF = `javascript:void((function(){var s=document.createElement('script');s.src='https://memory.wiki/bookmarklet.js?v='+Date.now();document.body.appendChild(s);})());`;

export default function BookmarkletPure({ locale = "en" }: { locale?: "en" | "ko" }) {
  const isKo = locale === "ko";

  return (
    <PureDocsShell
      locale={locale}
      currentPath={isKo ? "/ko/bookmarklet" : "/bookmarklet"}
      navGroups={memoryWikiNavGroups(locale)}
      toc={[
        { id: "step-1", label: isKo ? "1. 북마크 바 표시"      : "1. Show the bookmarks bar" },
        { id: "step-2", label: isKo ? "2. 버튼 드래그"          : "2. Drag the button" },
        { id: "step-3", label: isKo ? "3. AI 대화에서 사용"     : "3. Use on any AI chat" },
        { id: "what",   label: isKo ? "클릭하면 일어나는 일"    : "What happens on click" },
      ]}
    >
      <div className="pure-manifesto-page">
        <h1 className="pure-manifesto-title">
          {isKo ? "memory.wiki 북마클릿." : "The memory.wiki bookmarklet."}
        </h1>
        <p className="pure-manifesto-intro">
          {isKo
            ? "어떤 AI 채팅 페이지에서든 한 번 클릭으로 대화를 허브에 저장. 확장도, 설치도, 계정도 필요 없음."
            : "One click on any AI chat page saves the conversation to your hub. No extension, no install, no account required."}
        </p>

        <PureProse>
          <h2 id="step-1">{isKo ? "1단계 / 북마크 바 표시" : "Step 1 / Show the bookmarks bar"}</h2>
          <p>
            {isKo ? (
              <>브라우저의 북마크 바가 보이는지 확인. 대부분의 브라우저에서 <code>⌘⇧B</code> (Mac) 또는 <code>Ctrl+Shift+B</code> (Windows/Linux).</>
            ) : (
              <>Make sure your browser&apos;s bookmarks bar is visible. On most browsers, press <code>⌘⇧B</code> (Mac) or <code>Ctrl+Shift+B</code> (Windows/Linux).</>
            )}
          </p>

          <h2 id="step-2">{isKo ? "2단계 / 버튼을 위로 드래그" : "Step 2 / Drag the button up"}</h2>
          <p>{isKo ? "이 버튼을 북마크 바로 드래그." : "Drag this button up to your bookmarks bar."}</p>
          <div className="pure-bookmarklet-drop">
            <InstallButton href={BOOKMARKLET_HREF} />
          </div>
          <p className="pure-bookmarklet-note">
            {isKo
              ? "브라우저가 처음에 확인 다이얼로그를 띄울 수 있습니다. 정상 — 북마클릿은 코드 조각이 들어간 북마크일 뿐."
              : "Your browser may show a confirmation dialog the first time. That’s normal — bookmarklets are just bookmarks with a snippet of code."}
          </p>

          <h2 id="step-3">{isKo ? "3단계 / 어떤 AI 대화에서든 사용" : "Step 3 / Use it on any AI conversation"}</h2>
          <ul>
            {isKo ? (
              <>
                <li><strong>ChatGPT</strong> — chatgpt.com에서 동작 (아직 공유하지 않은 채팅 포함 모든 채팅).</li>
                <li><strong>Claude</strong> — claude.ai에서 동작. Cloudflare는 이걸 보지 못함; 북마클릿은 브라우저에서 실행.</li>
                <li><strong>Gemini</strong> — gemini.google.com에서 동작.</li>
              </>
            ) : (
              <>
                <li><strong>ChatGPT</strong> — works on chatgpt.com (any chat, including ones you haven&apos;t shared yet).</li>
                <li><strong>Claude</strong> — works on claude.ai. Cloudflare can&apos;t see this; the bookmarklet runs in your browser.</li>
                <li><strong>Gemini</strong> — works on gemini.google.com.</li>
              </>
            )}
          </ul>

          <h2 id="what">{isKo ? "클릭하면 일어나는 일" : "What happens when you click it"}</h2>
          <ol>
            {isKo ? (
              <>
                <li>북마클릿이 현재 어떤 AI인지 감지.</li>
                <li>페이지 DOM의 보이는 대화를 따라가며 깨끗한 마크다운으로 변환.</li>
                <li>마크다운을 memory.wiki에 저장하고 새 문서 URL을 새 탭에서 엽니다.</li>
                <li>기본은 익명 — 나중에 로그인하면 캡처한 모든 문서를 허브에 귀속시킬 수 있음.</li>
              </>
            ) : (
              <>
                <li>The bookmarklet detects which AI you&apos;re on.</li>
                <li>It walks the visible conversation in the page DOM and converts it to clean markdown.</li>
                <li>It saves the markdown to memory.wiki and opens the new doc URL in a new tab.</li>
                <li>Anonymous by default — sign in later to claim every doc you&apos;ve captured into your hub.</li>
              </>
            )}
          </ol>

          <hr />

          <p>
            {isKo ? (
              <><strong>프라이버시.</strong> 북마클릿은 캡처된 대화, 페이지 URL, 어떤 AI에서 왔는지만 전송. 그 외 아무것도.</>
            ) : (
              <><strong>Privacy.</strong> The bookmarklet only sends the captured conversation, the page URL, and which AI it came from. Nothing else.</>
            )}
          </p>
          <p>
            {isKo ? (
              <><strong>오픈 소스.</strong> 스크립트는 <a href="/bookmarklet.js">memory.wiki/bookmarklet.js</a>에 — 읽고, fork하고, 원하면 다른 곳에서 실행.</>
            ) : (
              <><strong>Open source.</strong> The script lives at <a href="/bookmarklet.js">memory.wiki/bookmarklet.js</a> — read it, fork it, run it from somewhere else if you prefer.</>
            )}
          </p>
        </PureProse>
      </div>
    </PureDocsShell>
  );
}
