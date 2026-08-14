package com.wifihealth.manager.util

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat

object PermissionUtils {

    /**
     * Runtime permission(s) needed to read Wi-Fi scan results / SSID on this SDK level.
     *
     * NEARBY_WIFI_DEVICES alone is documented as sufficient on API 33+, but some OEM Android
     * builds don't fully honor that for `WifiManager#getScanResults()` without ACCESS_FINE_LOCATION
     * also being held (observed in the field: scan results silently come back empty despite the
     * permission being granted and Location being on). Requesting both is harmless on stock
     * Android and adds resilience against that OEM gap.
     */
    fun requiredWifiPermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(Manifest.permission.NEARBY_WIFI_DEVICES, Manifest.permission.ACCESS_FINE_LOCATION)
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }

    fun hasWifiPermissions(context: Context): Boolean =
        requiredWifiPermissions().all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }

    /**
     * Whether the device-wide Location toggle is on. Independent of the app's own runtime
     * permission grant: on most OEM builds (and stock Android 9+), Wi-Fi scan results come back
     * empty or badly incomplete whenever this system setting is off, regardless of what the app
     * itself was granted.
     */
    fun isLocationEnabled(context: Context): Boolean {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            ?: return false
        return LocationManagerCompat.isLocationEnabled(locationManager)
    }
}
