package com.prism.music.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.prism.music.R
import com.prism.music.ui.LocalNavigator
import com.prism.music.ui.Routes
import com.prism.music.ui.theme.LocalContainer
import com.prism.music.ui.theme.LocalIsDark

/** The illustrated home card opens the real current session, or the listener's library. */
@Composable
fun CupidHomeCard() {
    val c = LocalContainer.current
    val nav = LocalNavigator.current
    val song by c.player.currentSong.collectAsState()
    val dark = LocalIsDark.current
    val scheme = MaterialTheme.colorScheme
    Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp).fillMaxWidth()
        .clip(RoundedCornerShape(8.dp)).background(scheme.surface)
        .border(1.dp, scheme.outline, RoundedCornerShape(8.dp))
        .clickable(onClickLabel = if (song == null) "Open your library" else "Open now playing") { if (song == null) nav.go(Routes.LIBRARY) else nav.openPlayer() }) {
        Image(painterResource(if (dark) R.drawable.cupid_room_night else R.drawable.cupid_room_day), "A moonlit corner for your records", Modifier.fillMaxWidth().height(220.dp), contentScale = ContentScale.Crop)
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("a little love on repeat", style = MaterialTheme.typography.titleLarge)
            Text(song?.title ?: "Your music. Your little escape.", style = MaterialTheme.typography.bodyMedium, color = scheme.onSurfaceVariant)
        }
    }
}
