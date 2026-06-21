#!/usr/bin/env bash
# Builds the signed, aligned SpeedMoto APK using only Debian/apt-sourced Android
# tools + a Maven-Central dx jar. No Android SDK manager / Google Maven needed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
APP="$ROOT/app"
BUILD="$ROOT/build"
TOOLS="$REPO/tools"
SDKJAR="/usr/lib/android-sdk/platforms/android-23/android.jar"
DX="$TOOLS/dalvik-dx.jar"
KS="$TOOLS/debug.keystore"
PKG_PATH="io/berilo/speedmoto"
OUT="$BUILD/speedmoto.apk"

rm -rf "$BUILD"; mkdir -p "$BUILD/classes"

echo "[1/7] javac (source/target 8 so legacy dx can read the bytecode)"
javac -source 8 -target 8 -encoding UTF-8 -nowarn \
      -classpath "$SDKJAR" -d "$BUILD/classes" \
      "$APP/src/$PKG_PATH/MainActivity.java"

echo "[2/7] dx -> classes.dex"
java -cp "$DX" com.android.dx.command.Main \
     --dex --min-sdk-version=24 --output="$BUILD/classes.dex" "$BUILD/classes"

echo "[3/7] aapt package (manifest + res + assets)"
aapt package -f \
     -M "$APP/AndroidManifest.xml" \
     -S "$APP/res" \
     -A "$APP/assets" \
     -I "$SDKJAR" \
     -F "$BUILD/app.unsigned.apk"

echo "[4/7] add classes.dex to the package root"
( cd "$BUILD" && aapt add -f app.unsigned.apk classes.dex >/dev/null )

echo "[5/7] zipalign 4"
zipalign -f 4 "$BUILD/app.unsigned.apk" "$BUILD/app.aligned.apk"

echo "[6/7] ensure debug keystore exists"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass android -keypass android \
          -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
          -dname "CN=Speed Moto, O=berilo.io, C=US" >/dev/null 2>&1
fi

echo "[7/7] apksigner (v1+v2+v3)"
apksigner sign --ks "$KS" --ks-pass pass:android --key-pass pass:android \
          --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
          --out "$OUT" "$BUILD/app.aligned.apk"

echo
echo "==== VERIFY ===="
apksigner verify --verbose "$OUT" | sed 's/^/  /'
echo "  APK: $OUT  ($(wc -c < "$OUT") bytes)"
