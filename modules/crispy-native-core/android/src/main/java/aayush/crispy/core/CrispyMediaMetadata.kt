package aayush.crispy.core

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class CrispyMediaMetadata : Record {
    @Field
    val title: String = ""

    @Field
    val subtitle: String = ""

    @Field
    val artworkUrl: String? = null
}
