"use client";

/**
 * /privacy — legal text rendered with the Pure design system.
 * Single 720px column, PureProse for the policy body.
 */

import "../manifesto/manifesto.css"; // reuse the single-column wrapper styles
import {
  PureShell,
  PureNav,
  PureProse,
  PureFooter,
} from "@/components/pure";
import {
  SITE_NAV_EN,
  SITE_NAV_KO,
  SITE_NAV_MORE_EN,
  SITE_NAV_MORE_KO,
  SITE_NAV_MORE_LABEL_EN,
  SITE_NAV_MORE_LABEL_KO,
  SITE_NAV_CTA,
  SITE_NAV_CTA_KO,
  SITE_FOOTER_COLUMNS_EN,
  SITE_FOOTER_BOTTOM_LEFT_EN,
  SITE_FOOTER_BOTTOM_RIGHT,
  SITE_FOOTER_TAGLINE_EN,
  SITE_FOOTER_PARENT_EN,
} from "@/components/pure/site-chrome";

export default function PrivacyPure({ locale = "en" }: { locale?: "en" | "ko" }) {
  const isKo = locale === "ko";
  const otherLocale = isKo ? "en" : "ko";
  const langSwitch = {
    label: otherLocale === "ko" ? "한국어" : "EN",
    href: otherLocale === "ko" ? "/ko/privacy" : "/privacy",
    locale: otherLocale as "en" | "ko",
  };

  return (
    <PureShell locale={locale}>
      {(theme, toggleTheme) => (
        <>
          <PureNav
            theme={theme}
            toggleTheme={toggleTheme}
            links={isKo ? SITE_NAV_KO : SITE_NAV_EN}
            more={isKo ? SITE_NAV_MORE_KO : SITE_NAV_MORE_EN}
            moreLabel={isKo ? SITE_NAV_MORE_LABEL_KO : SITE_NAV_MORE_LABEL_EN}
            ctaLabel={isKo ? SITE_NAV_CTA_KO.label : SITE_NAV_CTA.label}
            ctaHref={isKo ? SITE_NAV_CTA_KO.href : SITE_NAV_CTA.href}
            langSwitch={langSwitch}
          />

          <div className="pure-manifesto-page">
            {/* Hero */}
            <div className="pure-manifesto-readtime mono">
              {isKo ? "최종 업데이트: 2026년 4월 15일" : "Last updated: April 15, 2026"}
            </div>
            <h1 className="pure-manifesto-title">
              {isKo ? "개인정보 처리방침" : "Privacy Policy"}
            </h1>
            <p className="pure-manifesto-intro">
              {isKo
                ? "memory.wiki는 Raymind AI가 운영하는 문서 발행 서비스입니다. 사용자의 프라이버시를 존중하고 데이터 보호에 책임을 다합니다. 본 방침은 memory.wiki 웹사이트, memory.wiki Chrome 확장, memory.wiki VS Code 확장, memory.wiki for Mac 데스크톱 앱, memory.wiki MCP 서버에 모두 적용됩니다."
                : "memory.wiki is a document publishing service operated by Raymind AI. We respect your privacy and are committed to protecting your data. This policy covers the memory.wiki website, the memory.wiki Chrome Extension, the memory.wiki VS Code Extension, the memory.wiki for Mac desktop app, and the memory.wiki MCP server."}
            </p>

            <PureProse>
              <h2>{isKo ? "수집 항목" : "What we collect"}</h2>

              <h3>{isKo ? "memory.wiki 웹사이트" : "memory.wiki website"}</h3>
              <ul>
                {isKo ? (
                  <>
                    <li><strong>발행한 문서</strong> — 공유 가능한 URL을 제공하기 위해 서버에 저장. 언제든 삭제 가능.</li>
                    <li><strong>계정 정보</strong> — 계정 생성 시 이메일과 표시 이름.</li>
                    <li><strong>애널리틱스</strong> — Vercel Analytics의 익명 사용 데이터 (페이지 뷰, 성능). 개인 식별 정보 추적 없음.</li>
                    <li><strong>이미지</strong> — 업로드된 이미지는 문서에서 보여주기 위해 서버에 저장.</li>
                  </>
                ) : (
                  <>
                    <li><strong>Documents you publish</strong> — stored on our servers to provide shareable URLs. You can delete your documents at any time.</li>
                    <li><strong>Account information</strong> — if you create an account, email address and display name.</li>
                    <li><strong>Analytics</strong> — Vercel Analytics for anonymous usage data (page views, performance). No personal information is tracked.</li>
                    <li><strong>Images</strong> — uploaded images are stored on our servers to serve them in your documents.</li>
                  </>
                )}
              </ul>

              <h3>{isKo ? "Chrome 확장" : "Chrome extension"}</h3>
              <ul>
                {isKo ? (
                  <>
                    <li><strong>페이지 콘텐츠</strong> — 확장은 AI 채팅 페이지 (ChatGPT, Claude, Gemini) 콘텐츠를 사용자가 &ldquo;캡처&rdquo; 버튼을 누를 때만 읽습니다. 콘텐츠는 memory.wiki로 직접 전송되며 다른 곳에 저장하지 않습니다.</li>
                    <li><strong>백그라운드 수집 없음</strong> — 확장은 어떤 브라우징 데이터도 모니터링하거나 수집하지 않습니다. 명시적으로 사용할 때만 작동.</li>
                    <li><strong>인증</strong> — memory.wiki에 로그인되어 있다면, 확장이 인증 쿠키를 읽어 이미지 업로드와 영구 URL 등 기능을 활성화.</li>
                  </>
                ) : (
                  <>
                    <li><strong>Page content</strong> — the extension reads content from AI chat pages (ChatGPT, Claude, Gemini) only when you click &ldquo;Capture.&rdquo; Content is sent directly to memory.wiki — we do not store it elsewhere.</li>
                    <li><strong>No background collection</strong> — the extension does not monitor, track, or collect any browsing data. It only activates when you explicitly use it.</li>
                    <li><strong>Authentication</strong> — if you are logged into memory.wiki, the extension reads your auth cookie to enable features like image upload and permanent URLs.</li>
                  </>
                )}
              </ul>

              <h3>{isKo ? "VS Code 확장" : "VS Code extension"}</h3>
              <ul>
                {isKo ? (
                  <>
                    <li><strong>파일 콘텐츠</strong> — 확장은 사용자가 명시적으로 열거나 발행하는 마크다운 파일을 읽습니다. Publish나 Sync 기능을 사용할 때만 memory.wiki로 전송.</li>
                    <li><strong>텔레메트리 없음</strong> — VS Code 확장에서 사용 텔레메트리를 수집하지 않습니다.</li>
                  </>
                ) : (
                  <>
                    <li><strong>File content</strong> — the extension reads Markdown files you explicitly open or publish. Content is sent to memory.wiki only when you use the Publish or Sync features.</li>
                    <li><strong>No telemetry</strong> — we do not collect usage telemetry from the VS Code extension.</li>
                  </>
                )}
              </ul>

              <h3>{isKo ? "memory.wiki for Mac" : "memory.wiki for Mac"}</h3>
              <ul>
                {isKo ? (
                  <>
                    <li><strong>로컬 파일</strong> — Finder나 Cmd+O로 여는 파일을 데스크톱 앱이 읽습니다. 파일은 memory.wiki에서 편집되고 로컬에 자동 저장.</li>
                    <li><strong>Phone-home 없음</strong> — 사용자가 명시적으로 발행하거나 sync하지 않는 한, 앱은 어떤 서버로도 데이터를 보내지 않습니다.</li>
                  </>
                ) : (
                  <>
                    <li><strong>Local files</strong> — the desktop app reads files you open via Finder or Cmd+O. Files are edited through memory.wiki and auto-saved locally.</li>
                    <li><strong>No phone-home</strong> — the app does not send data to any server unless you explicitly publish or sync a document.</li>
                  </>
                )}
              </ul>

              <h3>{isKo ? "MCP 서버 (memory-wiki-mcp)" : "MCP server (memory-wiki-mcp)"}</h3>
              <ul>
                {isKo ? (
                  <>
                    <li><strong>문서 작업</strong> — MCP 서버는 memory.wiki API를 통해 문서를 생성, 읽기, 관리합니다. 문서는 memory.wiki 서버에 저장.</li>
                    <li><strong>로컬 토큰</strong> — 편집 토큰은 <code>~/.memory.wiki/tokens.json</code>에 owner-only 권한 (0600) 으로 로컬 저장.</li>
                    <li><strong>이메일</strong> — 사용자 이메일 (<code>MDFY_EMAIL</code>) 은 문서 소유권을 위해 API로 전송. 제3자에 공유하지 않음.</li>
                  </>
                ) : (
                  <>
                    <li><strong>Document operations</strong> — the MCP server creates, reads, and manages documents on memory.wiki via its API. Documents are stored on memory.wiki servers.</li>
                    <li><strong>Local tokens</strong> — edit tokens are stored locally at <code>~/.memory.wiki/tokens.json</code> with owner-only permissions (0600).</li>
                    <li><strong>Email</strong> — your email (<code>MDFY_EMAIL</code>) is sent to the API for document ownership. It is not shared with third parties.</li>
                  </>
                )}
              </ul>

              <h2>{isKo ? "하지 않는 일" : "What we don’t do"}</h2>
              <ul>
                {isKo ? (
                  <>
                    <li>제3자에게 데이터를 판매하지 않습니다.</li>
                    <li>사용자 콘텐츠를 AI 모델 학습에 사용하지 않습니다.</li>
                    <li>사이트 간 추적을 하지 않습니다.</li>
                    <li>광고를 표시하지 않습니다.</li>
                  </>
                ) : (
                  <>
                    <li>We do not sell your data to third parties.</li>
                    <li>We do not use your content to train AI models.</li>
                    <li>We do not track you across websites.</li>
                    <li>We do not show advertisements.</li>
                  </>
                )}
              </ul>

              <h2>{isKo ? "데이터 저장과 보안" : "Data storage & security"}</h2>
              <p>
                {isKo
                  ? "문서와 사용자 데이터는 Supabase (PostgreSQL) 에 저장하며 저장 시 암호화 적용. 이미지는 Supabase Storage에 저장. 서비스는 Vercel에서 호스팅. 모든 연결은 HTTPS/TLS 암호화."
                  : "Documents and user data are stored on Supabase (PostgreSQL) with encryption at rest. Images are stored on Supabase Storage. The service is hosted on Vercel. All connections use HTTPS/TLS encryption."}
              </p>

              <h2>{isKo ? "데이터 삭제" : "Data deletion"}</h2>
              <p>
                {isKo ? (
                  <>생성한 모든 문서를 언제든 삭제할 수 있습니다. 계정이 있는 경우, <a href="mailto:hi@raymind.ai">hi@raymind.ai</a>로 이메일을 보내 전체 계정 삭제를 요청할 수 있습니다.</>
                ) : (
                  <>You can delete any document you created at any time. If you have an account, you can request full account deletion by emailing <a href="mailto:hi@raymind.ai">hi@raymind.ai</a>.</>
                )}
              </p>

              <h2>{isKo ? "쿠키" : "Cookies"}</h2>
              <p>
                {isKo
                  ? "인증 (로그인 세션) 과 테마 설정을 위한 필수 쿠키만 사용. 추적/광고 쿠키 사용하지 않음."
                  : "We use essential cookies for authentication (login session) and theme preference. We do not use tracking or advertising cookies."}
              </p>

              <h2>{isKo ? "변경" : "Changes"}</h2>
              <p>
                {isKo
                  ? "본 방침은 수시로 업데이트될 수 있습니다. 변경 사항은 업데이트 날짜와 함께 이 페이지에 게시됩니다."
                  : "We may update this policy from time to time. Changes will be posted on this page with an updated date."}
              </p>

              <h2>{isKo ? "문의" : "Contact"}</h2>
              <p>
                {isKo ? (
                  <>본 방침에 대한 문의는 <a href="mailto:hi@raymind.ai">hi@raymind.ai</a>로 이메일 주세요.</>
                ) : (
                  <>Questions about this policy? Email <a href="mailto:hi@raymind.ai">hi@raymind.ai</a>.</>
                )}
              </p>
            </PureProse>
          </div>

          <PureFooter
            theme={theme}
            columns={SITE_FOOTER_COLUMNS_EN}
            bottomLeft={SITE_FOOTER_BOTTOM_LEFT_EN}
            bottomRight={SITE_FOOTER_BOTTOM_RIGHT}
            tagline={SITE_FOOTER_TAGLINE_EN}
            parent={SITE_FOOTER_PARENT_EN}
          />
        </>
      )}
    </PureShell>
  );
}
