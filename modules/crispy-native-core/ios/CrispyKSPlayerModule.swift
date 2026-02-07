import ExpoModulesCore
import KSPlayer
import AVKit

// MARK: - KSPlayer Video View Module

public class CrispyKSPlayerModule: Module {
    public func definition() -> ModuleDefinition {
        Name("CrispyKSPlayer")
        
        View(CrispyKSVideoView.self) {
            Prop("source") { (view: CrispyKSVideoView, source: String?) in
                view.setSource(source)
            }
            
            Prop("headers") { (view: CrispyKSVideoView, headers: [String: String]?) in
                view.setHeaders(headers)
            }
            
            Prop("paused") { (view: CrispyKSVideoView, paused: Bool) in
                view.setPaused(paused)
            }
            
            Prop("rate") { (view: CrispyKSVideoView, rate: Double) in
                view.setRate(rate)
            }
            
            Prop("volume") { (view: CrispyKSVideoView, volume: Double) in
                view.setVolume(volume)
            }
            
            Prop("resizeMode") { (view: CrispyKSVideoView, mode: String?) in
                view.setResizeMode(mode ?? "contain")
            }
            
            Prop("metadata") { (view: CrispyKSVideoView, metadata: [String: String]?) in
                view.setMetadata(metadata)
            }
            
            Prop("playInBackground") { (view: CrispyKSVideoView, enabled: Bool) in
                view.setPlayInBackground(enabled)
            }
            
            OnViewDidUpdateProps { (view: CrispyKSVideoView) in
                view.applyProps()
            }
        }
    }
}

// MARK: - KSPlayer Video View

public class CrispyKSVideoView: UIView {
    private var playerView: IOSVideoPlayerView?
    private var resource: KSPlayerResource?
    private var playerController: VideoPlayerController?
    
    // Props
    private var source: String?
    private var headers: [String: String]?
    private var paused: Bool = false
    private var rate: Double = 1.0
    private var volume: Double = 1.0
    private var resizeMode: String = "contain"
    private var metadata: [String: String]?
    private var playInBackground: Bool = false
    
    private var hasLoaded: Bool = false
    private var duration: TimeInterval = 0
    private var videoWidth: Int = 0
    private var videoHeight: Int = 0
    
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
        
        let options = KSOptions()
        options.isSecondOpen = false
        options.isAccurateSeek = true
        options.isLoopPlay = false
        
        // Configure background playback
        options.playbackRate = Float(rate)
        
        let controller = VideoPlayerController()
        controller.delegate = self
        self.playerController = controller
        
        let playerView = IOSVideoPlayerView(frame: bounds, options: options)
        playerView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        playerView.playerController = controller
        addSubview(playerView)
        self.playerView = playerView
    }
    
    public func setSource(_ source: String?) {
        self.source = source
    }
    
    public func setHeaders(_ headers: [String: String]?) {
        self.headers = headers
    }
    
    public func setPaused(_ paused: Bool) {
        self.paused = paused
        guard hasLoaded else { return }
        
        if paused {
            playerController?.pause()
        } else {
            playerController?.play()
        }
    }
    
    public func setRate(_ rate: Double) {
        self.rate = rate
        playerController?.playbackRate = Float(rate)
    }
    
    public func setVolume(_ volume: Double) {
        self.volume = volume
        playerController?.volume = Float(volume)
    }
    
    public func setResizeMode(_ mode: String) {
        self.resizeMode = mode
        updateVideoGravity()
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
        
        var options = KSOptions()
        options.isSecondOpen = false
        options.isAccurateSeek = true
        options.playbackRate = Float(rate)
        
        // Add headers if provided
        if let headers = headers {
            var headerArray: [String] = []
            for (key, value) in headers {
                headerArray.append("\(key): \(value)")
            }
            options.headers = headerArray
        }
        
        let name = metadata?["title"] ?? url.lastPathComponent
        resource = KSPlayerResource(url: url, options: options, name: name)
        
        if let resource = resource {
            playerController?.set(resource: resource)
        }
        
        configureAudioSession()
        
        if !paused {
            playerController?.play()
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
            print("[CrispyKSVideoView] Audio session error: \(error)")
        }
    }
    
    private func updateVideoGravity() {
        guard let playerView = playerView else { return }
        
        switch resizeMode {
        case "cover":
            playerView.playerLayer?.videoGravity = .resizeAspectFill
        case "stretch":
            playerView.playerLayer?.videoGravity = .resize
        case "contain", "original", _:
            playerView.playerLayer?.videoGravity = .resizeAspect
        }
    }
    
    // MARK: - Public Methods
    
    public func seek(to positionSec: Double) {
        let targetTime = TimeInterval(positionSec)
        playerController?.seek(time: targetTime)
    }
    
    public func setAudioTrack(_ trackId: Int) {
        let tracks = playerController?.tracks(mediaType: .audio) ?? []
        if trackId < tracks.count {
            playerController?.select(track: tracks[trackId])
        }
    }
    
    public func setSubtitleTrack(_ trackId: Int) {
        let tracks = playerController?.tracks(mediaType: .subtitle) ?? []
        if trackId < tracks.count {
            playerController?.select(track: tracks[trackId])
        }
    }
    
    // MARK: - Event Emission
    
    private func emitEvent(_ name: String, _ body: [String: Any]) {
        // Events are emitted through the module's event system
        // Implementation depends on Expo Modules event handling
    }
    
    public override func removeFromSuperview() {
        playerController?.pause()
        playerController?.delegate = nil
        playerController = nil
        playerView?.removeFromSuperview()
        playerView = nil
        super.removeFromSuperview()
    }
}

// MARK: - VideoPlayerControllerDelegate

extension CrispyKSVideoView: VideoPlayerControllerDelegate {
    public func playerController(_ controller: VideoPlayerController, currentTime: TimeInterval, totalTime: TimeInterval) {
        emitEvent("onProgress", [
            "currentTime": currentTime,
            "duration": totalTime
        ])
    }
    
    public func playerController(_ controller: VideoPlayerController, state: PlayerState) {
        switch state {
        case .readyToPlay:
            emitEvent("onReadyForDisplay", [:])
            let duration = controller.player?.duration ?? 0
            emitEvent("onLoad", [
                "duration": duration,
                "width": videoWidth,
                "height": videoHeight
            ])
        case .buffering:
            emitEvent("onBuffering", ["buffering": true])
        case .bufferFinished:
            emitEvent("onBuffering", ["buffering": false])
        case .finished:
            emitEvent("onEnd", [:])
        case .error(let error):
            emitEvent("onError", ["error": error.localizedDescription])
        default:
            break
        }
    }
    
    public func playerController(_ controller: VideoPlayerController, shouldAutoSelectAudio: Bool) -> Bool {
        return true
    }
    
    public func playerController(_ controller: VideoPlayerController, shouldAutoSelectSubtitle: Bool) -> Bool {
        return true
    }
}
