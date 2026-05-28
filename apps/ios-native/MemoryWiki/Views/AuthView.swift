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
    @State private var appleCoordinator: AppleSignInCoordinator?
    /// Drives the staggered fade-up on first paint. Flipped to
    /// true in onAppear so all the .animation modifiers below
    /// have a value to interpolate against.
    @State private var appeared = false

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
                        .opacity(working ? 0.5 : (appeared ? 1 : 0))
                        .offset(y: appeared ? 0 : 14)
                        .animation(.easeOut(duration: 0.6).delay(0.45), value: appeared)
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
                        .opacity(appeared ? 1 : 0)
                        .animation(.easeOut(duration: 0.5).delay(0.7), value: appeared)
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
            }
        }
        .onAppear {
            // Tiny delay so the first frame paints the backdrop +
            // canvas before the stagger kicks in — without it, the
            // hero looks like it's mid-animation on the very first
            // frame (jarring).
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.04) {
                appeared = true
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
        // Each layer fades + lifts in on its own delay so the
        // surface feels like it's settling, not snapping.
        VStack(spacing: 8) {
            AnimatedBlob(size: 168, theme: .dark)
                .opacity(appeared ? 1 : 0)
                .scaleEffect(appeared ? 1 : 0.92)
                .animation(.spring(response: 0.9, dampingFraction: 0.85).delay(0.0), value: appeared)

            VStack(spacing: 10) {
                Text("memory.wiki")
                    .font(Brand.display(size: 36))
                    .foregroundStyle(Brand.textPrimary)
                    .tracking(0)
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 10)
                    .animation(.easeOut(duration: 0.6).delay(0.18), value: appeared)

                Text("Your knowledge hub for the AI age.")
                    .font(Brand.body(size: 15))
                    .foregroundStyle(Brand.textMuted)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
                    .padding(.horizontal, 36)
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 10)
                    .animation(.easeOut(duration: 0.6).delay(0.28), value: appeared)

                CompanionChip()
                    .padding(.top, 6)
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 8)
                    .animation(.easeOut(duration: 0.55).delay(0.38), value: appeared)
            }
        }
    }

    // MARK: - Provider stack

    private var providerStack: some View {
        // Order: Google → GitHub → Email → Apple. App Store
        // guideline 4.8 requires Apple to be offered equally
        // prominent, not first. All four buttons render through
        // ProviderButton so type / fill / corner radius / border
        // match exactly — the previous Apple system button had a
        // larger system label and a pure-#000 background that
        // popped out against the zinc-900 of the others.
        // SF Symbol "applelogo" is Apple's own glyph, so the
        // custom button still complies with HIG.
        VStack(spacing: 10) {
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
            ProviderButton(
                label: "Continue with Apple",
                logo: { Image(systemName: "applelogo").font(.system(size: 16, weight: .regular)).frame(width: 18, height: 18) },
                style: .neutral
            ) {
                startApple()
            }
        }
    }

    /// Manual ASAuthorizationController trigger — replaces the
    /// system SignInWithAppleButton so the button visuals match
    /// the other three providers exactly. Same nonce + token
    /// handling as before.
    private func startApple() {
        let nonce = randomNonce()
        appleNonce = nonce
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)
        let controller = ASAuthorizationController(authorizationRequests: [request])
        let coordinator = AppleSignInCoordinator { result in
            Task { await handleApple(result: result) }
        }
        appleCoordinator = coordinator
        controller.delegate = coordinator
        controller.presentationContextProvider = coordinator
        controller.performRequests()
    }

    // MARK: - Footer (mono version chip + parent-product link + terms)

    private var footer: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
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
        } catch {
            if isCanceledByUser(error) { return }
            self.error = friendly(error)
        }
    }

    private func handleApple(result: Result<ASAuthorization, Error>) async {
        switch result {
        case .failure(let err):
            if isCanceledByUser(err) { return }
            self.error = friendly(err)
        case .success(let auth):
            guard let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8),
                  let nonce = appleNonce else {
                self.error = "Couldn't read Apple ID token. Try again."
                return
            }
            await launch { try await self.auth.signInWithApple(idToken: idToken, nonce: nonce) }
        }
    }

    /// Cancellation arrives as one of four shapes depending on the
    /// underlying flow — Apple cancel button (ASAuthorizationError
    /// .canceled), ASWebAuthenticationSession close button
    /// (.canceledLogin), Swift task cancel, or the SDK wrapping a
    /// CancellationError. Treat all of them as a no-op so the
    /// surface stays quiet when the user just backs out.
    private func isCanceledByUser(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        if let ase = error as? ASAuthorizationError, ase.code == .canceled { return true }
        let nsError = error as NSError
        if nsError.domain == ASWebAuthenticationSessionErrorDomain,
           nsError.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
            return true
        }
        return false
    }

    /// Turn a raw error into a single human sentence. We never
    /// surface error codes / framework names in the user-facing
    /// banner — that copy felt like a stack trace.
    private func friendly(_ error: Error) -> String {
        let raw = error.localizedDescription
        if raw.lowercased().contains("network") { return "Network unavailable. Check your connection and try again." }
        if raw.lowercased().contains("invalid") || raw.lowercased().contains("incorrect") {
            return "Couldn't sign you in. Double-check the credentials and try again."
        }
        return "Sign-in didn't complete. Try again."
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

// MARK: - Apple Sign-In coordinator
//
// ASAuthorizationController needs an NSObject delegate +
// presentation provider. We keep the coordinator alive via the
// owning view's @State to ensure it survives until the system
// callback fires.
private final class AppleSignInCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    let onResult: (Result<ASAuthorization, Error>) -> Void
    init(onResult: @escaping (Result<ASAuthorization, Error>) -> Void) { self.onResult = onResult }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        onResult(.success(authorization))
    }
    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        onResult(.failure(error))
    }
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first ?? ASPresentationAnchor()
    }
}

