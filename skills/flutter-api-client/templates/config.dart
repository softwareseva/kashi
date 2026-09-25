/// API base URL: --dart-define=API_URL wins; otherwise the local wrangler dev server from simulators.
library;

import 'dart:io' show Platform;

String apiBaseUrl() {
  const fromDefine = String.fromEnvironment('API_URL');
  if (fromDefine.isNotEmpty) return fromDefine;
  return Platform.isAndroid
      ? 'http://10.0.2.2:8787/v1'
      : 'http://localhost:8787/v1';
}
