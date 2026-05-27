// DocStatusIcon — port of apps/web/src/components/DocStatusIcon.tsx.
// Same vocabulary so the iOS timeline reads the same as the web
// sidebar: Cloud (private), Globe (public), Users (restricted to
// specific emails), FileIcon (local-only). Sync glyph (small
// checkmark badge) overlays the corner when the doc came in from
// a companion surface (VS Code / Desktop / CLI / MCP / Chrome).

import SwiftUI

struct DocStatusIcon: View {
    let doc: Document
    var size: CGFloat = 18

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            base
                .frame(width: size, height: size)
            if doc.syncedSource != nil {
                syncBadge
                    .offset(x: 3, y: 3)
            }
        }
        .accessibilityLabel(label)
    }

    @ViewBuilder private var base: some View {
        if doc.isDraft == false && doc.isRestricted {
            // Published + restricted to specific people
            Image(systemName: "person.2.fill")
                .font(.system(size: size * 0.7, weight: .regular))
                .foregroundStyle(Brand.microInfo)
        } else if doc.isDraft == false {
            // Public — anyone with the URL
            Image(systemName: "globe")
                .font(.system(size: size * 0.78, weight: .regular))
                .foregroundStyle(Brand.microLime)
        } else {
            // Private — cloud-only, only owner
            Image(systemName: "cloud.fill")
                .font(.system(size: size * 0.78, weight: .regular))
                .foregroundStyle(Brand.textFaint)
        }
    }

    /// Tiny circle with a check — mirrors the web's
    /// data-sidebar sync badge: ink dot, white check, sits at
    /// the corner of the access glyph.
    private var syncBadge: some View {
        ZStack {
            Circle()
                .fill(Brand.background)
                .frame(width: 12, height: 12)
            Circle()
                .fill(Brand.textPrimary)
                .frame(width: 10, height: 10)
            Image(systemName: "checkmark")
                .font(.system(size: 6.5, weight: .bold))
                .foregroundStyle(Brand.background)
        }
    }

    private var label: String {
        var pieces: [String] = []
        if doc.isDraft == false && doc.isRestricted { pieces.append("Shared with specific people") }
        else if doc.isDraft == false { pieces.append("Public") }
        else { pieces.append("Private") }
        if let src = doc.syncedSource { pieces.append("synced from \(src)") }
        return pieces.joined(separator: " — ")
    }
}

#Preview {
    ZStack {
        Brand.background.ignoresSafeArea()
        VStack(spacing: 18) {
            DocStatusIcon(doc: Document(id: "a", title: "Private", updatedAt: nil, createdAt: nil, isDraft: true, viewCount: 0, allowedEmails: nil, source: nil))
            DocStatusIcon(doc: Document(id: "b", title: "Public", updatedAt: nil, createdAt: nil, isDraft: false, viewCount: 0, allowedEmails: nil, source: nil))
            DocStatusIcon(doc: Document(id: "c", title: "Restricted", updatedAt: nil, createdAt: nil, isDraft: false, viewCount: 0, allowedEmails: ["a@b.com"], source: nil))
            DocStatusIcon(doc: Document(id: "d", title: "Synced", updatedAt: nil, createdAt: nil, isDraft: true, viewCount: 0, allowedEmails: nil, source: "vscode"))
            DocStatusIcon(doc: Document(id: "e", title: "Public + synced", updatedAt: nil, createdAt: nil, isDraft: false, viewCount: 0, allowedEmails: nil, source: "chrome"))
        }
    }
}
