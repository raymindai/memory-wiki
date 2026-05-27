// TimelineView — reverse-chronological list of the user's
// documents. v8 W9 first cut: pulls /api/user/documents and renders
// a minimal list. Pull-to-refresh, swipe-to-share (the URL, not
// the body — paste-anywhere story).

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
        NavigationStack {
            content
                .navigationTitle("Timeline")
                .task { await model.load() }
                .refreshable { await model.load() }
        }
    }

    @ViewBuilder private var content: some View {
        if model.loading && model.documents.isEmpty {
            ProgressView().controlSize(.large)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let error = model.errorMessage, model.documents.isEmpty {
            ContentUnavailableView("Couldn't load timeline", systemImage: "wifi.slash", description: Text(error))
        } else if model.documents.isEmpty {
            ContentUnavailableView("Nothing captured yet", systemImage: "tray", description: Text("Use the Share Extension or the Capture tab to add your first doc."))
        } else {
            List(model.documents) { doc in
                NavigationLink(value: doc) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(doc.title ?? "Untitled").font(.headline)
                        if let updated = doc.updatedAtRelative {
                            Text(updated).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
                .swipeActions(edge: .trailing) {
                    ShareLink(item: doc.publicURL) { Label("Share", systemImage: "square.and.arrow.up") }
                }
            }
            .listStyle(.plain)
            .navigationDestination(for: Document.self) { _ in
                // Detail view lands in a follow-up commit; placeholder for now.
                Text("Doc detail — coming next").padding()
            }
        }
    }
}

#Preview {
    TimelineView()
}
