package com.chargeverse.charge_verse

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

/**
 * Streams battery telemetry to Dart on `chargeverse/battery_stream` about once
 * a second. ACTION_BATTERY_CHANGED only fires when level/status/voltage
 * change, so current is polled from BatteryManager on a timer as well.
 *
 * Also owns the charging-screen window behaviour: stays awake while charging,
 * dims after a minute without a touch, shows over the lock screen when the
 * charger opened it, and closes again on unplug in that case.
 */
class MainActivity : FlutterActivity() {
    private val handler = Handler(Looper.getMainLooper())
    private var sink: EventChannel.EventSink? = null
    private var lastBatteryIntent: Intent? = null
    private var receiverRegistered = false

    private var launchedByCharger = false
    private var charging = false
    private var dimmed = false
    private var pendingPermissionResult: MethodChannel.Result? = null

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            lastBatteryIntent = intent
            emit()
        }
    }

    // Separate from [receiver] so the window reacts to plug/unplug even while
    // Dart isn't listening.
    private val windowReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            onChargingChanged(intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0)
        }
    }

    private val poller = object : Runnable {
        override fun run() {
            emit()
            handler.postDelayed(this, POLL_MS)
        }
    }

    private val dimmer = Runnable { setDimmed(true) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AutoLaunch.start(this)
        handleLaunchIntent(intent)
        registerBatteryReceiver(windowReceiver)?.let { windowReceiver.onReceive(this, it) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleLaunchIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        isOnScreen = true
        AutoLaunch.notificationManager(this).cancel(AutoLaunch.NOTIF_CHARGING)
        scheduleDim()
    }

    override fun onPause() {
        isOnScreen = false
        handler.removeCallbacks(dimmer)
        setDimmed(false)
        super.onPause()
    }

    override fun onUserInteraction() {
        super.onUserInteraction()
        setDimmed(false)
        scheduleDim()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val messenger = flutterEngine.dartExecutor.binaryMessenger
        EventChannel(messenger, CHANNEL).setStreamHandler(
            object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink) {
                    sink = events
                    start()
                }

                override fun onCancel(arguments: Any?) {
                    stop()
                    sink = null
                }
            },
        )
        MethodChannel(messenger, AUTO_LAUNCH_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "getStatus" -> result.success(AutoLaunch.status(this))
                "setEnabled" -> setAutoLaunch(call.arguments as? Boolean ?: false, result)
                "openNotificationSettings" -> {
                    openSettings(
                        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                            .putExtra(Settings.EXTRA_APP_PACKAGE, packageName),
                    )
                    result.success(null)
                }
                "openFullScreenSettings" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                        openSettings(
                            Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, packageUri()),
                        )
                    }
                    result.success(null)
                }
                "openBatterySettings" -> {
                    openSettings(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                    result.success(null)
                }
                "openAppSettings" -> {
                    openSettings(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri()))
                    result.success(null)
                }
                "openAutoLaunchSettings" -> {
                    result.success(openVendorAutoStart())
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun setAutoLaunch(enabled: Boolean, result: MethodChannel.Result) {
        if (enabled &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            pendingPermissionResult?.success(AutoLaunch.status(this))
            pendingPermissionResult = result
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIFICATIONS)
            return
        }
        AutoLaunch.setEnabled(this, enabled)
        result.success(AutoLaunch.status(this))
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQ_NOTIFICATIONS) return
        val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
        // Without notifications the plug-in alert can't appear, so stay off.
        if (granted) AutoLaunch.setEnabled(this, true)
        pendingPermissionResult?.success(AutoLaunch.status(this))
        pendingPermissionResult = null
    }

    private fun packageUri(): Uri = Uri.parse("package:$packageName")

    private fun openSettings(intent: Intent) {
        try {
            startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri()))
        }
    }

    /**
     * Opens the phone maker's own "auto-launch / autostart" list. These pages
     * aren't part of Android, move between OS versions and are sometimes not
     * exported, so try the known ones in turn and fall back to App info.
     * Returns true when a vendor page opened.
     */
    private fun openVendorAutoStart(): Boolean {
        for ((pkg, cls) in AUTO_START_ACTIVITIES) {
            try {
                startActivity(
                    Intent().setComponent(ComponentName(pkg, cls))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
                return true
            } catch (e: ActivityNotFoundException) {
                // Not this vendor or OS version; try the next one.
            } catch (e: SecurityException) {
                // Page exists but isn't exported; try the next one.
            }
        }
        openSettings(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri()))
        return false
    }

    private fun handleLaunchIntent(intent: Intent?) {
        if (intent?.getBooleanExtra(EXTRA_FROM_CHARGER, false) != true) return
        launchedByCharger = true
        showOverLockScreen(true)
        AutoLaunch.notificationManager(this).cancel(AutoLaunch.NOTIF_CHARGING)
    }

    private fun onChargingChanged(nowCharging: Boolean) {
        if (nowCharging == charging) return
        charging = nowCharging
        if (charging) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            scheduleDim()
            return
        }
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        handler.removeCallbacks(dimmer)
        setDimmed(false)
        if (launchedByCharger) {
            launchedByCharger = false
            showOverLockScreen(false)
            finish()
        }
    }

    private fun scheduleDim() {
        handler.removeCallbacks(dimmer)
        if (charging && isOnScreen) handler.postDelayed(dimmer, DIM_AFTER_MS)
    }

    private fun setDimmed(dim: Boolean) {
        if (dim == dimmed) return
        dimmed = dim
        window.attributes = window.attributes.apply {
            screenBrightness = if (dim) DIM_BRIGHTNESS else WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
        }
    }

    private fun showOverLockScreen(show: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(show)
            setTurnScreenOn(show)
        } else {
            @Suppress("DEPRECATION")
            val flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            if (show) window.addFlags(flags) else window.clearFlags(flags)
        }
    }

    private fun registerBatteryReceiver(r: BroadcastReceiver): Intent? {
        val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(r, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(r, filter)
        }
    }

    private fun start() {
        if (!receiverRegistered) {
            lastBatteryIntent = registerBatteryReceiver(receiver)
            receiverRegistered = true
        }
        handler.removeCallbacks(poller)
        handler.post(poller)
    }

    private fun stop() {
        handler.removeCallbacks(poller)
        if (receiverRegistered) {
            unregisterReceiver(receiver)
            receiverRegistered = false
        }
    }

    override fun onDestroy() {
        stop()
        sink = null
        handler.removeCallbacks(dimmer)
        unregisterReceiver(windowReceiver)
        pendingPermissionResult?.success(AutoLaunch.status(this))
        pendingPermissionResult = null
        super.onDestroy()
    }

    private fun emit() {
        val events = sink ?: return
        val bm = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val data = HashMap<String, Any>()
        data["platform"] = "android"

        lastBatteryIntent?.let { intent ->
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
            if (level >= 0 && scale > 0) data["level"] = level * 100.0 / scale

            data["status"] = when (intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)) {
                BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
                BatteryManager.BATTERY_STATUS_FULL -> "full"
                BatteryManager.BATTERY_STATUS_DISCHARGING -> "discharging"
                BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "not_charging"
                else -> "unknown"
            }
            data["plugged"] = when (intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1)) {
                BatteryManager.BATTERY_PLUGGED_AC -> "ac"
                BatteryManager.BATTERY_PLUGGED_USB -> "usb"
                BatteryManager.BATTERY_PLUGGED_WIRELESS -> "wireless"
                BATTERY_PLUGGED_DOCK -> "dock"
                0 -> "none"
                else -> "unknown"
            }

            val mv = intent.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1)
            if (mv > 0) data["voltageMv"] = mv

            val tenthsC = intent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE)
            if (tenthsC != Int.MIN_VALUE) data["temperatureC"] = tenthsC / 10.0
        }

        readProperty(bm, BatteryManager.BATTERY_PROPERTY_CURRENT_NOW)?.let { data["currentNowRaw"] = it }
        readProperty(bm, BatteryManager.BATTERY_PROPERTY_CURRENT_AVERAGE)?.let { data["currentAvgRaw"] = it }
        readProperty(bm, BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER)?.let { data["chargeCounterUah"] = it }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val ms = bm.computeChargeTimeRemaining()
            if (ms > 0) data["chargeTimeRemainingMs"] = ms
        }

        events.success(data)
    }

    /** Returns null when the device doesn't support the property. */
    private fun readProperty(bm: BatteryManager, id: Int): Long? {
        val v = bm.getLongProperty(id)
        return if (v == Long.MIN_VALUE || v == Int.MIN_VALUE.toLong()) null else v
    }

    companion object {
        const val EXTRA_FROM_CHARGER = "from_charger"

        /** Lets the watcher skip the plug-in alert when the app is already on screen. */
        @Volatile
        var isOnScreen = false

        private const val CHANNEL = "chargeverse/battery_stream"
        private const val AUTO_LAUNCH_CHANNEL = "chargeverse/auto_launch"
        private const val POLL_MS = 1000L
        private const val DIM_AFTER_MS = 60_000L
        private const val DIM_BRIGHTNESS = 0.05f
        private const val REQ_NOTIFICATIONS = 4101

        // BatteryManager.BATTERY_PLUGGED_DOCK, added in API 33.
        private const val BATTERY_PLUGGED_DOCK = 8

        private val AUTO_START_ACTIVITIES = listOf(
            // OPPO / realme (ColorOS)
            "com.coloros.safecenter" to "com.coloros.safecenter.startupapp.StartupAppListActivity",
            "com.coloros.safecenter" to "com.coloros.safecenter.permission.startup.StartupAppListActivity",
            "com.oppo.safe" to "com.oppo.safe.permission.startup.StartupAppListActivity",
            "com.coloros.oppoguardelf" to "com.coloros.powermanager.fuelgaue.PowerUsageModelActivity",
            // OnePlus
            "com.oneplus.security" to "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity",
            // Xiaomi / Redmi / POCO
            "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
            // vivo / iQOO
            "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
            "com.iqoo.secure" to "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity",
            // Huawei / Honor
            "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
            "com.huawei.systemmanager" to "com.huawei.systemmanager.optimize.process.ProtectActivity",
            // ASUS
            "com.asus.mobilemanager" to "com.asus.mobilemanager.entry.FunctionActivity",
        )
    }
}
