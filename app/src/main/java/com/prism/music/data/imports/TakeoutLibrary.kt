package com.prism.music.data.imports

import com.prism.music.data.imports.ImportFiles.str
import kotlinx.serialization.json.JsonObject
import java.io.InputStream
import java.io.PushbackReader

/** Reads Google Takeout playlist and music-library files by YouTube video ID. */
internal object TakeoutLibrary {
    private val videoId = Regex("[A-Za-z0-9_-]{11}")
    private val likesNames = setOf("likes", "liked music", "liked songs", "liked videos")

    fun readFile(file: String, input: InputStream): ParsedLibrary {
        val name = file.substringBeforeLast('.').replace(Regex("(?i)-videos$"), "").trim()
        val likes = name.lowercase() in likesNames
        if (likes && file.endsWith(".json", ignoreCase = true)) {
            val tracks = ImportFiles.arrayItems(input).mapNotNull { row ->
                val details = row["contentDetails"] as? JsonObject
                val snippet = row["snippet"] as? JsonObject
                val resource = snippet?.get("resourceId") as? JsonObject
                val id = details?.str("videoId") ?: resource?.str("videoId") ?: row.str("videoId")
                    ?: row.str("titleUrl")?.let(TakeoutHistory::videoId)
                track(id, snippet?.str("title") ?: row.str("title"), snippet?.str("videoOwnerChannelTitle"), null)
            }
            return ParsedLibrary(liked = tracks.distinctBy { it.key }.toList())
        }
        if (!file.endsWith(".csv", ignoreCase = true)) return ParsedLibrary()

        val rows = csvRows(input).iterator()
        if (!rows.hasNext()) return ParsedLibrary()
        val header = rows.next().map { it.trim().removePrefix("\uFEFF").lowercase().filter(Char::isLetterOrDigit) }
        val idColumn = header.indexOf("videoid")
        val titleColumn = header.indexOf("songtitle")
        val isPlaylist = "playlistvideocreationtimestamp" in header
        if (idColumn < 0 || (!likes && !isPlaylist && titleColumn < 0)) return ParsedLibrary()
        val artistColumn = header.indexOf("artistname")
        val albumColumn = header.indexOf("albumtitle")
        val tracks = rows.asSequence().mapNotNull { row ->
            track(row.getOrNull(idColumn), row.getOrNull(titleColumn), row.getOrNull(artistColumn), row.getOrNull(albumColumn))
        }.distinctBy { it.key }.toList()
        if (tracks.isEmpty()) return ParsedLibrary()
        return if (likes) ParsedLibrary(liked = tracks)
        else ParsedLibrary(playlists = listOf(LibraryPlaylist(name, tracks, "takeout:$name")))
    }

    private fun track(rawId: String?, title: String?, artist: String?, album: String?): LibraryTrack? {
        val id = rawId?.trim()?.takeIf(videoId::matches) ?: return null
        return LibraryTrack(title.orEmpty().trim().ifEmpty { id }, artist.orEmpty().trim(), album?.trim(), id, youtubeId = id)
    }

    /** Handles quoted fields, doubled quotes and newlines inside quoted fields. */
    private fun csvRows(input: InputStream): Sequence<List<String>> = sequence {
        PushbackReader(input.bufferedReader()).use { reader ->
            val row = mutableListOf<String>()
            val field = StringBuilder()
            var quoted = false
            var next = reader.read()
            if (next == 0xFEFF) next = reader.read()
            while (next != -1) {
                when (val char = next.toChar()) {
                    '"' -> {
                        if (quoted) {
                            val following = reader.read()
                            if (following == '"'.code) field.append('"')
                            else {
                                quoted = false
                                if (following != -1) reader.unread(following)
                            }
                        } else if (field.isEmpty()) quoted = true
                        else field.append(char)
                    }
                    ',', '\r', '\n' -> if (quoted) field.append(char) else {
                        row += field.toString()
                        field.clear()
                        if (char != ',') {
                            if (row.any { it.isNotBlank() }) yield(row.toList())
                            row.clear()
                        }
                    }
                    else -> field.append(char)
                }
                next = reader.read()
            }
            if (!quoted && (row.isNotEmpty() || field.isNotEmpty())) yield(row + field.toString())
        }
    }
}
