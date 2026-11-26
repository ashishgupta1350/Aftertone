package com.prism.music.ui.player

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prism.music.R
import com.prism.music.data.prefs.ThemeMode
import com.prism.music.ui.components.Artwork
import com.prism.music.ui.theme.*
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/** The reviewed Cupid window, drawn natively and bound to the existing Media3 player. */
@Composable
fun CupidPlayer(
    onCollapse: () -> Unit,
    onOptions: () -> Unit,
    onLyrics: () -> Unit,
    onQueue: () -> Unit,
    onOutput: () -> Unit,
    onSettings: () -> Unit,
    panelTitle: String? = null,
    onClosePanel: () -> Unit = {},
    panel: (@Composable () -> Unit)? = null,
) {
    val c = LocalContainer.current
    val song by c.player.currentSong.collectAsState()
    val playing by c.player.isPlaying.collectAsState()
    val liked by c.library.likedIds.collectAsState()
    val current = song ?: return
    val scheme = MaterialTheme.colorScheme
    val dark = LocalIsDark.current
    BoxWithConstraints(Modifier.fillMaxSize().background(scheme.background).safeDrawingPadding().padding(12.dp), contentAlignment = Alignment.TopCenter) {
        val sceneHeight = minOf(maxWidth.coerceAtMost(620.dp) * (320f / 360f), (maxHeight - 400.dp).coerceIn(132.dp, 360.dp))
        val frame = RoundedCornerShape(10.dp)
        Column(Modifier.widthIn(max = 620.dp).fillMaxWidth().fillMaxHeight()
            .background(scheme.surface, frame).border(2.dp, scheme.outline, frame).testTag("cupidPlayer")) {
            Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).background(scheme.surfaceContainerHigh).padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                CupidAction(PrismIcons.ChevronDown, "Minimize player", onCollapse)
                Text(panelTitle ?: "cupid player", Modifier.weight(1f), style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                CupidAction(CupidNativeIcons.named(if (dark) "Sun" else "Moon"), if (dark) "Switch to light mode" else "Switch to dark mode", {
                    c.settings.setThemeMode(if (dark) ThemeMode.LIGHT else ThemeMode.DARK)
                }, "cupid:mode")
                CupidAction(PrismIcons.More, "More options", onOptions)
            }
            if (panel != null) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    CupidAction(PrismIcons.ArrowBack, "Return to record player", onClosePanel)
                    Text(current.title, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Box(Modifier.weight(1f).fillMaxWidth()) { panel() }
                CupidTransport(playing)
            } else {
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                val bodyHeight = maxHeight
                Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).heightIn(min = bodyHeight), verticalArrangement = Arrangement.SpaceBetween) {
                    Box(Modifier.fillMaxWidth().height(sceneHeight).background(scheme.surfaceContainerHigh)) {
                        Image(painterResource(if (dark) R.drawable.cupid_room_night else R.drawable.cupid_room_day), "A turntable beside roses and a moonlit window", Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                    }
                    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 12.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Artwork(c.covers.art(current), Modifier.size(56.dp))
                        Column(Modifier.weight(1f)) {
                            Text("now playing", style = MaterialTheme.typography.labelMedium, color = scheme.onSurfaceVariant)
                            Text(current.title, style = MaterialTheme.typography.titleLarge, fontSize = 20.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text(current.artistText, style = MaterialTheme.typography.bodyMedium, color = scheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        CupidAction(if (current.id in liked) PrismIcons.HeartFilled else PrismIcons.Heart, if (current.id in liked) "Unlike song" else "Like song", { c.library.toggleLike(current) }, "cupid:like")
                    }
                    Column {
                        CupidTransport(playing)
                        CupidSeekBar()
                    }
                }
                }
            }
            HorizontalDivider(color = scheme.outline)
            Row(Modifier.fillMaxWidth().heightIn(min = 64.dp).padding(horizontal = 4.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                CupidTool(PrismIcons.QueueMusic, "Queue", onQueue)
                CupidTool(PrismIcons.Headphones, "Sound", onOutput)
                CupidTool(PrismIcons.Lyrics, "Lyrics", onLyrics)
                CupidTool(PrismIcons.Settings, "Settings", onSettings)
            }
        }
        CupidBow(Modifier.align(Alignment.TopCenter).offset(y = (-10).dp))
    }
}

