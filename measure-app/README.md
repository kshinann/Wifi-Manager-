# MeasureKit (Android)

An Android app that measures things with your phone's sensors. Kotlin, Jetpack Compose, ARCore.

| Tab | What it does | How |
|---|---|---|
| **Length** | Distance between points, or the total length of a path through several points | ARCore hit tests and anchors |
| **Size** | Box dimensions W × D × H and volume | 3 base corners, then a point on the top surface |
| **Liquid** | Liquid volume, capacity and % full | Geometry for a bottle/can, box/tank, cup/bucket (frustum) or horizontal tank |
| **Speed** | Speed of an external object (car, ball, person, drone), live or from a video | Two camera "gates" timed with CameraX, or marked video frames |

The **Metric / Imperial** toggle in the top bar switches every reading (cm/m ↔ in/ft, mL/L ↔ fl oz/gal, km/h ↔ mph).
The last AR **Length** measurement can be reused as a distance in the Speed tool ("Use AR length").

## Using the AR tools
1. Move the phone slowly until the crosshair turns green (it has found a surface).
2. Aim at a point and tap **+**. A dashed line and a live reading follow the crosshair.
3. **Size:** place corner 1, corner 2 (width) and corner 3 (depth) on the base, then aim at the box's top surface and tap **+** to get the height.
4. **Undo** removes the last point. **Delete** clears everything.

Accuracy is typically within 1–3 cm at arm's length on textured, well-lit surfaces. Phones that support the ARCore Depth API also get hits on surfaces where no plane has been detected.

## Measuring an object's speed
Phones have no radar, so the speed comes from distance ÷ time measured with the camera.

**Live (camera gates)**: best for vehicles and anything that passes across the view.
1. Hold the phone still, ideally on a tripod or against something solid, side-on to the path.
2. Choose *Moves across ↔* (vertical lines) or *Moves up/down ↕* (horizontal lines).
3. Drag lines **A** and **B** onto two marks the object will pass (road markings, posts, cones).
4. Enter the real distance between those marks, or tap *Use AR length* after measuring it with the Length tab.
5. When something crosses A and then B, the app shows its speed and direction (A → B or B → A) and keeps a history.

Each crossing time is interpolated between frames, so the result is finer than the frame interval. It's still best when
the object takes at least ~0.3 s between the lines: use marks further apart for fast objects. Adjust *Sensitivity* if
shadows trigger it (lower) or small objects are missed (higher). If something trips both lines in the same frame,
such as a shadow, a flash or a camera bump, it's ignored.

**From video**: best for fast or small objects such as balls, and for checking a result afterwards.
1. Record with the phone's camera app, in slow motion if available. Keep the phone still and have something of known
   length in view at the same distance as the object (a goal width, a car's wheelbase, a marked line).
2. Choose the video. Step to a frame and tap the object (mark 1), step forward and tap it again (mark 2).
3. Tap both ends of the reference (marks 3 and 4) and enter its real length.
4. The slow-motion factor is read from the file when the camera app records it (e.g. 240 fps saved at 30 fps = 8).
   Check it and correct it if needed.

Both methods assume the object moves roughly across the view, not towards or away from the camera.

## Requirements
- Android 7.0 (API 24) or newer.
- The AR tabs need an [ARCore-supported device](https://developers.google.com/ar/devices). If Google Play Services for AR is missing, the app prompts to install it. On unsupported phones the Liquid and Speed tabs still work (Speed only needs a camera).

## Build
Open `measure-app/` in Android Studio (Ladybug or newer), or run:

```bash
cd measure-app
./gradlew assembleDebug        # APK in app/build/outputs/apk/debug/
./gradlew testDebugUnitTest    # unit tests for geometry, liquid volume, speed trap, video speed and units
```

Toolchain: AGP 8.7.3, Kotlin 2.0.21, Gradle 8.14.3, compile/target SDK 35, JDK 17+.

## Code layout
```
app/src/main/java/com/measurekit/app/
  MainActivity.kt            tabs and unit toggle
  ar/                        ARCore session, camera renderer, measuring overlay, geometry
  liquid/                    container volume maths and calculator screen
  speed/                     camera speed trap (CameraX) and video frame analysis
  units/                     unit conversion and formatting
  ui/                        theme, runtime-permission gate, distance input
```
