# Android release signing (build.gradle.kts)

Add to the top of `android/app/build.gradle.kts`:

```kotlin
import java.io.FileInputStream
import java.util.Properties

val keystoreProperties = Properties().apply {
    val file = rootProject.file("key.properties")
    if (file.exists()) load(FileInputStream(file))
}
```

Inside `android { ... }`:

```kotlin
signingConfigs {
    create("release") {
        keyAlias = keystoreProperties["keyAlias"] as String?
        keyPassword = keystoreProperties["keyPassword"] as String?
        storeFile = (keystoreProperties["storeFile"] as String?)?.let { file(it) }
        storePassword = keystoreProperties["storePassword"] as String?
    }
}
buildTypes {
    release {
        signingConfig = if (keystoreProperties.isEmpty) signingConfigs.getByName("debug") else signingConfigs.getByName("release")
    }
}
```

`storeFile` is relative to `android/app/`; the workflow writes the keystore to `android/app/upload-keystore.jks` and `key.properties` to `android/`.

Create the upload key once:

```bash
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Enrol in Play App Signing (default for new apps): Google holds the app signing key, you hold only this upload key, and a lost upload key can be reset from Play Console.
