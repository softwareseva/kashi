/// Biometric unlock with local_auth 3. iOS needs NSFaceIDUsageDescription in Info.plist;
/// Android needs FlutterFragmentActivity and USE_BIOMETRIC.
library;

import 'package:local_auth/local_auth.dart';

final _auth = LocalAuthentication();

Future<bool> biometricUnlock(String reason) async {
  if (!await _auth.isDeviceSupported()) {
    return true; // nothing to lock with; do not trap the user
  }
  try {
    return await _auth.authenticate(
      localizedReason: reason,
      persistAcrossBackgrounding: true,
    );
  } on LocalAuthException {
    return false;
  }
}
