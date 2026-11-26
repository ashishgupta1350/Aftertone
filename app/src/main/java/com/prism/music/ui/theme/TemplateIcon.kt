package com.prism.music.ui.theme

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp
import androidx.core.graphics.PathParser
import com.prism.music.data.prefs.AppTemplate

/** One adapter keeps every native function's icon consistent with the active template. */
@Composable
fun TemplateIcon(imageVector: ImageVector, contentDescription: String?, modifier: Modifier = Modifier, tint: Color = LocalContentColor.current) {
    when (LocalAppSettings.current.appTemplate) {
        AppTemplate.CUPID -> androidx.compose.material3.Icon(CupidNativeIcons.of(imageVector), contentDescription, modifier, tint)
        AppTemplate.ROSEMARY -> Box(
            modifier.size(24.dp),
            contentAlignment = Alignment.Center,
        ) {
            Box(Modifier.requiredSize(32.dp)
                .background(Brush.verticalGradient(listOf(Color(0xFFB99CD9).copy(alpha = 0.65f), Color(0xFF211829))), CircleShape)
                .border(0.8.dp, Brush.verticalGradient(listOf(Color(0xFFF8DFFF), Color(0xFF8D6DB1))), CircleShape), contentAlignment = Alignment.Center) {
                androidx.compose.material3.Icon(imageVector, contentDescription, Modifier.size(24.dp), Color(0xFFF2DFFF).copy(alpha = tint.alpha))
            }
        }
        else -> androidx.compose.material3.Icon(imageVector, contentDescription, modifier, tint)
    }
}

@Composable
fun TemplateIcon(painter: Painter, contentDescription: String?, modifier: Modifier = Modifier, tint: Color = LocalContentColor.current) =
    androidx.compose.material3.Icon(painter, contentDescription, modifier, tint)

@Composable
fun TemplateIcon(bitmap: ImageBitmap, contentDescription: String?, modifier: Modifier = Modifier, tint: Color = LocalContentColor.current) =
    androidx.compose.material3.Icon(bitmap, contentDescription, modifier, tint)

/** Primary symbols reuse the original prototype pixels. Remaining native functions get a 16 px drawing. */
internal object CupidNativeIcons {
    private val cache = HashMap<String, ImageVector>()
    fun named(name: String): ImageVector = bitmapVector(name, CupidPixelData.pixels.getValue(name))

    fun of(source: ImageVector): ImageVector = cache.getOrPut(source.name) {
        val name = source.name.removePrefix("Cupertino").removeSuffix("Filled")
        val alias = when (name) { "SkipNext" -> "Next"; "SkipPrevious" -> "Previous"; "MusicNote" -> "Song"; "MoreVert", "MoreHoriz" -> "More"; else -> name }
        CupidPixelData.pixels[alias]?.let { return@getOrPut bitmapVector(alias, it) }
        val parts = runCatching { PrismIconData.spec(name).parts }.getOrNull() ?: return@getOrPut source
        val bitmap = Bitmap.createBitmap(16, 16, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.scale(16f / 24f, 16f / 24f)
        val paint = Paint().apply { color = android.graphics.Color.BLACK; isAntiAlias = false; strokeWidth = 2f }
        parts.forEach { part ->
            paint.style = if (part.kind == 1 || (part.kind == 2 && source.name.endsWith("Filled"))) Paint.Style.FILL else Paint.Style.STROKE
            paint.strokeWidth = part.width.coerceAtLeast(1.8f)
            PathParser.createPathFromPathData(part.d)?.let { canvas.drawPath(it, paint) }
        }
        val rows = (0..15).joinToString("/") { y -> (0..15).map { x -> if (android.graphics.Color.alpha(bitmap.getPixel(x, y)) > 127) '#' else '.' }.joinToString("") }
        bitmap.recycle()
        bitmapVector(name, rows)
    }

    private fun bitmapVector(name: String, pixels: String): ImageVector {
        val rows = pixels.split('/')
        val n = rows.size.toFloat()
        return ImageVector.Builder("Cupid$name", 24.dp, 24.dp, n + 2, n + 2).apply {
            path(fill = SolidColor(Color.Black)) {
                rows.forEachIndexed { y, row -> row.forEachIndexed { x, cell -> if (cell == '#') {
                    moveTo(x + 1f, y + 1f); lineTo(x + 2f, y + 1f); lineTo(x + 2f, y + 2f); lineTo(x + 1f, y + 2f); close()
                } } }
            }
        }.build()
    }
}
