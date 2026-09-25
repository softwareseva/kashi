/// Cupertino sign-in screen body: shows every provider the server enables and the app supplies an adapter for.
library;

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kashi_core/kashi_core.dart';
import 'package:kashi_ui/kashi_ui.dart';

import 'adapters.dart';
import 'api.dart';

const _messages = {
  'INVALID_CODE': 'That code is invalid or has expired. Request a new one.',
  'INVALID_CREDENTIALS': 'That identifier or password is incorrect.',
  'RATE_LIMITED': 'Too many attempts. Please wait a few minutes.',
  'ACCOUNT_DISABLED': 'This account is disabled.',
  'SIGN_UP_DISABLED': 'No account exists for this sign-in.',
  'PASSKEY_REJECTED': 'The passkey could not be verified.',
  'OAUTH_FAILED': 'Sign-in did not complete. Please try again.',
  'NETWORK': 'Could not reach the server. Check your connection.',
};
String authMessage(KashiFailure f) => _messages[f.code] ?? f.message;

class KSignIn extends ConsumerStatefulWidget {
  const KSignIn({
    super.key,
    this.google,
    this.apple,
    this.passkeys,
    this.title = 'Sign in',
    this.askNameOnSignUp = true,
  });

  /// Adapter for Google; hidden when null or disabled on the server.
  final IdTokenSignIn? google;

  /// Adapter for Sign in with Apple; hidden when null or disabled on the server.
  final IdTokenSignIn? apple;
  final PasskeyBridge? passkeys;
  final String title;

  /// Shows an optional name field on the code step (used only when the account is new).
  final bool askNameOnSignUp;

  @override
  ConsumerState<KSignIn> createState() => _KSignInState();
}

enum _Step { destination, code, password }

class _KSignInState extends ConsumerState<KSignIn> {
  final _destination = TextEditingController();
  final _code = TextEditingController();
  final _name = TextEditingController();
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  _Step _step = _Step.destination;
  bool _busy = false;
  KashiFailure? _failure;

