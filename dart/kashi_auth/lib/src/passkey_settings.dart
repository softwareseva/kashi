/// "Passkeys" settings section: add a passkey for this device, rename or remove existing ones.
library;

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kashi_core/kashi_core.dart';
import 'package:kashi_ui/kashi_ui.dart';

import 'adapters.dart';
import 'api.dart';

final passkeysProvider = FutureProvider.autoDispose<List<PasskeyItem>>(
  (ref) => ref.watch(kashiAuthApiProvider).passkeys(),
);

class KPasskeySettings extends ConsumerStatefulWidget {
  const KPasskeySettings({
    super.key,
    required this.bridge,
    this.deviceName = 'This device',
  });
  final PasskeyBridge bridge;
  final String deviceName;

  @override
  ConsumerState<KPasskeySettings> createState() => _KPasskeySettingsState();
}

class _KPasskeySettingsState extends ConsumerState<KPasskeySettings> {
  bool _busy = false;
  String? _error;

  Future<void> _add() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final api = ref.read(kashiAuthApiProvider);
    try {
      final start = await api.passkeyRegisterOptions();
      final response = await widget.bridge.register(start.options);
      await api.passkeyRegisterVerify(
        start.challengeId,
        response,
        widget.deviceName,
      );
      ref.invalidate(passkeysProvider);
    } on SignInCancelled {
      // dismissed
    } on KashiFailure catch (f) {
      setState(() => _error = f.message);
    } catch (_) {
      setState(() => _error = 'The passkey could not be created.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = KColors.of(context);
    final items = ref.watch(passkeysProvider);
    return KCard(
      title: 'Passkeys',
      description: 'Sign in with Face ID, fingerprint or your device PIN instead of a code.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) ...[
            KAlert(variant: KAlertVariant.danger, title: _error!),
            const SizedBox(height: KSpace.s2),
          ],
          items.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(KSpace.s4),
              child: CupertinoActivityIndicator(),
            ),
            error: (e, _) => Text(
              'Could not load passkeys.',
              style: KText.bodySm.copyWith(color: c.danger),
            ),
            data: (list) => Column(
              children: [
                for (final p in list)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: KSpace.s2),
                    child: Row(
                      children: [
                        Icon(
                          CupertinoIcons.person_crop_circle_badge_checkmark,
                          color: c.inkMuted,
                        ),
                        const SizedBox(width: KSpace.s2),
                        Expanded(
                          child: Text(
                            p.deviceName,
                            style: KText.body.copyWith(color: c.ink),
                          ),
                        ),
                        KIconButton(
                          icon: KIcons.delete,
                          label: 'Remove ${p.deviceName}',
                          onPressed: () async {
                            await ref
                                .read(kashiAuthApiProvider)
                                .removePasskey(p.id);
                            ref.invalidate(passkeysProvider);
                          },
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: KSpace.s2),
          KButton(
            label: 'Add a passkey',
            icon: KIcons.add,
            variant: KButtonVariant.secondary,
            loading: _busy,
            onPressed: _add,
          ),
        ],
      ),
    );
  }
}