// MARK: - Companion chip

/// Tiny mono pill that reads "iOS COMPANION" with a warn-color
/// dot, so the user immediately knows this app is the satellite
/// to memory.wiki, not the canonical surface.
private struct CompanionChip: View {
    var body: some View {
        Text("iOS COMPANION")
            .font(Brand.mono(size: 10, weight: .medium))
            .tracking(1.4)
            .foregroundStyle(Brand.textMuted)
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
            let dim = max(proxy.size.width, proxy.size.height) * 0.95
            AnimatedBlob(size: dim, theme: .dark)
                .opacity(0.07)
                .blur(radius: 8)
                .frame(width: proxy.size.width, height: proxy.size.height, alignment: .center)
        }
    }
}

// MARK: - Provider button

private struct ProviderButton<Logo: View>: View {
    enum Style { case neutral, prominent }
    let label: LocalizedStringKey
    @ViewBuilder var logo: () -> Logo
    var style: Style
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                logo()
                Text(label)
                    .font(Brand.body(size: 15, weight: .medium))
            }
            .frame(maxWidth: .infinity, minHeight: 52)
            .foregroundStyle(style == .prominent ? Brand.background : Brand.textPrimary)
            .background {
                if style == .prominent {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Brand.textPrimary)
                } else {
                    // Glass — ultraThin material blurs whatever sits
                    // behind (canvas + ambient blob), tinted with a
                    // sliver of white-on-black for body so the buttons
                    // float instead of staring blank. Highlight rim
                    // catches the eye like a real piece of glass.
                    ZStack {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(.ultraThinMaterial)
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color.white.opacity(0.03))
                    }
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(
                        LinearGradient(
                            colors: style == .prominent
                                ? [Color.clear, Color.clear]
                                : [Color.white.opacity(0.18), Color.white.opacity(0.04)],
                            startPoint: .top, endPoint: .bottom
                        ),
                        lineWidth: 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(GlassButtonStyle())
    }
}

/// Press feedback for the glass providers — subtle scale + brightness
/// dip. No colour change so the brand chrome stays grayscale.
private struct GlassButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .brightness(configuration.isPressed ? -0.04 : 0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

#Preview {
    AuthView().environmentObject(AuthManager.preview())
}
