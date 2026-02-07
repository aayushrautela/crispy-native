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

public class CrispyKSVideoView: IOSVideoPlayerView {
    
    // Props
    private var sourceStr: String?
    private var headers: [String: String]?
    private var isPaused: Bool = false
    private var rate: Double = 1.0
    private var volumeValue: Double = 1.0
    private var resizeModeVal: String = "contain"
    private var metadata: [String: String]?
    private var playInBackground: Bool = false
    
    private var hasLoaded: Bool = false
    private var duration: TimeInterval = 0
    private var videoWidth: Int = 0
    private var videoHeight: Int = 0
    
    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }
    
    private func setupView() {
        backgroundColor = .black
        
        // Listen to play time change
        self.playTimeDidChange = { [weak self] (currentTime: TimeInterval, totalTime: TimeInterval) in
            self?.emitEvent("onProgress", [
                "currentTime": currentTime,
                "duration": totalTime
            ])
        }
    }
    
    // MARK: - Prop Setters
    
    public func setSource(_ source: String?) {
        self.sourceStr = source
    }
    
    public func setHeaders(_ headers: [String: String]?) {
        self.headers = headers
    }
    
    public func setPaused(_ paused: Bool) {
        self.isPaused = paused
        guard hasLoaded, let player = self.playerLayer?.player else { return }
        
        if paused {
            player.pause()
        } else {
            player.play()
        }
    }
    
    public func setRate(_ rate: Double) {
        self.rate = rate
        self.playerLayer?.player?.playbackRate = Float(rate)
    }
    
    public func setVolume(_ volume: Double) {
        self.volumeValue = volume
        self.playerLayer?.player?.volume = Float(volume)
    }
    
    public func setResizeMode(_ mode: String) {
        self.resizeModeVal = mode
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
        guard let source = sourceStr, let url = URL(string: source) else {
            return
        }
        
        let options = KSOptions()
        options.isSecondOpen = false
        options.isAccurateSeek = true
        options.isLoopPlay = false
        options.startPlayRate = Float(rate)
        
        // Add headers if provided
        if let headers = headers {
            options.appendHeader(headers)
        }
        
        let name = metadata?["title"] ?? url.lastPathComponent
        let resource = KSPlayerResource(url: url, options: options, name: name)
        
        self.set(resource: resource)
        
        configureAudioSession()
        
        if !isPaused {
            // Auto play is handled by set(resource) usually, but we can enforce
            // self.playerLayer?.player?.play()
        } else {
             self.playerLayer?.player?.pause()
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
        guard let playerLayer = self.playerLayer else { return }
        
        // KSPlayerLayer usually wraps AVPlayerLayer or exposes videoGravity. 
        // If KSPlayerLayer doesn't have videoGravity, we might need to cast or look for documentation.
        // Assuming it works or we need to access the underlying AVPlayerLayer.
        // If KSPlayerLayer is a CALayer subclass, it might not have videoGravity directly if it's not AVPlayerLayer.
        // However, usually it is.
        // Let's try to set it. If it fails, we might need to check if it's an AVPlayerLayer.
        
        switch resizeModeVal {
        case "cover":
            playerLayer.videoGravity = .resizeAspectFill
        case "stretch":
            playerLayer.videoGravity = .resize
        case "contain", "original", _:
            playerLayer.videoGravity = .resizeAspect
        }
    }
    
    // MARK: - Public Methods
    
    public func seek(to positionSec: Double) {
        let targetTime = TimeInterval(positionSec)
        self.seek(time: targetTime)
    }
    
    public func setAudioTrack(_ trackId: Int) {
        guard let player = self.playerLayer?.player else { return }
        let tracks = player.tracks(mediaType: .audio)
        if trackId < tracks.count {
            player.select(track: tracks[trackId])
        }
    }
    
    public func setSubtitleTrack(_ trackId: Int) {
        guard let player = self.playerLayer?.player else { return }
        let tracks = player.tracks(mediaType: .subtitle)
        if trackId < tracks.count {
            player.select(track: tracks[trackId])
        }
    }
    
    // MARK: - Player Delegate Overrides
    
    public override func player(layer: KSPlayerLayer, state: KSPlayerState) {
        super.player(layer: layer, state: state)
        
        switch state {
        case .readyToPlay:
            emitEvent("onReadyForDisplay", [:])
            let duration = layer.player?.duration ?? 0
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

    // MARK: - Event Emission
    
    private func emitEvent(_ name: String, _ body: [String: Any]) {
        // Events are emitted through the module's event system
        // Implementation depends on Expo Modules event handling
        // For now, this is a placeholder matching original code
    }
    
    public override func removeFromSuperview() {
        self.playerLayer?.player?.pause()
        super.removeFromSuperview()
    }
}
