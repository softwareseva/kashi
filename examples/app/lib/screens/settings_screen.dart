/// Account settings: who is signed in, passkeys, sign out.
library;

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kashi_auth/kashi_auth.dart';
import 'package:kashi_core/kashi_core.dart';
import 'package:kashi_ui/kashi_ui.dart';

import '../adapters/passkeys.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final c = KColors.of(context);
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(middle: Text('Settings')),
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(KSpace.s4),
          children: [
            KCard(
              title: auth.user?.name ?? '',
              description: auth.user?.phone ?? auth.user?.email,
              child: auth.offline
                  ? const KBadge('Offline', variant: KBadgeVariant.neutral)
                  : const SizedBox.shrink(),
            ),
            const SizedBox(height: KSpace.s4),
            KPasskeySettings(bridge: PluginPasskeyBridge()),
            const SizedBox(height: KSpace.s6),
            KButton(
              label: 'Sign out',
              variant: KButtonVariant.destructive,
              expand: true,
              onPressed: () =>
                  ref.read(authControllerProvider.notifier).signOut(),
            ),
            const SizedBox(height: KSpace.s2),
            Text(
              'Signed in with @softwareseva/auth',
              style: KText.bodySm.copyWith(color: c.inkMuted),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
