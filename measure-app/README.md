# MeasureKit (Android)

An Android app that measures things with your phone's sensors. Kotlin, Jetpack Compose, ARCore.

| Tab | What it does | How |
|---|---|---|
| **Length** | Distance between points, or the total length of a path through several points | ARCore hit tests and anchors |
| **Size** | Box dimensions W × D × H and volume | 3 base corners, then a point on the top surface |
| **Liquid** | Liquid volume, capacity and % full | Geometry for a bottle/can, box/tank, cup/bucket (frustum) or horizontal tank |
| **Speed** | Current, max and average speed, distance, moving time | GPS (`LocationManager`), filtered for accuracy and standstill jitter |

The **Metric / Imperial** toggle in the top bar switches every reading (cm/m ↔ in/ft, mL/L ↔ fl oz/gal, km/h ↔ mph).

## Using the AR tools
1. Move the phone slowly until the crosshair turns green (it has found a surface).
2. Aim at a point and tap **+**. A dashed line and a live reading follow the crosshair.
3. **Size:** place corner 1, corner 2 (width) and corner 3 (depth) on the base, then aim at the box's top surface and tap **+** to get the height.
4. **Undo** removes the last point. **Delete** clears everything.

Accuracy is typically within 1–3 cm at arm's length on textured, well-lit surfaces. Phones that support the ARCore Depth API also get hits on surfaces where no plane has been detected.

## Requirements
- Android 7.0 (API 24) or newer.
- The AR tabs need an [ARCore-supported device](https://developers.google.com/ar/devices). If Google Play Services for AR is missing, the app prompts to install it. On unsupported phones the Liquid and Speed tabs still work.

## Build
Open `measure-app/` in Android Studio (Ladybug or newer), or run:

```bash
cd measure-app
./gradlew assembleDebug        # APK in app/build/outputs/apk/debug/
./gradlew testDebugUnitTest    # unit tests for geometry, liquid volume, speed and units
```

Toolchain: AGP 8.7.3, Kotlin 2.0.21, Gradle 8.14.3, compile/target SDK 35, JDK 17+.

## Code layout
```
app/src/main/java/com/measurekit/app/
  MainActivity.kt            tabs and unit toggle
  ar/                        ARCore session, camera renderer, measuring overlay, geometry
  liquid/                    container volume maths and calculator screen
  speed/                     GPS speed tracker and speedometer screen
  units/                     unit conversion and formatting
  ui/                        theme and runtime-permission gate
```
