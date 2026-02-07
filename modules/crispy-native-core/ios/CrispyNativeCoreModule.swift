import ExpoModulesCore
import AVKit
import AVFoundation
import MobileVLCKit

public class CrispyNativeCoreModule: Module {
    private var pipController: AVPictureInPictureController?
    
    public func definition() -> ModuleDefinition {
        Name("CrispyNativeCore")
        
        // MARK: - Torrent Methods (No-op on iOS)
        
        AsyncFunction("startStream") { (infoHash: String, fileIdx: Int, sessionId: String) -> String? in
            print("[CrispyNativeCore] Torrent streaming not supported on iOS")
            return nil
        }
        
        AsyncFunction("destroyStream") { (sessionId: String) -> Void in
            print("[CrispyNativeCore] destroyStream: Torrent not supported on iOS")
        }
        
        AsyncFunction("stopTorrent") { (infoHash: String) -> Void in
            print("[CrispyNativeCore] stopTorrent: Torrent not supported on iOS")
        }
        
        AsyncFunction("destroyTorrent") { (infoHash: String) -> Void in
            print("[CrispyNativeCore] destroyTorrent: Torrent not supported on iOS")
        }
        
        AsyncFunction("clearCache") { () -> Void in
            print("[CrispyNativeCore] clearCache: Torrent not supported on iOS")
        }
        
        AsyncFunction("handleSeek") { (infoHash: String, fileIdx: Int, position: Double) -> Void in
            print("[CrispyNativeCore] handleSeek: Torrent not supported on iOS")
        }
        
        // MARK: - Picture-in-Picture
        
        AsyncFunction("enterPiP") { (width: Double?, height: Double?) -> Void in
            guard AVPictureInPictureController.isPictureInPictureSupported() else {
                print("[CrispyNativeCore] PiP not supported on this device")
                return
            }
            
            DispatchQueue.main.async {
                self.enterPiPMode()
            }
        }
        
        AsyncFunction("setPiPConfig") { (enabled: Bool, isPlaying: Bool, width: Double?, height: Double?) -> Bool in
            return AVPictureInPictureController.isPictureInPictureSupported()
        }
        
        AsyncFunction("isInPiPMode") { () -> Bool in
            return pipController?.isPictureInPictureActive ?? false
        }
        
        // MARK: - Native Player Activity (Stub for iOS - handled differently)
        
        AsyncFunction("openPlayerActivity") { (
            sessionId: String,
            url: String,
            headers: [String: String]?,
            engine: String,
            paused: Bool,
            title: String,
            subtitle: String,
            artworkUrl: String?
        ) -> Bool in
            print("[CrispyNativeCore] openPlayerActivity: Use JS player on iOS")
            return false
        }
        
        AsyncFunction("closePlayerActivity") { () -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetPaused") { (paused: Bool) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSeek") { (positionSec: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerLoad") { (
            url: String?,
            headers: [String: String]?,
            paused: Bool,
            title: String,
            subtitle: String,
            artworkUrl: String?
        ) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetRate") { (rate: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetVolume") { (volume: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetResizeMode") { (mode: String) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetAudioTrack") { (trackId: Int) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleTrack") { (trackId: Int) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleDelay") { (delaySec: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleSize") { (size: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleColor") { (color: String) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleBackgroundColor") { (color: String, opacity: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleBorderSize") { (size: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleBorderColor") { (color: String) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitlePosition") { (pos: Double) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleBold") { (bold: Bool) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetSubtitleItalic") { (italic: Bool) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetDecoderMode") { (mode: String) -> Bool in
            return false
        }
        
        AsyncFunction("nativePlayerSetGpuMode") { (mode: String) -> Bool in
            return false
        }
        
        // MARK: - VLC View (primary iOS implementation)
        
        View(CrispyVLCVideoView.self) {
            Prop("source") { (view: CrispyVLCVideoView, source: String?) in
                view.setSource(source)
            }
            
            Prop("headers") { (view: CrispyVLCVideoView, headers: [String: String]?) in
                view.setHeaders(headers)
            }
            
            Prop("paused") { (view: CrispyVLCVideoView, paused: Bool) in
                view.setPaused(paused)
            }
            
            Prop("resizeMode") { (view: CrispyVLCVideoView, mode: String?) in
                view.setResizeMode(mode ?? "contain")
            }
            
            Prop("decoderMode") { (view: CrispyVLCVideoView, mode: String?) in
                view.setDecoderMode(mode ?? "auto")
            }
            
            Prop("gpuMode") { (view: CrispyVLCVideoView, mode: String?) in
                view.setGpuMode(mode ?? "gpu")
            }
            
            Prop("metadata") { (view: CrispyVLCVideoView, metadata: [String: String]?) in
                view.setMetadata(metadata)
            }
            
            Prop("playInBackground") { (view: CrispyVLCVideoView, enabled: Bool) in
                view.setPlayInBackground(enabled)
            }
            
            OnViewDidUpdateProps { (view: CrispyVLCVideoView) in
                view.applyProps()
            }
        }
    }
    
    private func enterPiPMode() {
        guard let window = UIApplication.shared.keyWindow,
              let rootViewController = window.rootViewController else {
            return
        }
        
        // Find any active AVPlayerLayer
        if let playerLayer = findPlayerLayer(in: rootViewController.view) {
            if pipController == nil {
                pipController = AVPictureInPictureController(playerLayer: playerLayer)
            }
            pipController?.startPictureInPicture()
        }
    }
    
    private func findPlayerLayer(in view: UIView) -> AVPlayerLayer? {
        for subview in view.subviews {
            if let playerLayer = subview.layer as? AVPlayerLayer {
                return playerLayer
            }
            if let found = findPlayerLayer(in: subview) {
                return found
            }
        }
        return nil
    }
}

// MARK: - VLC Video View

public class CrispyVLCVideoView: UIView {
    private var mediaPlayer: VLCMediaPlayer?
    private var videoView: UIView?
    private var displayLink: CADisplayLink?
    
    // Props
    private var source: String?
    private var headers: [String: String]?
    private var paused: Bool = false
    private var resizeMode: String = "contain"
    private var decoderMode: String = "auto"
    private var gpuMode: String = "gpu"
    private var metadata: [String: String]?
    private var playInBackground: Bool = false
    
    private var hasLoaded: Bool = false
    private var duration: Int = 0
    private var hasEmittedLoad: Bool = false
    
    // Callbacks for event emission
    var onLoad: (([String: Any]) -> Void)?
    var onProgress: (([String: Any]) -> Void)?
    var onEnd: (() -> Void)?
    var onError: ((String) -> Void)?
    var onBuffering: ((Bool) -> Void)?
    var onReadyForDisplay: (() -> Void)?
    var onTracksChanged: ((Any) -> Void)?
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }
    
    private func setupView() {
        backgroundColor = .black
        
        let video = UIView(frame: bounds)
        video.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        video.backgroundColor = .clear
        addSubview(video)
        self.videoView = video
        
        mediaPlayer = VLCMediaPlayer()
        mediaPlayer?.delegate = self
        mediaPlayer?.drawable = video
        
        // Setup display link for progress updates
        displayLink = CADisplayLink(target: self, selector: #selector(updateProgress))
        displayLink?.add(to: .main, forMode: .common)
    }
    
    public func setSource(_ source: String?) {
        self.source = source
        hasEmittedLoad = false
    }
    
    public func setHeaders(_ headers: [String: String]?) {
        self.headers = headers
    }
    
    public func setPaused(_ paused: Bool) {
        self.paused = paused
        guard hasLoaded else { return }
        
        if paused {
            mediaPlayer?.pause()
        } else {
            mediaPlayer?.play()
        }
    }
    
    public func setResizeMode(_ mode: String) {
        self.resizeMode = mode
    }
    
    public func setDecoderMode(_ mode: String) {
        self.decoderMode = mode
    }
    
    public func setGpuMode(_ mode: String) {
        self.gpuMode = mode
    }
    
    public func setMetadata(_ metadata: [String: String]?) {
        self.metadata = metadata
    }
    
    public func setPlayInBackground(_ enabled: Bool) {
        self.playInBackground = enabled
        configureAudioSession()
    }
    
    public func applyProps() {
        loadSource()
    }
    
    private func loadSource() {
        guard let source = source, let url = URL(string: source) else {
            return
        }
        
        let media = VLCMedia(url: url)
        
        // Add headers if provided
        if let headers = headers {
            for (key, value) in headers {
                media.addOptions(["http-\(key)=\(value)"])
            }
        }
        
        mediaPlayer?.media = media
        configureAudioSession()
        
        if !paused {
            mediaPlayer?.play()
        }
        
        hasLoaded = true
    }
    
    private func configureAudioSession() {
        let audioSession = AVAudioSession.sharedInstance()
        do {
            let category: AVAudioSession.Category = playInBackground ? .playback : .ambient
            try audioSession.setCategory(category, mode: .moviePlayback, options: [.allowAirPlay, .allowBluetooth])
            try audioSession.setActive(true)
        } catch {
            print("[CrispyVLCVideoView] Audio session error: \(error)")
        }
    }
    
    @objc private func updateProgress() {
        guard let player = mediaPlayer else { return }
        
        let currentTimeMs = Int(player.time.intValue)
        let durationMs = Int(player.media?.length.intValue ?? 0)
        
        // Emit onLoad once we have duration
        if durationMs > 0 && !hasEmittedLoad {
            self.duration = durationMs
            hasEmittedLoad = true
            onLoad?([
                "duration": durationMs / 1000,
                "width": 0,
                "height": 0
            ])
        }
        
        onProgress?([
            "position": currentTimeMs / 1000,
            "duration": durationMs / 1000
        ])
    }
    
    // MARK: - Public Methods
    
    public func seek(to positionSec: Double) {
        let targetTime = Int(positionSec * 1000)
        mediaPlayer?.time = VLCTime(int: Int32(targetTime))
    }
    
    public func setAudioTrack(_ trackId: Int) {
        let tracks = mediaPlayer?.audioTracksIndexes ?? []
        if trackId < tracks.count {
            mediaPlayer?.currentAudioTrackIndex = tracks[trackId]
        }
    }
    
    public func setSubtitleTrack(_ trackId: Int) {
        let subtitles = mediaPlayer?.videoSubTitlesIndexes ?? []
        if trackId < subtitles.count {
            mediaPlayer?.currentVideoSubTitleIndex = subtitles[trackId]
        }
    }
    
    public func addExternalSubtitle(url: String, title: String?, lang: String?) {
        // VLC iOS doesn't support adding external subtitles at runtime via public API
    }
    
    public func setSubtitleDelay(_ delay: Double) {
        let delayMs = Int(delay * 1000)
        mediaPlayer?.currentVideoSubTitleDelay = Int32(delayMs)
    }
    
    public func setSubtitleSize(_ size: Double) {}
    public func setSubtitleColor(_ color: String) {}
    public func setSubtitleBackgroundColor(_ color: String, opacity: Double) {}
    public func setSubtitleBorderSize(_ size: Double) {}
    public func setSubtitleBorderColor(_ color: String) {}
    public func setSubtitlePosition(_ pos: Double) {}
    public func setSubtitleBold(_ bold: Bool) {}
    public func setSubtitleItalic(_ italic: Bool) {}
    public func setDecoderMode(_ mode: String) {}
    public func setGpuMode(_ mode: String) {}
    
    public override func removeFromSuperview() {
        displayLink?.invalidate()
        displayLink = nil
        mediaPlayer?.stop()
        mediaPlayer?.delegate = nil
        mediaPlayer = nil
        super.removeFromSuperview()
    }
}

// MARK: - VLCMediaPlayerDelegate

extension CrispyVLCVideoView: VLCMediaPlayerDelegate {
    public func mediaPlayerStateChanged(_ aNotification: Notification) {
        guard let player = mediaPlayer else { return }
        
        switch player.state {
        case .buffering:
            onBuffering?(true)
        case .playing:
            onBuffering?(false)
            onReadyForDisplay?()
        case .ended:
            onEnd?()
        case .error:
            onError?("VLC playback error")
        default:
            break
        }
    }
    
    public func mediaPlayerTimeChanged(_ aNotification: Notification) {
        // Handled by display link for smoother updates
    }
}
