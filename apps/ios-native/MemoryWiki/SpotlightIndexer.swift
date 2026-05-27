// SpotlightIndexer — pushes doc metadata into Core Spotlight so
// the user can find them via iOS system search. Each entry's
// uniqueIdentifier is the doc id, so tapping a Spotlight result
// hands the app the right id via continueUserActivity, which we
// route through AppRouter.handle(url:) as memorywiki://doc/<id>.
//
// Called after every TimelineModel.load() — replaces the whole
// "MemoryWiki.Docs" domain so deleted docs disappear from search
// on the next refresh.

import Foundation
import CoreSpotlight
import UniformTypeIdentifiers

enum SpotlightIndexer {
    static let domain = "wiki.memory.MemoryWiki.Docs"

    /// Replace the entire iOS-side search index with the latest
    /// snapshot. Safe to call from a background thread.
    static func sync(_ docs: [Document]) async {
        let items = docs.map(makeItem(from:))
        do {
            try await CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: [domain])
            try await CSSearchableIndex.default().indexSearchableItems(items)
        } catch {
            // Spotlight failures are non-fatal — silently swallow.
        }
    }

    private static func makeItem(from doc: Document) -> CSSearchableItem {
        let attrs = CSSearchableItemAttributeSet(contentType: .text)
        attrs.title = doc.displayTitle
        attrs.contentDescription = doc.publicURL.absoluteString
        if let updated = doc.updatedAt {
            attrs.contentModificationDate = updated
            attrs.contentCreationDate = doc.createdAt ?? updated
        }
        attrs.identifier = doc.id
        attrs.relatedUniqueIdentifier = doc.id
        attrs.kind = "memory.wiki document"
        // Keywords help Spotlight rank — append the host so
        // "memory.wiki" itself matches the user's docs.
        attrs.keywords = ["memory.wiki", "memorywiki", doc.id, doc.syncedSource].compactMap { $0 }
        return CSSearchableItem(
            uniqueIdentifier: doc.id,
            domainIdentifier: domain,
            attributeSet: attrs
        )
    }
}
