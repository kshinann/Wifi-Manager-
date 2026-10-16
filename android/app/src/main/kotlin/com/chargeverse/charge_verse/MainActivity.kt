package com.chargeverse.charge_verse

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel

/**
 * Streams battery telemetry to Dart on `chargeverse/battery_stream` about once
 * a second. ACTION_BATTERY_CHANGED only fires when level/status/voltage
 * change, so current is polled from BatteryManager on a timer as well.
 */
class MainActivity : FlutterActivity() {
    private val handler = Handler(Looper.getMainLooper())
    private var sink: EventChannel.EventSink? = null
    private var lastBatteryIntent: Intent? = null
    private var receiverRegistered = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            lastBatteryIntent = intent
            emit()
        }
    }

    private val poller = object : Runnable {
        override fun run() {
            emit()
            handler.postDelayed(this, POLL_MS)
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setStreamHandler(
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
    }

    private fun start() {
        if (!receiverRegistered) {
            val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
            lastBatteryIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                registerReceiver(receiver, filter)
            }
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
        private const val CHANNEL = "chargeverse/battery_stream"
        private const val POLL_MS = 1000L

        // BatteryManager.BATTERY_PLUGGED_DOCK, added in API 33.
        private const val BATTERY_PLUGGED_DOCK = 8
    }
}
