package com.prism.music.ui.theme

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.asComposePath
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.unit.dp
import androidx.core.graphics.PathParser

/** The original bow drawing from the reviewed Cupid prototype. Decorative, excluded from semantics. */
@Composable
fun CupidBow(modifier: Modifier = Modifier) {
    val scheme = MaterialTheme.colorScheme
    val paths = remember {
        listOf(
            "M25 9 10 2 3 6 4 24l9 3 12-8m10-10L50 2l7 4-1 18-9 3-12-8M26 18l-7 16 11-5 11 5-7-16",
            "m8 8 14 6M52 8 38 14M27 22l-3 8m9-8 3 8",
            "M25 9h10v13H25z",
        ).map { PathParser.createPathFromPathData(it).asComposePath() }
    }
    Canvas(modifier.size(54.dp, 32.dp)) {
        withTransform({ scale(size.width / 60f, size.height / 36f, Offset.Zero) }) {
            drawPath(paths[0], scheme.primaryContainer)
            drawPath(paths[0], scheme.outline, style = Stroke(2f))
            drawPath(paths[1], scheme.primary.copy(alpha = 0.5f), style = Stroke(2f))
            drawPath(paths[2], scheme.surfaceContainerHigh)
            drawPath(paths[2], scheme.outline, style = Stroke(2f))
        }
    }
}
