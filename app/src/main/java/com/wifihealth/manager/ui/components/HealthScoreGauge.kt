package com.wifihealth.manager.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wifihealth.manager.ui.theme.SeverityCritical
import com.wifihealth.manager.ui.theme.SeverityGood
import com.wifihealth.manager.ui.theme.SeverityWarning
import com.wifihealth.manager.ui.theme.WifiBlue40

@Composable
fun HealthScoreGauge(score: Int, label: String, modifier: Modifier = Modifier) {
    val color = when {
        score >= 85 -> SeverityGood
        score >= 70 -> WifiBlue40
        score >= 50 -> SeverityWarning
        else -> SeverityCritical
    }
    Box(modifier = modifier.size(140.dp), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val strokeWidth = 14.dp.toPx()
            drawArc(
                color = color.copy(alpha = 0.15f),
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                style = Stroke(width = strokeWidth, cap = StrokeCap.Round),
            )
            drawArc(
                color = color,
                startAngle = -90f,
                sweepAngle = 360f * (score.coerceIn(0, 100) / 100f),
                useCenter = false,
                style = Stroke(width = strokeWidth, cap = StrokeCap.Round),
            )
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text = "$score", style = MaterialTheme.typography.titleLarge.copy(fontSize = 34.sp))
            Text(text = label, style = MaterialTheme.typography.bodyMedium)
        }
    }
}
