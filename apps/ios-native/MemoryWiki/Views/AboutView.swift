// AboutView — version, what's new, credits. The iOS surface's
// equivalent of the web's /about page. Lives at Settings → About
// Memory.Wiki.

import SwiftUI

struct AboutView: View {
    private var versionLine: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1.0"
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "v\(v) (build \(b))"
    }

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    hero
                    whatsNew
                    sectionLinks("On the web", links: [
                        ("How it works", "https://memory.wiki/how"),
                        ("Manifesto", "https://memory.wiki/manifesto"),
                        ("Pricing", "https://memory.wiki/pricing"),
                    ])
                    sectionLinks("Across platforms", links: [
                        ("VS Code extension", "https://marketplace.visualstudio.com/items?itemName=raymindai.memory-wiki-vscode"),
                        ("Desktop (macOS)", "https://memory.wiki/download/desktop"),
                        ("Chrome extension", "https://memory.wiki/download/chrome"),
                        ("CLI (npm)", "https://www.npmjs.com/package/memory-wiki-cli"),
                        ("MCP server", "https://www.npmjs.com/package/memory-wiki-mcp"),
                    ])
                    sectionLinks("Legal", links: [
                        ("Terms", "https://memory.wiki/terms"),
                        ("Privacy", "https://memory.wiki/privacy"),
                    ])
                    credits
                }
                .padding(.horizontal, 18)
                .padding(.top, 18)
                .padding(.bottom, 32)
            }
        }
        .navigationTitle("About")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Brand.background, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 10) {
            MemoryWikiLogo(size: 30)
            Text("Your knowledge hub for the AI age.")
                .font(Brand.body(size: 14))
                .foregroundStyle(Brand.textMuted)
            HStack(spacing: 8) {
                Tag(label: "iOS COMPANION")
                Tag(label: versionLine)
            }
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var whatsNew: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel("WHAT'S NEW")
            VStack(alignment: .leading, spacing: 8) {
                Bullet(text: "Semantic search across the body of every doc, not just titles.")
                Bullet(text: "Camera + screenshot OCR for instant capture.")
                Bullet(text: "Share Extension, Spotlight, Home & Lock screen widget.")
                Bullet(text: "On-device theme + onboarding tour.")
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
            )
        }
    }

    @ViewBuilder
    private func sectionLinks(_ title: String, links: [(String, String)]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(title.uppercased())
            VStack(spacing: 0) {
                ForEach(links, id: \.0) { entry in
                    if let url = URL(string: entry.1) {
                        Link(destination: url) {
                            HStack {
                                Text(entry.0)
                                    .font(Brand.body(size: 14))
                                    .foregroundStyle(Brand.textPrimary)
                                Spacer()
                                Image(systemName: "arrow.up.right")
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundStyle(Brand.textFaint)
                            }
                            .padding(.horizontal, 14).padding(.vertical, 14)
                            .overlay(alignment: .bottom) {
                                if entry.0 != links.last?.0 {
                                    Rectangle().fill(Brand.borderDim).frame(height: 1).padding(.leading, 14)
                                }
                            }
                        }
                    }
                }
            }
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
            )
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }

    private var credits: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Built by Hyunsang + Claude.")
                .font(Brand.body(size: 12))
                .foregroundStyle(Brand.textMuted)
            Text("hi@raymind.ai · memory.wiki")
                .font(Brand.mono(size: 11))
                .foregroundStyle(Brand.textFaint)
        }
        .padding(.top, 8)
    }
}

private struct SectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text)
            .font(Brand.mono(size: 9, weight: .medium))
            .tracking(1.2)
            .foregroundStyle(Brand.textFaint)
    }
}

private struct Tag: View {
    let label: String
    var body: some View {
        Text(label)
            .font(Brand.mono(size: 9, weight: .medium))
            .tracking(1.0)
            .foregroundStyle(Brand.textMuted)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(Capsule().strokeBorder(Brand.borderDim, lineWidth: 1))
    }
}

private struct Bullet: View {
    let text: String
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(Brand.textFaint)
                .frame(width: 4, height: 4)
                .padding(.top, 8)
            Text(text)
                .font(Brand.body(size: 13))
                .foregroundStyle(Brand.textSecondary)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
    }
}

#Preview {
    NavigationStack { AboutView() }
        .preferredColorScheme(.dark)
}