@Composable
private fun CupidTransport(playing: Boolean) {
    val pc = LocalContainer.current.player
    val next by pc.hasNext.collectAsState()
    Row(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally)) {
        CupidTransportButton(PrismIcons.Previous, "Previous song", true, { pc.previous() })
        CupidTransportButton(if (playing) PrismIcons.Pause else PrismIcons.Play, if (playing) "Pause" else "Play", true, { pc.togglePlay() })
        CupidTransportButton(PrismIcons.Next, "Next song", next, { pc.next() })
    }
}

@Composable
private fun CupidTransportButton(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, enabled: Boolean, onClick: () -> Unit) {
    val scheme = MaterialTheme.colorScheme
    OutlinedIconButton(onClick, Modifier.width(64.dp).height(52.dp).testTag("cupid:$label"), enabled = enabled, shape = RoundedCornerShape(8.dp), border = androidx.compose.foundation.BorderStroke(1.dp, scheme.outline), colors = IconButtonDefaults.outlinedIconButtonColors(containerColor = scheme.surfaceContainerHigh, contentColor = scheme.primary)) {
        TemplateIcon(icon, label, Modifier.size(28.dp))
    }
}

@Composable
private fun CupidAction(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit, tag: String = label) {
    IconButton(onClick, Modifier.size(48.dp).testTag(tag)) { TemplateIcon(icon, label, Modifier.size(24.dp)) }
}

@Composable
private fun CupidTool(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    TextButton(onClick, Modifier.heightIn(min = 56.dp), contentPadding = PaddingValues(6.dp)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            TemplateIcon(icon, label, Modifier.size(24.dp))
            Text(label, fontSize = 12.sp, maxLines = 1)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CupidSeekBar() {
    val pc = LocalContainer.current.player
    val position = rememberPosition(fast = false)
    val song by pc.currentSong.collectAsState()
    val duration = pc.duration.coerceAtLeast(1)
    var scrub by remember(song?.id) { mutableStateOf<Float?>(null) }
    val fraction = scrub ?: (position.toFloat() / duration).coerceIn(0f, 1f)
    val scheme = MaterialTheme.colorScheme
    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
        Slider(fraction, { scrub = it }, Modifier.fillMaxWidth().height(48.dp).testTag("cupid:seek"), enabled = pc.duration > 0,
            onValueChangeFinished = { scrub?.let { pc.seekTo((it * duration).toLong()) }; scrub = null },
            thumb = {
                Canvas(Modifier.size(24.dp)) {
                    val star = Path()
                    repeat(10) { i ->
                        val angle = -PI / 2 + i * PI / 5
                        val radius = size.minDimension * if (i % 2 == 0) 0.48f else 0.23f
                        val x = center.x + cos(angle).toFloat() * radius
                        val y = center.y + sin(angle).toFloat() * radius
                        if (i == 0) star.moveTo(x, y) else star.lineTo(x, y)
                    }
                    star.close(); drawPath(star, Color(0xFFF4DFA3)); drawPath(star, scheme.outline, style = Stroke(1.dp.toPx()))
                }
            }, colors = SliderDefaults.colors(activeTrackColor = scheme.primary, inactiveTrackColor = scheme.outlineVariant))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(formatTime((fraction * duration).toLong()), style = MaterialTheme.typography.labelMedium)
            Text(formatTime(pc.duration), style = MaterialTheme.typography.labelMedium)
        }
        Spacer(Modifier.height(8.dp))
    }
}
