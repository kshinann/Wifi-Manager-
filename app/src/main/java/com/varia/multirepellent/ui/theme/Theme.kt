package com.varia.multirepellent.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

private val LightColors = lightColorScheme(
    primary = SonarTeal,
    onPrimary = SlateSurfaceLight,
    secondary = CautionAmber,
    background = SlateBackgroundLight,
    surface = SlateSurfaceLight,
    onBackground = SlateTextLight,
    onSurface = SlateTextLight
)

private val DarkColors = darkColorScheme(
    primary = SonarTealDark,
    onPrimary = SlateTextDark,
    secondary = CautionAmberDark,
    background = SlateBackgroundDark,
    surface = SlateSurfaceDark,
    onBackground = SlateTextDark,
    onSurface = SlateTextDark
)

@Composable
fun MultiRepellentTheme(
    useDynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val darkTheme = isSystemInDarkTheme()
    val context = LocalContext.current

    val colorScheme = when {
        useDynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        darkTheme -> DarkColors
        else -> LightColors
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = MultiRepellentTypography,
        content = content
    )
}
