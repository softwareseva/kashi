/// Locks the app behind Face ID / fingerprint after it has been in the background for a while.
library;

import 'package:flutter/cupertino.dart';
import 'package:kashi_ui/kashi_ui.dart';

/// Wrap the signed-in part of the app. [authenticate] is the app's `local_auth` call (see the
/// flutter-auth skill); return true when the user passed. [enabled] lets users switch it off.
class KBiometricGate extends StatefulWidget {
  const KBiometricGate({
    super.key,
    required this.child,
    required this.authenticate,
    this.enabled = true,
    this.lockAfter = const Duration(minutes: 5),
    this.reason = 'Unlock to continue',
  });

  final Widget child;
  final Future<bool> Function(String reason) authenticate;
  final bool enabled;
  final Duration lockAfter;
  final String reason;

  @override
  State<KBiometricGate> createState() => _KBiometricGateState();
}

class _KBiometricGateState extends State<KBiometricGate>
    with WidgetsBindingObserver {
  bool _locked = false;
  DateTime? _pausedAt;
  bool _prompting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _locked = widget.enabled;
    if (_locked) WidgetsBinding.instance.addPostFrameCallback((_) => _unlock());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!widget.enabled) return;
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      _pausedAt ??= DateTime.now();
    }
    if (state == AppLifecycleState.resumed) {
      final away = _pausedAt == null
          ? Duration.zero
          : DateTime.now().difference(_pausedAt!);
      _pausedAt = null;
      if (away >= widget.lockAfter) {
        setState(() => _locked = true);
        _unlock();
      }
    }
  }

  Future<void> _unlock() async {
    if (_prompting) return;
    _prompting = true;
    try {
      final ok = await widget.authenticate(widget.reason);
      if (ok && mounted) setState(() => _locked = false);
    } finally {
      _prompting = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_locked) return widget.child;
    final c = KColors.of(context);
    return ColoredBox(
      color: c.surface,
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(KSpace.s6),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(CupertinoIcons.lock, size: 48, color: c.inkMuted),
                const SizedBox(height: KSpace.s4),
                Text('Locked', style: KText.heading.copyWith(color: c.ink)),
                const SizedBox(height: KSpace.s6),
                KButton(label: 'Unlock', onPressed: _unlock),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
