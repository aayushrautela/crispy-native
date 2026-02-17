package aayush.crispy.core

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class CrispyOpenPlayerActivityParams : Record {
  @Field
  val sessionId: String = ""

  @Field
  val url: String = ""

  @Field
  val infoHash: String? = null

  @Field
  val fileIdx: Int? = null

  @Field
  val headers: Map<String, String>? = null

  @Field
  val engine: String? = null

  @Field
  val paused: Boolean = false

  @Field
  val metadata: CrispyMediaMetadata? = null
}
