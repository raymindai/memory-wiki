// TimelineView — bordered card rows over the dark zinc canvas.
// Matches the web sidebar's "MDs" list look (Cal Sans title +
// JetBrains Mono relative-time + ink swatches, hairline borders).
//
// Pull-to-refresh, swipe-to-share. Empty + error states use the
// same quiet typography hierarchy as the rest of the app — no
// large illustrations, no "system" placeholder iconography.

import SwiftUI

@MainActor
final class TimelineModel: ObservableObject {
    @Published private(set) var documents: [Document] = []
    @Published private(set) var loading = false
    @Published var errorMessage: String?

    func load() async {
        loading = true
        defer { loading = false }
        do {
            documents = try await APIClient.shared.userDocuments()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct TimelineView: View {
    @StateObject private var model = TimelineModel()

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()

            VStack(spacing: 0) {
                TimelineHeader(count: model.documents.count)
                content
            }
        }
        .task { await model.load() }
    }

    @ViewBuilder private var content: some View {
        if model.loading && model.documents.isEmpty {
            VStack(spacing: 10) {
                Spacer()
                ProgressView()
                    .tint(Brand.textFaint)
                Text("LOADING")
                    .font(Brand.mono(size: 9, weight: .medium))
                    .tracking(1)
                    .foregroundStyle(Brand.textFaint)
                Spacer()
            }
            .frame(maxWidth: .infinity)
        } else if let error = model.errorMessage, model.documents.isEmpty {
            EmptyState(title: "Couldn't load timeline", caption: error, glyph: "wifi.slash")
        } else if model.documents.isEmpty {
            EmptyState(title: "Nothing captured yet", caption: "Use the Capture tab or the iOS Share Sheet to add your first doc.", glyph: "tray")
        } else {
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(model.documents) { doc in
                        DocumentRow(doc: doc)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 12)
            }
            .refreshable { await model.load() }
        }
    }
}

private struct TimelineHeader: View {
    let count: Int

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("Timeline")
                .font(Brand.display(size: 26))
                .foregroundStyle(Brand.textPrimary)
            Spacer()
            Text("\(count)")
                .font(Brand.mono(size: 11))
                .foregroundStyle(Brand.textFaint)
        }
        .padding(.horizontal, 18)
        .padding(.top, 18)
        .padding(.bottom, 12)
    }
}

private struct DocumentRow: View {
    let doc: Document

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Ink doc glyph — no fill, just a thin outline.
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .strokeBorder(Brand.border, lineWidth: 1)
                .frame(width: 16, height: 20)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 4) {
                Text(doc.title ?? "Untitled")
                    .font(Brand.body(size: 14, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
                    .lineLimit(1)
                if let updated = doc.updatedAtRelative {
                    Text(updated)
                        .font(Brand.mono(size: 10))
                        .foregroundStyle(Brand.textFaint)
                }
            }

            Spacer()

            ShareLink(item: doc.publicURL) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(Brand.textFaint)
                    .frame(width: 28, height: 28)
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Brand.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(Brand.borderDim, lineWidth: 1)
                )
        )
    }
}

private struct EmptyState: View {
    let title: String
    let caption: String
    let glyph: String

    var body: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: glyph)
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(Brand.textFaint)
            Text(title)
                .font(Brand.body(size: 15, weight: .medium))
                .foregroundStyle(Brand.textPrimary)
            Text(caption)
                .font(Brand.body(size: 13))
                .foregroundStyle(Brand.textMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    TimelineView()
}
