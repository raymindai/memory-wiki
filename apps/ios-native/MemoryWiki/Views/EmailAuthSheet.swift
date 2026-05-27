// EmailAuthSheet — modal form for email + password sign-in and
// sign-up. Two TextField rows, a primary CTA, a quiet toggle
// between modes. Matches the rest of the brand: dark zinc, Cal
// Sans heading, Noto Sans body, mono caption.

import SwiftUI

struct EmailAuthSheet: View {
    enum Mode { case signIn, signUp }

    @EnvironmentObject private var auth: AuthManager
    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var working = false
    @State private var localError: String?

    @FocusState private var focused: Field?
    private enum Field { case email, password }

    let onComplete: (String?) -> Void

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()

            VStack(spacing: 0) {
                header

                VStack(spacing: 12) {
                    field("Email", text: $email, focus: .email, content: .emailAddress, keyboard: .emailAddress)
                    field("Password", text: $password, focus: .password, content: .password, keyboard: .default, secure: true)
                }
                .padding(.horizontal, 20)
                .padding(.top, 22)

                if let localError {
                    Text(localError)
                        .font(Brand.body(size: 12))
                        .foregroundStyle(Brand.microRed)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 22)
                        .padding(.top, 10)
                }

                Button(action: submit) {
                    Text(working ? "Working…" : (mode == .signIn ? "Sign in" : "Create account"))
                        .font(Brand.body(size: 15, weight: .medium))
                        .foregroundStyle(Brand.background)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(canSubmit ? Brand.textPrimary : Brand.surface)
                        )
                        .foregroundStyle(canSubmit ? Brand.background : Brand.textFaint)
                }
                .buttonStyle(.plain)
                .disabled(!canSubmit)
                .padding(.horizontal, 20)
                .padding(.top, 18)

                Button {
                    mode = (mode == .signIn ? .signUp : .signIn)
                    localError = nil
                } label: {
                    HStack(spacing: 6) {
                        Text(mode == .signIn ? "No account?" : "Already have an account?")
                            .foregroundStyle(Brand.textFaint)
                        Text(mode == .signIn ? "Create one." : "Sign in.")
                            .foregroundStyle(Brand.textPrimary)
                    }
                    .font(Brand.body(size: 12))
                }
                .buttonStyle(.plain)
                .padding(.top, 18)

                Spacer()
            }
        }
        .onAppear { focused = .email }
    }

    private var header: some View {
        HStack {
            Text(mode == .signIn ? "Sign in" : "Create account")
                .font(Brand.display(size: 22))
                .foregroundStyle(Brand.textPrimary)
            Spacer()
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Brand.textFaint)
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .padding(.top, 22)
    }

    @ViewBuilder
    private func field(_ label: String, text: Binding<String>, focus: Field, content: UITextContentType, keyboard: UIKeyboardType, secure: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(Brand.mono(size: 9, weight: .medium))
                .tracking(1)
                .textCase(.uppercase)
                .foregroundStyle(Brand.textFaint)

            Group {
                if secure {
                    SecureField("", text: text)
                } else {
                    TextField("", text: text)
                        .keyboardType(keyboard)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                }
            }
            .textContentType(content)
            .focused($focused, equals: focus)
            .font(Brand.body(size: 15))
            .foregroundStyle(Brand.textPrimary)
            .tint(Brand.textPrimary)
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Brand.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .strokeBorder(focused == focus ? Brand.border : Brand.borderDim, lineWidth: 1)
                    )
            )
        }
    }

    private var canSubmit: Bool {
        !working
        && email.contains("@")
        && password.count >= 6
    }

    private func submit() {
        guard canSubmit else { return }
        working = true
        localError = nil
        Task {
            defer { working = false }
            do {
                switch mode {
                case .signIn: try await auth.signInWithEmail(email: email, password: password)
                case .signUp: try await auth.signUpWithEmail(email: email, password: password)
                }
                onComplete(nil)
                dismiss()
            } catch {
                localError = error.localizedDescription
            }
        }
    }
}

#Preview {
    EmailAuthSheet(onComplete: { _ in })
        .environmentObject(AuthManager.preview())
}
