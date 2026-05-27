// AuthView — iOS COMPANION sign-in surface.
//
// Positioning the user nailed me on: this is NOT the memory.wiki
// flagship. The web is the canonical product; iOS is the
// companion that lets you capture from your phone and reach
// your hub anywhere. So:
//   - tagline = "Your knowledge hub for the AI age" (companion
//     framing), NOT the web's H1 "Stop re-explaining…"
//   - hero is stacked: BIG animated blob centred, wordmark
//     beneath in Cal Sans, then a mono "iOS COMPANION" micro-
//     caption with a tiny info-color dot
//   - ambient faint giant blob bleeds off-screen behind
//     everything so the canvas has texture instead of pure black
//   - JetBrains Mono actually showing up for micro-labels +
//     version chip + "memory.wiki ↗" parent-product link
//   - micro-color tokens (info / warn) earn their keep on the
//     companion chip + footer line
//
// Apple required by App Store guideline 4.8 (when offering any
// social SSO, Sign in with Apple is mandatory). Apple goes
// first in the stack; Google / GitHub / Email follow.

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

            // Ambient backdrop — same morph blob, scaled huge,
            // faded to a whisper. Bleeds off screen so it feels
            // like the canvas itself is breathing.
            BrandBackdrop()
                .ignoresSafeArea()
                .accessibilityHidden(true)

            GeometryReader { proxy in
                VStack(spacing: 0) {
                    Spacer(minLength: 24)
                    hero
                    Spacer()
                    providerStack
                        .padding(.horizontal, 22)
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
                    footer
                        .padding(.top, 18)
                        .padding(.bottom, 24)
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
            }
        }
        .sheet(isPresented: $emailSheet) {
            EmailAuthSheet(onComplete: { error in self.error = error })
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
                .preferredColorScheme(.dark)
        }
    }

    // MARK: - Hero (stacked: blob → wordmark → companion chip → tagline)

    private var hero: some View {
        VStack(spacing: 22) {
            AnimatedBlob(size: 132, theme: .dark)

            VStack(spacing: 14) {
                Text("memory.wiki")
                    .font(Brand.display(size: 36))
                    .foregroundStyle(Brand.textPrimary)
                    .tracking(0)

                CompanionChip()

                Text("Your knowledge hub for the AI age.")
                    .font(Brand.body(size: 15))
                    .foregroundStyle(Brand.textMuted)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
                    .padding(.horizontal, 36)
                    .padding(.top, 4)
            }
        }
    }

    // MARK: - Provider stack

    private var providerStack: some View {
        VStack(spacing: 10) {
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
                logo: { Image("google").resizable().renderingMode(.original).aspectRatio(contentMode: .fit).frame(width: 18, height: 18) },
                style: .neutral
            ) {
                Task { await launch { try await auth.signInWithOAuth(provider: .google) } }
            }
            ProviderButton(
                label: "Continue with GitHub",
                logo: { Image("github").renderingMode(.template).resizable().frame(width: 18, height: 18).foregroundStyle(Brand.textPrimary) },
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

    // MARK: - Footer (mono version chip + parent-product link + terms)

    private var footer: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                // Micro-info dot
                Circle().fill(Brand.microInfo).frame(width: 5, height: 5)
                Text("iOS \(appVersion)")
                    .font(Brand.mono(size: 9, weight: .medium))
                    .tracking(0.6)
                    .foregroundStyle(Brand.textMuted)
                Text("·")
                    .font(Brand.mono(size: 9))
                    .foregroundStyle(Brand.textFaint)
                Link(destination: URL(string: "https://memory.wiki")!) {
                    HStack(spacing: 3) {
                        Text("memory.wiki")
                            .font(Brand.mono(size: 9, weight: .medium))
                            .tracking(0.6)
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 8, weight: .semibold))
                    }
                    .foregroundStyle(Brand.textMuted)
                }
            }

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
    }

    private var appVersion: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1.0"
        return "v\(v)"
    }

    // MARK: - Actions

    private func launch(_ action: @escaping () async throws -> Void) async {
        working = true
        defer { working = false }
        do {
            try await action()
            error = nil
        } catch is CancellationError {
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

// MARK: - Companion chip

/// Tiny mono pill that reads "iOS COMPANION" with a warn-color
/// dot, so the user immediately knows this app is the satellite
/// to memory.wiki, not the canonical surface.
private struct CompanionChip: View {
    var body: some View {
        HStack(spacing: 7) {
            Circle().fill(Brand.microWarn).frame(width: 5, height: 5)
            Text("iOS COMPANION")
                .font(Brand.mono(size: 10, weight: .medium))
                .tracking(1.4)
                .foregroundStyle(Brand.textMuted)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 6)
        .background(
            Capsule(style: .continuous)
                .fill(Brand.surface)
                .overlay(
                    Capsule(style: .continuous)
                        .strokeBorder(Brand.borderDim, lineWidth: 1)
                )
        )
    }
}

// MARK: - Backdrop

/// Ambient brand blob — same SVG as the hero mark, scaled huge,
/// pinned bottom-right so a slice bleeds off screen. Opacity is
/// low enough to read as "texture" rather than "image." Hidden
/// from accessibility.
private struct BrandBackdrop: View {
    var body: some View {
        GeometryReader { proxy in
            // Same morph artwork, scaled large enough to bleed
            // past the safe area, anchored slightly above centre
            // so the densest part of the blob sits behind the
            // hero. Opacity tuned to read as a watermark — barely
            // there but unmistakably the brand mark, not a smudge.
            let dim = max(proxy.size.width, proxy.size.height) * 1.15
            AnimatedBlob(size: dim, theme: .dark)
                .opacity(0.14)
                .blur(radius: 6)
                .frame(width: proxy.size.width, height: proxy.size.height, alignment: .center)
        }
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

#Preview {
    AuthView().environmentObject(AuthManager.preview())
}