  @override
  void dispose() {
    for (final c in [_destination, _code, _name, _identifier, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  KashiAuthApi get _api => ref.read(kashiAuthApiProvider);
  AuthController get _auth => ref.read(authControllerProvider.notifier);

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _failure = null;
    });
    try {
      await action();
    } on SignInCancelled {
      // user dismissed the sheet
    } on KashiFailure catch (f) {
      if (mounted) setState(() => _failure = f);
    } catch (_) {
      if (mounted) {
        setState(
          () => _failure = const UnexpectedFailure(
            'Sign-in did not complete. Please try again.',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _session(Future<Map<String, dynamic>> Function() call) async {
    final failure = await _auth.signInWith(call);
    if (failure != null) throw failure;
  }

  Future<void> _sendCode() => _run(() async {
    await _api.requestOtp(_destination.text);
    setState(() => _step = _Step.code);
  });

  Future<void> _verifyCode() => _run(
    () => _session(
      () => _api.verifyOtp(
        _destination.text,
        _code.text.trim(),
        name: _name.text.trim(),
      ),
    ),
  );
  Future<void> _signInPassword() => _run(
    () => _session(() => _api.passwordSignIn(_identifier.text, _password.text)),
  );

  Future<void> _idToken(
    IdTokenSignIn adapter,
    Future<Map<String, dynamic>> Function(IdTokenResult) exchange,
  ) => _run(() async {
    final result = await adapter();
    if (result == null) return;
    await _session(() => exchange(result));
  });

  Future<void> _passkey(PasskeyBridge bridge) => _run(() async {
    final start = await _api.passkeyOptions();
    final response = await bridge.authenticate(start.options);
    await _session(() => _api.passkeyVerify(start.challengeId, response));
  });

  @override
  Widget build(BuildContext context) {
    final providers = ref.watch(authProvidersProvider);
    final c = KColors.of(context);
    return providers.when(
      loading: () => const Center(child: CupertinoActivityIndicator()),
      error: (e, _) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          KAlert(
            variant: KAlertVariant.danger,
            title: e is KashiFailure
                ? authMessage(e)
                : 'Could not load sign-in options.',
          ),
          const SizedBox(height: KSpace.s4),
          KButton(
            label: 'Try again',
            variant: KButtonVariant.outline,
            onPressed: () => ref.invalidate(authProvidersProvider),
          ),
        ],
      ),
      data: (p) {
        final phone = p.otpChannel == 'phone';
        final children = <Widget>[
          Text(widget.title, style: KText.title.copyWith(color: c.ink)),
          const SizedBox(height: KSpace.s6),
          if (_failure != null) ...[
            KAlert(
              variant: KAlertVariant.danger,
              title: authMessage(_failure!),
            ),
            const SizedBox(height: KSpace.s4),
          ],
          if (p.passkeys && widget.passkeys != null) ...[
            KButton(
              label: 'Sign in with a passkey',
              icon: CupertinoIcons.person_crop_circle_badge_checkmark,
              variant: KButtonVariant.outline,
              expand: true,
              onPressed: _busy ? null : () => _passkey(widget.passkeys!),
            ),
            const SizedBox(height: KSpace.s2),
          ],
          if (p.apple && widget.apple != null) ...[
            KButton(
              label: 'Continue with Apple',
              variant: KButtonVariant.outline,
              expand: true,
              onPressed: _busy
                  ? null
                  : () => _idToken(
                      widget.apple!,
                      (r) => _api.apple(r.idToken, name: r.name),
                    ),
            ),
            const SizedBox(height: KSpace.s2),
          ],
          if (p.google && widget.google != null) ...[
            KButton(
              label: 'Continue with Google',
              variant: KButtonVariant.outline,
              expand: true,
              onPressed: _busy
                  ? null
                  : () =>
                        _idToken(widget.google!, (r) => _api.google(r.idToken)),
            ),
            const SizedBox(height: KSpace.s2),
          ],
          const SizedBox(height: KSpace.s4),
          if (_step == _Step.destination && p.otpChannel != null) ...[
            KTextField(
              label: phone ? 'Phone number' : 'Email',
              controller: _destination,
              keyboardType: phone
                  ? TextInputType.phone
                  : TextInputType.emailAddress,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _sendCode(),
              hint: phone
                  ? 'We will send a one-time code on WhatsApp or SMS.'
                  : 'We will email you a one-time code.',
            ),
            const SizedBox(height: KSpace.s4),
            KButton(
              label: 'Send code',
              expand: true,
              loading: _busy,
              onPressed: _sendCode,
            ),
          ],
          if (_step == _Step.code) ...[
            Text(
              'Enter the code sent to ${_destination.text}.',
              style: KText.bodySm.copyWith(color: c.inkMuted),
            ),
            const SizedBox(height: KSpace.s4),
            KTextField(
              label: 'Code',
              controller: _code,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _verifyCode(),
              errorText: _failure is ApiFailure
                  ? (_failure! as ApiFailure).field('code')
                  : null,
            ),
            if (widget.askNameOnSignUp) ...[
              const SizedBox(height: KSpace.s4),
              KTextField(
                label: 'Your name',
                controller: _name,
                hint: 'Only needed the first time you sign in.',
              ),
            ],
            const SizedBox(height: KSpace.s4),
            KButton(
              label: 'Verify',
              expand: true,
              loading: _busy,
              onPressed: _verifyCode,
            ),
            KButton(
              label: phone ? 'Use a different number' : 'Use a different email',
              variant: KButtonVariant.ghost,
              expand: true,
              onPressed: () => setState(() {
                _step = _Step.destination;
                _code.clear();
                _failure = null;
              }),
            ),
          ],
          if (_step == _Step.password ||
              (p.otpChannel == null && p.password)) ...[
            KTextField(
              label: 'Email or phone',
              controller: _identifier,
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: KSpace.s4),
            KTextField(
              label: 'Password',
              controller: _password,
              obscureText: true,
              onSubmitted: (_) => _signInPassword(),
            ),
            const SizedBox(height: KSpace.s4),
            KButton(
              label: 'Sign in',
              expand: true,
              loading: _busy,
              onPressed: _signInPassword,
            ),
          ],
          if (p.password && p.otpChannel != null)
            KButton(
              label: _step == _Step.password
                  ? 'Use a one-time code instead'
                  : 'Use a password instead',
              variant: KButtonVariant.ghost,
              expand: true,
              onPressed: () => setState(() {
                _step = _step == _Step.password
                    ? _Step.destination
                    : _Step.password;
                _failure = null;
              }),
            ),
        ];
        return AutofillGroup(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: children,
          ),
        );
      },
    );
  }
}
