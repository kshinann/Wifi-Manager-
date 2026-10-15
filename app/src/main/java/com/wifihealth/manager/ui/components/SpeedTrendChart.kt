package com.wifihealth.manager.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.wifihealth.manager.data.model.SpeedTestResult
import com.wifihealth.manager.ui.theme.SeverityGood
import com.wifihealth.manager.ui.theme.WifiBlue40
import com.wifihealth.manager.util.FormatUtils

/**
 * Download/upload throughput trend across [results] (oldest first, left to
 * right). Both lines share one vertical scale normalized to the largest Mbps
 * value seen, so a fast download run doesn't get its own separate axis from
 * upload. A result missing a reading is simply skipped for that line rather
 * than plotted as zero, so a partial/failed test doesn't drag the line down.
 */
@Composable
fun SpeedTrendChart(results: List<SpeedTestResult>, modifier: Modifier = Modifier) {
    val maxMbps = results.flatMap { listOfNotNull(it.downloadMbps, it.uploadMbps) }.maxOrNull() ?: 0.0

    Column(modifier = modifier) {
        Row {
            LegendDot(color = WifiBlue40, label = "Download")
            Spacer(modifier = Modifier.width(16.dp))
            LegendDot(color = SeverityGood, label = "Upload")
        }
        Spacer(modifier = Modifier.height(8.dp))
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(140.dp),
        ) {
            if (results.size < 2 || maxMbps <= 0.0) return@Canvas
            val stepX = size.width / (results.size - 1)

            fun points(selector: (SpeedTestResult) -> Double?): List<Offset> =
                results.mapIndexedNotNull { index, result ->
                    selector(result)?.let { value ->
                        Offset(
                            x = index * stepX,
                            y = size.height - (value / maxMbps * size.height).toFloat(),
                        )
                    }
                }

            fun drawTrendLine(points: List<Offset>, color: Color) {
                if (points.size < 2) return
                val path = Path().apply {
                    moveTo(points.first().x, points.first().y)
                    points.drop(1).forEach { lineTo(it.x, it.y) }
                }
                drawPath(path, color = color, style = Stroke(width = 4.dp.toPx()))
                points.forEach { drawCircle(color = color, radius = 3.dp.toPx(), center = it) }
            }

            drawTrendLine(points(SpeedTestResult::downloadMbps), WifiBlue40)
            drawTrendLine(points(SpeedTestResult::uploadMbps), SeverityGood)
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            if (maxMbps > 0.0) "Peak: ${FormatUtils.mbps(maxMbps)}" else "No throughput data yet",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.secondary,
        )
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Canvas(modifier = Modifier.size(8.dp)) { drawCircle(color = color) }
        Spacer(modifier = Modifier.width(4.dp))
        Text(label, style = MaterialTheme.typography.labelSmall)
    }
}
