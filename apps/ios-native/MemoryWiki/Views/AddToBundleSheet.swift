// AddToBundleSheet — modal that lets the user add the current
// doc to any existing bundle, OR create a new bundle on the fly
// with this doc as its first member. Closes the ORGANIZE loop
// inside iOS (was previously web-only).
//
// API contract:
//   - GET /api/bundles            → user's bundles list
//   - POST /api/bundles           → create with documentIds: [docId]
//   - PATCH /api/bundles/<id>     action: add-documents

import SwiftUI

struct AddToBundleSheet: View {
    let docId: String
    var onDone: () -> Void

    @State private var bundles: [AppBundle] = []
    @State private var loading = true
    @State private var working = false
    @State private var errorMessage: String?
    @State private var addedToBundle: String?
    @State private var creating = false
    @State private var newBundleTitle = ""
    @FocusState private var newTitleFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.background.ignoresSafeArea()
                if loading {
                    BrandLoader(variant: .inline)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            createNewSection
                            existingSection
                            if let errorMessage {
                                Text(errorMessage)
                                    .font(Brand.body(size: 12))
                                    .foregroundStyle(Brand.microRed)
                                    .padding(.horizontal, 4)
                            }
                        }
                        .padding(.horizontal, 18)
                        .padding(.top, 14)
                        .padding(.bottom, 32)
                    }
                }
            }
            .navigationTitle("Add to bundle")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { onDone() }
                        .foregroundStyle(Brand.textMuted)
                }
            }
            .toolbarBackground(Brand.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .task { await load() }
    }

    // MARK: - Sections

    @ViewBuilder
    private var createNewSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("NEW BUNDLE")
            if creating {
                HStack(spacing: 8) {
                    Image(systemName: "plus.square.on.square")
                        .font(.system(size: 13))
                        .foregroundStyle(Brand.textFaint)
                    TextField("Bundle title", text: $newBundleTitle)
                        .focused($newTitleFocused)
                        .font(Brand.body(size: 14))
                        .foregroundStyle(Brand.textPrimary)
                        .tint(Brand.textPrimary)
                        .submitLabel(.done)
                        .onSubmit { Task { await create() } }
                    Button {
                        Task { await create() }
                    } label: {
                        Text("Create")
                            .font(Brand.body(size: 12, weight: .medium))
                            .foregroundStyle(canCreate ? Brand.background : Brand.textFaint)
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .background(Capsule().fill(canCreate ? Brand.textPrimary : Brand.surface))
                    }
                    .buttonStyle(.plain)
                    .disabled(!canCreate)
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Brand.surface)
                        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                )
            } else {
                Button {
                    Haptics.tap()
                    creating = true
                    newTitleFocused = true
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "plus")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Brand.textPrimary)
                            .frame(width: 24)
                        Text("Create new bundle")
                            .font(Brand.body(size: 14, weight: .medium))
                            .foregroundStyle(Brand.textPrimary)
                        Spacer()
                    }
                    .padding(.horizontal, 12).padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(Brand.surface)
                            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var existingSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("YOUR BUNDLES")
            if bundles.isEmpty {
                Text("No bundles yet — create one above.")
                    .font(Brand.body(size: 12))
                    .foregroundStyle(Brand.textFaint)
                    .padding(.top, 4)
            } else {
                VStack(spacing: 6) {
                    ForEach(bundles) { bundle in
                        bundleRow(bundle)
                    }
                }
            }
        }
        .padding(.top, 8)
    }

    private func bundleRow(_ bundle: AppBundle) -> some View {
        let isAdded = addedToBundle == bundle.id
        return Button {
            Task { await add(to: bundle.id) }
        } label: {
            HStack(spacing: 12) {
                BundleLayersIcon(
                    size: 18,
                    color: bundle.isDraft == false
                        ? (bundle.isRestricted ? Brand.microInfo : Brand.microLime)
                        : Brand.textFaint
                )
                .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(bundle.displayTitle)
                        .font(Brand.body(size: 14, weight: .medium))
                        .foregroundStyle(Brand.textPrimary)
                        .lineLimit(1)
                    if let n = bundle.documentCount {
                        Text("\(n) memor\(n == 1 ? "y" : "ies")")
                            .font(Brand.mono(size: 9, weight: .medium))
                            .tracking(0.5)
                            .foregroundStyle(Brand.textFaint)
                    }
                }
                Spacer(minLength: 8)
                if isAdded {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(Brand.microLime)
                } else if working {
                    ProgressView().scaleEffect(0.6).tint(Brand.textFaint)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Brand.surface)
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
            )
        }
        .buttonStyle(.plain)
        .disabled(working || isAdded)
    }

    private func sectionLabel(_ text: LocalizedStringKey) -> some View {
        Text(text)
            .font(Brand.mono(size: 9, weight: .medium))
            .tracking(1.2)
            .foregroundStyle(Brand.textFaint)
    }

    // MARK: - Actions

    private var canCreate: Bool {
        !working && !newBundleTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            bundles = try await APIClient.shared.userBundles()
                .sorted { $0.sortDate > $1.sortDate }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func add(to bundleId: String) async {
        working = true
        errorMessage = nil
        defer { working = false }
        do {
            try await APIClient.shared.addDocumentsToBundle(bundleId: bundleId, documentIds: [docId])
            addedToBundle = bundleId
            Haptics.success()
            // Auto-dismiss after the success check shows briefly.
            try? await Task.sleep(nanoseconds: 700_000_000)
            onDone()
        } catch {
            errorMessage = error.localizedDescription
            Haptics.warning()
        }
    }

    private func create() async {
        let title = newBundleTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        working = true
        errorMessage = nil
        defer { working = false }
        do {
            let id = try await APIClient.shared.createBundle(title: title, documentIds: [docId])
            addedToBundle = id
            Haptics.success()
            try? await Task.sleep(nanoseconds: 700_000_000)
            onDone()
        } catch {
            errorMessage = error.localizedDescription
            Haptics.warning()
        }
    }
}
