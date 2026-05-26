"use client";

/**
 * /terms — legal text rendered with the Pure design system.
 * Single 720px column, PureProse for the policy body.
 */

import "../manifesto/manifesto.css";
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

export default function TermsPure({ locale = "en" }: { locale?: "en" | "ko" }) {
  const isKo = locale === "ko";
  const otherLocale = isKo ? "en" : "ko";
  const langSwitch = {
    label: otherLocale === "ko" ? "한국어" : "EN",
    href: otherLocale === "ko" ? "/ko/terms" : "/terms",
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
            <div className="pure-manifesto-readtime mono">
              {isKo ? "최종 업데이트: 2026년 4월 15일" : "Last updated: April 15, 2026"}
            </div>
            <h1 className="pure-manifesto-title">
              {isKo ? "이용약관" : "Terms of Service"}
            </h1>
            <p className="pure-manifesto-intro">
              {isKo
                ? "Memory.Wiki, Memory.Wiki Chrome 확장, VS Code 확장, Memory.Wiki for Mac, Memory.Wiki MCP 서버 (이하 \"서비스\") 를 사용함으로써 본 약관에 동의하게 됩니다. 서비스는 Raymind AI가 운영합니다."
                : "By using Memory.Wiki, the Memory.Wiki Chrome Extension, VS Code Extension, Memory.Wiki for Mac, or the Memory.Wiki MCP server (collectively, “the Service”), you agree to these terms. The Service is operated by Raymind AI."}
            </p>

            <PureProse>
              <h2>{isKo ? "1. 서비스" : "1. The Service"}</h2>
              <p>
                {isKo
                  ? "Memory.Wiki는 마크다운 문서 발행 플랫폼입니다. 공유 가능한 URL로 문서를 생성, 편집, 공유할 수 있습니다. 서비스는 웹 에디터, 브라우저 확장, VS Code 확장, 데스크톱 앱, AI 도구 연동용 MCP 서버를 포함합니다."
                  : "Memory.Wiki is a Markdown document publishing platform. You can create, edit, and share documents via shareable URLs. The Service includes a web editor, browser extension, VS Code extension, desktop app, and MCP server for AI tool integration."}
              </p>

              <h2>{isKo ? "2. 사용자 콘텐츠" : "2. Your content"}</h2>
              <ul>
                {isKo ? (
                  <>
                    <li><strong>소유권</strong> — 사용자가 생성하거나 업로드한 모든 콘텐츠의 소유권은 사용자에게 있습니다. 콘텐츠에 대한 어떤 지적재산권도 주장하지 않습니다.</li>
                    <li><strong>당사 라이선스</strong> — 문서를 발행함으로써, 서비스 제공에 필요한 범위 (예: 공유 URL에서 문서 렌더링) 에서 콘텐츠를 저장, 표시, 제공할 제한적 라이선스를 부여합니다.</li>
                    <li><strong>공개 문서</strong> — 공개 URL로 공유한 문서는 링크가 있는 누구나 접근 가능합니다. 발행 콘텐츠에 대한 책임은 사용자에게 있습니다.</li>
                    <li><strong>삭제</strong> — 언제든 문서를 삭제할 수 있습니다. 삭제된 콘텐츠는 서버에서 제거됩니다.</li>
                  </>
                ) : (
                  <>
                    <li><strong>Ownership</strong> — you retain full ownership of all content you create or upload. We do not claim any intellectual property rights over your content.</li>
                    <li><strong>License to us</strong> — by publishing a document, you grant us a limited license to store, display, and serve your content as necessary to provide the Service (e.g., rendering your document at its shareable URL).</li>
                    <li><strong>Public documents</strong> — documents you share via public URLs are accessible to anyone with the link. You are responsible for the content you publish.</li>
                    <li><strong>Deletion</strong> — you can delete your documents at any time. Deleted content is removed from our servers.</li>
                  </>
                )}
              </ul>

              <h2>{isKo ? "3. 허용되지 않는 사용" : "3. Acceptable use"}</h2>
              <p>{isKo ? "다음 용도로 서비스를 사용하지 않을 것에 동의합니다:" : "You agree not to use the Service to:"}</p>
              <ul>
                {isKo ? (
                  <>
                    <li>불법, 유해, 학대적 콘텐츠 발행.</li>
                    <li>멀웨어나 피싱 콘텐츠 배포.</li>
                    <li>타인 사칭이나 신원 허위 표시.</li>
                    <li>API 남용 또는 서비스 방해 시도.</li>
                    <li>다른 사용자 콘텐츠 스크래이핑 또는 대량 다운로드.</li>
                  </>
                ) : (
                  <>
                    <li>Publish illegal, harmful, or abusive content.</li>
                    <li>Distribute malware or phishing content.</li>
                    <li>Impersonate others or misrepresent your identity.</li>
                    <li>Abuse the API or attempt to disrupt the Service.</li>
                    <li>Scrape or bulk-download content from other users.</li>
                  </>
                )}
              </ul>
              <p>
                {isKo
                  ? "본 약관을 위반하는 콘텐츠를 제거하거나 계정을 정지할 권리를 보유합니다."
                  : "We reserve the right to remove content or suspend accounts that violate these terms."}
              </p>

              <h2>{isKo ? "4. 계정" : "4. Accounts"}</h2>
              <p>
                {isKo
                  ? "일부 기능은 계정이 필요합니다 (Google 또는 GitHub 로그인). 계정 보안 유지의 책임은 사용자에게 있습니다. 계정 무단 접근에 대해 당사는 책임지지 않습니다."
                  : "Some features require an account (Google or GitHub sign-in). You are responsible for maintaining the security of your account. We are not liable for unauthorized access to your account."}
              </p>

              <h2>{isKo ? "5. 가격" : "5. Pricing"}</h2>
              <p>
                {isKo
                  ? "현재 모든 기능이 무료로 제공됩니다. 향후 유료 티어를 도입할 수 있습니다. 도입 시 기존 무료 기능은 유지되며, 변경 사항은 사전 공지합니다."
                  : "The Service is currently free for all features. We may introduce paid tiers in the future. If we do, existing free features will remain available, and we will provide advance notice of any changes."}
              </p>

              <h2>{isKo ? "6. 가용성" : "6. Availability"}</h2>
              <p>
                {isKo
                  ? "항상 서비스를 가용한 상태로 유지하도록 노력하지만 100% 가동시간을 보장하지 않습니다. 서비스는 어떤 종류의 보증도 없이 \"있는 그대로\" 제공됩니다."
                  : "We strive to keep the Service available at all times but do not guarantee 100% uptime. The Service is provided “as is” without warranties of any kind."}
              </p>

              <h2>{isKo ? "7. 책임 제한" : "7. Limitation of liability"}</h2>
              <p>
                {isKo
                  ? "법이 허용하는 최대 범위에서, Raymind AI는 서비스 사용으로 인한 간접적, 우발적, 결과적 손해에 대해 책임지지 않습니다. 당사의 총 책임은 청구 직전 12개월간 사용자가 지불한 금액 (있다면) 을 초과하지 않습니다."
                  : "To the maximum extent permitted by law, Raymind AI shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim (if any)."}
              </p>

              <h2>{isKo ? "8. 변경" : "8. Changes"}</h2>
              <p>
                {isKo
                  ? "본 약관은 수시로 업데이트될 수 있습니다. 변경 후 서비스 계속 사용은 동의로 간주됩니다. 중요한 변경은 웹사이트를 통해 공지합니다."
                  : "We may update these terms from time to time. Continued use of the Service after changes constitutes acceptance. Material changes will be communicated via the website."}
              </p>

              <h2>{isKo ? "9. 문의" : "9. Contact"}</h2>
              <p>
                {isKo ? (
                  <>본 약관에 대한 문의는 <a href="mailto:hi@raymind.ai">hi@raymind.ai</a>로 이메일 주세요.</>
                ) : (
                  <>Questions about these terms? Email <a href="mailto:hi@raymind.ai">hi@raymind.ai</a>.</>
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
