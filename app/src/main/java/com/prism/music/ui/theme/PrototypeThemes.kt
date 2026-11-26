package com.prism.music.ui.theme

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import com.prism.music.R
import com.prism.music.data.prefs.AppSettings
import com.prism.music.data.prefs.AppTemplate
import com.prism.music.data.prefs.FontChoice

/** Exact paper/ink pairs from the reviewed prototypes, shared by every native destination. */
fun templateColors(settings: AppSettings, dark: Boolean): ThemeColors {
    val cupid = settings.appTemplate == AppTemplate.CUPID
    val rosemary = settings.appTemplate == AppTemplate.ROSEMARY
    val bg = Color(if (cupid) { if (dark) 0xFF211A29 else 0xFFF3D9D5 } else { if (dark) 0xFF171225 else 0xFFF0E6FA })
    val paper = Color(if (cupid) { if (dark) 0xFF352638 else 0xFFF9E9D5 } else { if (dark) 0xFF2D2342 else 0xFFFCF3FF })
    val panel = Color(if (cupid) { if (dark) 0xFF412A40 else 0xFFF2D1D2 } else { if (dark) 0xFF3A2C50 else 0xFFE7D5F3 })
    val ink = Color(if (dark) 0xFFF8DFED else if (cupid) 0xFF673A4B else 0xFF362147)
    val secondary = Color(if (dark) 0xFFD4ADB9 else if (cupid) 0xFF835064 else 0xFF6A4B7D)
    val accent = Color(if (cupid) { if (dark) 0xFFE8A1B9 else 0xFFA34769 } else { if (dark) 0xFFD0AFFA else 0xFF77509F })
    val edge = Color(if (cupid) { if (dark) 0xFFA66B87 else 0xFFA8667E } else { if (dark) 0xFF977AB3 else 0xFF9C79B4 })
    val base = if (dark) darkColorScheme() else lightColorScheme()
    val scheme = base.copy(
        primary = accent, onPrimary = if (dark) Color(0xFF302033) else Color.White,
        primaryContainer = panel, onPrimaryContainer = ink,
        secondary = accent, onSecondary = if (dark) bg else Color.White,
        secondaryContainer = panel, onSecondaryContainer = ink,
        tertiary = accent, tertiaryContainer = panel, onTertiaryContainer = ink,
        background = bg, onBackground = ink, surface = paper, onSurface = ink,
        surfaceVariant = panel, onSurfaceVariant = secondary,
        surfaceContainerLowest = bg, surfaceContainerLow = paper, surfaceContainer = paper,
        surfaceContainerHigh = panel, surfaceContainerHighest = panel,
        surfaceDim = bg, surfaceBright = paper, outline = edge, outlineVariant = edge.copy(alpha = 0.5f),
        surfaceTint = Color.Transparent,
    )
    val light = SpectrumPresets.light(if (cupid) "CANDY" else if (rosemary) "DUSK" else "PRISM", emptyList(), false)
    return ThemeColors(scheme, PrismTokens.Accent(if (cupid) Color(0xFFE8A1B9) else Color(0xFFD0AFFA), if (cupid) Color(0xFFA34769) else Color(0xFF77509F), accent), light, true, dark, settings.contrast.ordinal, settings)
}

fun cupidTypography(): Typography {
    val pixel = FontFamily(Font(R.font.lovebit))
    val body = AppFonts.family(FontChoice.MONO)
    return prismTypography(body, pixel).let {
        it.copy(
            headlineLarge = it.headlineLarge.copy(fontSize = 28.sp, lineHeight = 36.sp),
            headlineMedium = it.headlineMedium.copy(fontSize = 24.sp, lineHeight = 32.sp),
            titleLarge = it.titleLarge.copy(fontFamily = pixel, fontSize = 20.sp, lineHeight = 28.sp),
            labelSmall = it.labelSmall.copy(fontSize = 12.sp, lineHeight = 16.sp),
        )
    }
}

@Composable
fun PrototypeBackdrop(modifier: Modifier = Modifier) {
    val s = LocalAppSettings.current
    val scheme = androidx.compose.material3.MaterialTheme.colorScheme
    val paper = s.appTemplate == AppTemplate.CUPID
    Canvas(modifier.fillMaxSize().background(scheme.background)) {
        if (paper) {
            val step = 4.dp.toPx()
            var x = 0f
            while (x < size.width) {
                drawLine(scheme.outline.copy(alpha = 0.055f), Offset(x, 0f), Offset(x, size.height), 1f)
                x += step
            }
        } else {
            drawRect(Brush.verticalGradient(listOf(scheme.surfaceContainerHigh, scheme.background)))
            drawCircle(Brush.radialGradient(listOf(Color(0xFFD99AC9).copy(alpha = 0.22f), Color.Transparent), Offset(size.width, size.height * 0.25f), size.width), size.width, Offset(size.width, size.height * 0.25f))
        }
    }
}
