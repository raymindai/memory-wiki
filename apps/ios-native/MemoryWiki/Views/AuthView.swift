// AuthView — four-provider sign-in matching Apple HIG + the
// project's design tokens.
//
// Order (top → bottom): Apple, Google, GitHub, Email. Apple is
// required by App Store guideline 4.8 when offering 3rd-party
// SSO; placing it at the top is also the most common convention
// in shipping apps.
//
// Buttons render the REAL provider marks (Google's multi-colour
// G, GitHub's Octocat) from the asset catalog, not SF Symbols.
// The Apple button is Apple's system `SignInWithAppleButton` so
// it auto-tracks Apple's branding requirements.

import SwiftUI
import AuthenticationServices
import CryptoKit

struct AuthView: View {
    @EnvironmentObject private var auth: AuthManager
    @State private var error: String?
    @State private var emailSheet = false
    @State private var working = false
    @State private var appleNonce: String?

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Hero lockup — canonical inline mark + wordmark
                // (no separate blob; the lockup already includes it).
                VStack(spacing: 18) {
                    MemoryWikiLogo(size: 32)
                    Text("Stop re-explaining your context\nto every AI.")
                        .font(Brand.body(size: 15))
                        .foregroundStyle(Brand.textMuted)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer()

                providerStack
                    .padding(.horizontal, 24)
                    .disabled(working)
                    .opacity(working ? 0.5 : 1)

                if let error {
                    Text(error)
                        .font(Brand.body(size: 11))
                        .foregroundStyle(Brand.microRed)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 28)
                        .padding(.top, 12)
                }

                terms
                    .padding(.top, 18)
                    .padding(.bottom, 28)
            }
        }
        .sheet(isPresented: $emailSheet) {
            EmailAuthSheet(onComplete: { error in self.error = error })
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
                .preferredColorScheme(.dark)
        }
    }

    // MARK: - Provider stack

    private var providerStack: some View {
        VStack(spacing: 10) {
            // Apple — system component, automatically branded
            // correctly. The system button renders its own glyph
            // and label; we control corner radius + height only.
            SignInWithAppleButton(.continue) { request in
                let nonce = randomNonce()
                appleNonce = nonce
                request.requestedScopes = [.fullName, .email]
                request.nonce = sha256(nonce)
            } onCompletion: { result in
                Task { await handleApple(result: result) }
            }
            .signInWithAppleButtonStyle(.white)
            .frame(height: 50)
            .cornerRadius(10)

            ProviderButton(
                label: "Continue with Google",
                logo: { GoogleMark().frame(width: 18, height: 18) },
                style: .neutral
            ) {
                Task { await launch { try await auth.signInWithOAuth(provider: .google) } }
            }

            ProviderButton(
                label: "Continue with GitHub",
                logo: { Image("github").renderingMode(.template).resizable().frame(width: 18, height: 18) },
                style: .neutral
            ) {
                Task { await launch { try await auth.signInWithOAuth(provider: .github) } }
            }

            ProviderButton(
                label: "Continue with email",
                logo: { Image(systemName: "envelope").font(.system(size: 14, weight: .regular)).frame(width: 18, height: 18) },
                style: .neutral
            ) {
                emailSheet = true
            }
        }
    }

    private var terms: some View {
        HStack(spacing: 4) {
            Text("By continuing you agree to our")
                .foregroundStyle(Brand.textFaint)
            Link("terms", destination: URL(string: "https://memory.wiki/terms")!)
                .foregroundStyle(Brand.textMuted)
            Text("&")
                .foregroundStyle(Brand.textFaint)
            Link("privacy", destination: URL(string: "https://memory.wiki/privacy")!)
                .foregroundStyle(Brand.textMuted)
        }
        .font(Brand.body(size: 11))
    }

    // MARK: - Actions

    private func launch(_ action: @escaping () async throws -> Void) async {
        working = true
        defer { working = false }
        do {
            try await action()
            error = nil
        } catch is CancellationError {
            // user backed out, no banner
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func handleApple(result: Result<ASAuthorization, Error>) async {
        switch result {
        case .failure(let err):
            if (err as? ASAuthorizationError)?.code == .canceled { return }
            self.error = err.localizedDescription
        case .success(let auth):
            guard let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8),
                  let nonce = appleNonce else {
                self.error = "Apple sign-in returned no identity token."
                return
            }
            await launch { try await self.auth.signInWithApple(idToken: idToken, nonce: nonce) }
        }
    }

    // MARK: - Nonce helpers (Apple's docs recommend pairing a
    //         random nonce with its SHA-256 to defend against
    //         replay attacks on the identity token).

    private func randomNonce(length: Int = 32) -> String {
        let charset: [Character] = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length
        while remaining > 0 {
            var random: UInt8 = 0
            _ = SecRandomCopyBytes(kSecRandomDefault, 1, &random)
            if random < charset.count {
                result.append(charset[Int(random)])
                remaining -= 1
            }
        }
        return result
    }

    private func sha256(_ input: String) -> String {
        let data = Data(input.utf8)
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - Provider button

private struct ProviderButton<Logo: View>: View {
    enum Style { case neutral, prominent }
    let label: String
    @ViewBuilder var logo: () -> Logo
    var style: Style
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                logo()
                Text(label)
                    .font(Brand.body(size: 15, weight: .medium))
                Spacer()
            }
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, minHeight: 50)
            .foregroundStyle(style == .prominent ? Brand.background : Brand.textPrimary)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(style == .prominent ? Brand.textPrimary : Brand.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(style == .prominent ? .clear : Brand.borderDim, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Google G mark, drawn natively so we never get a stretched
// raster fallback. Same colour set as Google's published brand.

private struct GoogleMark: View {
    var body: some View {
        Image("google")
            .resizable()
            .renderingMode(.original)
            .aspectRatio(contentMode: .fit)
    }
}

#Preview {
    AuthView().environmentObject(AuthManager.preview())
}
