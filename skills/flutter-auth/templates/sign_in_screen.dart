/// Sign-in screen: KSignIn with the platform adapters this app ships.
library;

import 'dart:io' show Platform;

import 'package:flutter/cupertino.dart';
import 'package:kashi_auth/kashi_auth.dart';
import 'package:kashi_ui/kashi_ui.dart';

import '../adapters/apple.dart';
import '../adapters/google.dart';
import '../adapters/passkeys.dart';

class SignInScreen extends StatelessWidget {
  const SignInScreen({super.key});

  @override
  Widget build(BuildContext context) => CupertinoPageScaffold(
    child: SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(KSpace.s6),
        child: KSignIn(
          google: googleIdToken,
          apple: Platform.isIOS ? appleIdToken : null,
          passkeys: PluginPasskeyBridge(),
        ),
      ),
    ),
  );
}
